// Pekerjaan latar dengan pg-boss (ADR-0001), di PostgreSQL yang sama dengan aplikasi dan tanpa Redis:
// kedaluwarsa Pesanan (PRD §5.8) dan email "Pesanan selesai" (PRD §6.3, §6.4).
// pg-boss menyimpan antrean pekerjaannya di skema `pgboss` miliknya sendiri, yang dibuat atau dimigrasi
// pg-boss saat pertama kali dimulai, terpisah dari tabel aplikasi yang dikelola Drizzle.
//
// Setiap proses punya satu instance pg-boss, yang dimulai saat pertama kali dipakai. Hanya proses server
// aplikasi yang menjalankan pekerjaan (jalankanPekerjaanLatar, dipanggil dari src/instrumentation.ts);
// proses lain, misalnya test, hanya menjadwalkan.
import { sql } from "drizzle-orm";
import {
  fromDrizzle,
  PgBoss,
  type DrizzleTransactionLike,
  type Job,
  type JobResult,
  type JobWithMetadata,
} from "pg-boss";

import type { PengirimEmail } from "./email";
import {
  kirimEmailPesananSelesai,
  tandaiEmailGagal,
} from "./email-pesanan-selesai";
import { prosesKedaluwarsaPesanan } from "./kedaluwarsa-pesanan";

/** Antrean pekerjaan kedaluwarsa Pesanan (PRD §5.8): satu pekerjaan untuk setiap Pesanan. */
const ANTREAN_KEDALUWARSA_PESANAN = "kedaluwarsa-pesanan";

type DataKedaluwarsaPesanan = { pesananId: string };

/** Antrean pekerjaan email "Pesanan selesai" (PRD §6.3): satu pekerjaan untuk setiap kiriman. */
const ANTREAN_EMAIL_PESANAN_SELESAI = "email-pesanan-selesai";

type DataEmailPesananSelesai = { pesananId: string };

/** Batas koneksi PostgreSQL milik pg-boss di setiap proses, di samping koneksi Drizzle. */
const KONEKSI_PG_BOSS = 4;

/**
 * Jeda antara dua pencarian pekerjaan yang sudah waktunya. Pekerjaan kedaluwarsa paling lambat berjalan
 * sekitar 1 detik setelah waktu kedaluwarsa Pesanan-nya.
 */
const JEDA_CARI_PEKERJAAN_DETIK = 1;

/**
 * Pekerjaan yang diambil sekaligus. Selama setiap pengambilan penuh, pengambilan berikutnya langsung
 * menyusul, sehingga pekerjaan yang menumpuk, misalnya setelah server dimulai ulang, cepat habis.
 */
const PEKERJAAN_SEKALI_AMBIL = 10;

// Instance pg-boss proses ini, dan pekerja yang sudah berjalan. Disimpan di globalThis, karena Next.js
// bisa memuat modul ini lebih dari sekali dalam satu proses server, padahal penjadwal dan pekerja harus
// memakai instance yang sama, dan pekerjanya cukup satu.
const wadah = globalThis as typeof globalThis & {
  __pgBoss?: Promise<PgBoss>;
  __pekerjaanLatarBerjalan?: Promise<void>;
};

async function mulaiPgBoss() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL kosong, jadi pekerjaan latar tidak bisa dijadwalkan atau dijalankan. Salin `.env.example` menjadi `.env`, isi DATABASE_URL, lalu jalankan ulang perintahnya.",
    );
  }
  const boss = new PgBoss({ connectionString: url, max: KONEKSI_PG_BOSS });
  boss.on("error", (galat) => {
    console.error(
      "pg-boss mengalami galat saat mengelola pekerjaan latar. pg-boss mencoba lagi sendiri; bila galat ini terus berulang, periksa koneksi ke PostgreSQL.",
      galat,
    );
  });
  await boss.start();
  // Pekerjaan yang gagal, misalnya karena database sesaat tidak terjangkau, dicoba lagi dengan jeda yang
  // makin panjang. Pekerjaan kedaluwarsa aman diulang, karena Pesanan yang sudah tidak Menunggu
  // Pembayaran tidak diubah lagi.
  await boss.createQueue(ANTREAN_KEDALUWARSA_PESANAN, {
    retryLimit: 10,
    retryDelay: 5,
    retryBackoff: true,
    retryDelayMax: 300,
  });
  // Email yang gagal terkirim, misalnya karena Resend sesaat tidak menjawab atau membatasi kiriman, dicoba
  // lagi 5 kali dengan jeda mulai 30 detik yang makin panjang sampai 10 menit, sehingga percobaan terakhir
  // terjadi sekitar 15–25 menit setelah percobaan pertama (PRD §6.4).
  await boss.createQueue(ANTREAN_EMAIL_PESANAN_SELESAI, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 600,
  });
  return boss;
}

/** Instance pg-boss proses ini, yang dimulai saat pertama kali dipakai. Bila gagal dimulai, dicoba lagi di pemakaian berikutnya. */
function pgBoss() {
  const siap = (wadah.__pgBoss ??= mulaiPgBoss());
  siap.catch(() => {
    if (wadah.__pgBoss === siap) wadah.__pgBoss = undefined;
  });
  return siap;
}

/**
 * Menjadwalkan pekerjaan kedaluwarsa sebuah Pesanan pada waktu kedaluwarsanya (ADR-0004). Bila
 * transaksi Drizzle diberikan, pekerjaan itu ikut tersimpan atau batal bersama transaksi itu.
 */
export async function jadwalkanKedaluwarsaPesanan(
  { pesananId, kedaluwarsaPada }: { pesananId: string; kedaluwarsaPada: Date },
  tx?: DrizzleTransactionLike,
) {
  const boss = await pgBoss();
  await boss.send(
    ANTREAN_KEDALUWARSA_PESANAN,
    { pesananId } satisfies DataKedaluwarsaPesanan,
    {
      startAfter: kedaluwarsaPada,
      db: tx === undefined ? undefined : fromDrizzle(tx, sql),
    },
  );
}

/** Waktu mulai setiap pekerjaan kedaluwarsa yang pernah dijadwalkan untuk Pesanan itu. */
export async function jadwalKedaluwarsaPesanan(pesananId: string) {
  const boss = await pgBoss();
  const pekerjaan = await boss.findJobs<DataKedaluwarsaPesanan>(
    ANTREAN_KEDALUWARSA_PESANAN,
    { data: { pesananId } },
  );
  return pekerjaan.map(({ startAfter }) => startAfter);
}

/**
 * Menjadwalkan pengiriman email "Pesanan selesai" sebuah Pesanan (PRD §6.3), yang dikirim pekerja di luar
 * transaksi pembayaran. Bila transaksi Drizzle diberikan, pekerjaan itu ikut tersimpan atau batal bersama
 * transaksi itu, jadi email hanya dikirim bila Pesanan benar-benar menjadi Selesai.
 */
export async function jadwalkanEmailPesananSelesai(
  pesananId: string,
  tx?: DrizzleTransactionLike,
) {
  const boss = await pgBoss();
  await boss.send(
    ANTREAN_EMAIL_PESANAN_SELESAI,
    { pesananId } satisfies DataEmailPesananSelesai,
    { db: tx === undefined ? undefined : fromDrizzle(tx, sql) },
  );
}

/** Setiap pekerjaan email "Pesanan selesai" yang pernah dijadwalkan untuk Pesanan itu, beserta batas percobaannya. */
export async function pekerjaanEmailPesananSelesai(pesananId: string) {
  const boss = await pgBoss();
  return boss.findJobs<DataEmailPesananSelesai>(ANTREAN_EMAIL_PESANAN_SELESAI, {
    data: { pesananId },
  });
}

/** Memasang tanda "Email gagal". Bila gagal, misalnya karena database tidak terjangkau, kegagalannya hanya dicatat di log. */
async function tandaiEmailGagalDenganAman(pesananId: string) {
  try {
    await tandaiEmailGagal(pesananId);
  } catch (galat) {
    console.error(
      `Tanda "Email gagal" untuk Pesanan ${pesananId} gagal dipasang, padahal email "Pesanan selesai"-nya tidak terkirim. Periksa koneksi ke PostgreSQL dan galat di bawah ini.`,
      galat,
    );
  }
}

/**
 * Menjalankan satu percobaan pekerjaan email "Pesanan selesai". Percobaan yang gagal dicatat di log dan
 * dicoba lagi oleh pg-boss. Bila percobaan terakhir juga gagal, yaitu percobaan yang retryCount-nya sudah
 * mencapai retryLimit, Pesanan ditandai "Email gagal" (PRD §6.4); status Pesanan tetap Selesai.
 *
 * Adaptor email bisa diganti untuk test.
 */
export async function kerjakanEmailPesananSelesai(
  pekerjaan: Pick<
    JobWithMetadata<DataEmailPesananSelesai>,
    "id" | "data" | "retryCount" | "retryLimit"
  >,
  { pengirim }: { pengirim?: PengirimEmail } = {},
): Promise<JobResult> {
  const { pesananId } = pekerjaan.data;
  try {
    await kirimEmailPesananSelesai(pesananId, { pengirim });
    return { id: pekerjaan.id, status: "completed" };
  } catch (galat) {
    const habis = pekerjaan.retryCount >= pekerjaan.retryLimit;
    console.error(
      habis
        ? `Email "Pesanan selesai" untuk Pesanan ${pesananId} gagal dikirim di percobaan terakhir, jadi Pesanan itu ditandai "Email gagal" dan tetap Selesai. Periksa galat di bawah ini, lalu kirim ulang emailnya.`
        : `Email "Pesanan selesai" untuk Pesanan ${pesananId} gagal dikirim. Pesanan itu tetap Selesai, dan pg-boss mencobanya lagi; bila terus gagal, periksa galat di bawah ini.`,
      galat,
    );
    if (habis) await tandaiEmailGagalDenganAman(pesananId);
    return {
      id: pekerjaan.id,
      status: "failed",
      output: { galat: String(galat) },
    };
  }
}

/**
 * Menjalankan satu pekerjaan kedaluwarsa. Bila jam aplikasi sedikit tertinggal dari jam database,
 * sehingga waktu kedaluwarsa belum tercapai, pekerjaannya dijadwalkan ulang pada waktu itu. Pekerjaan
 * yang gagal dicatat di log dan dicoba lagi oleh pg-boss.
 */
async function kerjakanKedaluwarsaPesanan(
  pekerjaan: Job<DataKedaluwarsaPesanan>,
): Promise<JobResult> {
  const { pesananId } = pekerjaan.data;
  try {
    const hasil = await prosesKedaluwarsaPesanan(pesananId);
    if (hasil.hasil === "belum-kedaluwarsa") {
      await jadwalkanKedaluwarsaPesanan({
        pesananId,
        kedaluwarsaPada: hasil.kedaluwarsaPada,
      });
    }
    return { id: pekerjaan.id, status: "completed", output: hasil };
  } catch (galat) {
    console.error(
      `Pekerjaan kedaluwarsa Pesanan ${pesananId} gagal, jadi Pesanan itu belum berubah. pg-boss mencobanya lagi; bila terus gagal, periksa galat di bawah ini.`,
      galat,
    );
    return {
      id: pekerjaan.id,
      status: "failed",
      output: { galat: String(galat) },
    };
  }
}

/**
 * Mulai menjalankan pekerjaan latar di proses ini, yaitu pekerjaan kedaluwarsa Pesanan dan email "Pesanan
 * selesai". Pemanggilan berikutnya di proses yang sama memakai pekerja yang sudah berjalan.
 */
export function jalankanPekerjaanLatar() {
  const berjalan = (wadah.__pekerjaanLatarBerjalan ??= mulaiPekerja());
  berjalan.catch(() => {
    if (wadah.__pekerjaanLatarBerjalan === berjalan) {
      wadah.__pekerjaanLatarBerjalan = undefined;
    }
  });
  return berjalan;
}

async function mulaiPekerja() {
  const boss = await pgBoss();
  await boss.work<DataKedaluwarsaPesanan>(
    ANTREAN_KEDALUWARSA_PESANAN,
    {
      pollingIntervalSeconds: JEDA_CARI_PEKERJAAN_DETIK,
      batchSize: PEKERJAAN_SEKALI_AMBIL,
      burstWhenBatchFull: true,
      perJobResults: true,
    },
    async (semua) => {
      const hasil: JobResult[] = [];
      for (const pekerjaan of semua) {
        hasil.push(await kerjakanKedaluwarsaPesanan(pekerjaan));
      }
      return hasil;
    },
  );
  // includeMetadata membawa retryLimit setiap pekerjaan, supaya percobaan terakhir bisa dikenali.
  const opsiPekerjaEmail = {
    pollingIntervalSeconds: JEDA_CARI_PEKERJAAN_DETIK,
    batchSize: PEKERJAAN_SEKALI_AMBIL,
    burstWhenBatchFull: true,
    perJobResults: true,
    includeMetadata: true,
  } as const;
  await boss.work<
    DataEmailPesananSelesai,
    JobResult[],
    typeof opsiPekerjaEmail
  >(ANTREAN_EMAIL_PESANAN_SELESAI, opsiPekerjaEmail, async (semua) => {
    const hasil: JobResult[] = [];
    for (const pekerjaan of semua) {
      hasil.push(await kerjakanEmailPesananSelesai(pekerjaan));
    }
    return hasil;
  });
}
