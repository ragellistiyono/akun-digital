import { randomBytes, randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { STATUS_PESANAN, type StatusPesanan } from "@/domain/status-pesanan";
import { db, koneksi } from "@/server/db";
import {
  itemStok,
  pesanan,
  riwayatStatusPesanan,
  varian,
} from "@/server/db/schema";
import { bacaStokVarian } from "@/server/item-stok";
import {
  cekStatusPembayaran,
  prosesKabarPembayaran,
} from "@/server/kabar-pembayaran";
import { buatPesanan } from "@/server/pesanan";
import {
  bayarQrisTiruan,
  qrispyTiruan,
  tolakPembatalanTiruan,
} from "@/server/qrispy-tiruan";
import { sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanPesanan } from "@/server/uji-pesanan";

import golden from "../../../../../../tests/golden/transisi-status-pesanan.json";

import { aksiBatalkanPesanan } from "./aksi";

// Test integrasi Server Action pembatalan dengan database app_test dan Qrispy tiruan dari .env.ci
// (QRISPY_MODE=tiruan). Pesanan Menunggu Pembayaran dibuat lewat checkout, sehingga QRIS-nya diterbitkan
// Qrispy tiruan dan satu Item stok-nya ditahan. Data Produknya bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Varian Netflix Premium 1 Bulan Rp 50.000 [CONTOH] dengan sejumlah Item stok Tersedia. */
async function netflixSatuBulan(Tersedia: number) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia }],
  });
  const [{ id }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  return id;
}

/** Checkout Varian itu sampai Pesanan Menunggu Pembayaran dibuat. */
async function checkout(varianId: string) {
  const hasil = await buatPesanan({
    varianId,
    email: `budi-${randomUUID()}@example.test`,
  });
  if (hasil.hasil !== "dibuat")
    throw new Error(`Checkout gagal: ${hasil.hasil}`);
  const [dibuat] = await db
    .select({
      id: pesanan.id,
      qrisId: pesanan.qrisId,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .where(eq(pesanan.tautan, hasil.tautan));
  return { ...dibuat, tautan: hasil.tautan };
}

/** Status dari fixture golden, yang harus salah satu status Pesanan (PRD §5.7). */
function status(teks: string): StatusPesanan {
  const dikenal = STATUS_PESANAN.find((s) => s === teks);
  if (!dikenal) throw new Error(`Status "${teks}" tidak dikenal.`);
  return dikenal;
}

/** Status yang menurut golden tidak boleh berpindah ke Dibatalkan, yaitu semua selain Menunggu Pembayaran. */
const STATUS_TIDAK_BISA_DIBATALKAN = golden.kasus
  .filter(({ input, output }) => input.ke === "Dibatalkan" && !output.boleh)
  .map(({ input }) => status(input.dari));

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

/**
 * Menekan "Batalkan" untuk Tautan Pesanan itu. Hasilnya alamat tujuan bila Pembeli diarahkan, atau
 * keadaan yang dikembalikan Server Action.
 */
async function tekanBatalkan(tautan: string) {
  try {
    return { keadaan: await aksiBatalkanPesanan({}, formulir({ tautan })) };
  } catch (galat) {
    if (
      typeof galat === "object" &&
      galat !== null &&
      "digest" in galat &&
      typeof galat.digest === "string" &&
      galat.digest.startsWith("NEXT_REDIRECT")
    ) {
      return { alamat: galat.digest.split(";")[2] };
    }
    throw galat;
  }
}

async function statusPesanan(id: string) {
  const [baris] = await db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.id, id));
  return baris.status;
}

function itemStokPesanan(id: string) {
  return db
    .select({ status: itemStok.status })
    .from(itemStok)
    .where(eq(itemStok.pesananId, id));
}

function riwayat(id: string) {
  return db
    .select({
      status: riwayatStatusPesanan.status,
      pelaku: riwayatStatusPesanan.pelaku,
    })
    .from(riwayatStatusPesanan)
    .where(eq(riwayatStatusPesanan.pesananId, id))
    .orderBy(asc(riwayatStatusPesanan.waktu));
}

describe("pembatalan oleh Pembeli (PRD §5.8)", () => {
  it("Pesanan Menunggu Pembayaran menjadi Dibatalkan, Item stok yang ditahannya kembali Tersedia, dan Pembeli kembali ke Tautan Pesanan", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    // PRD §5.3: Item stok yang ditahan tidak dihitung dalam Stok Varian.
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(9);

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}`,
    });

    expect(await statusPesanan(dipesan.id)).toBe("Dibatalkan");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(10);
    expect(await itemStokPesanan(dipesan.id)).toEqual([]);
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
      { status: "Dibatalkan", pelaku: "Pembeli" },
    ]);
    // QRIS-nya ikut dibatalkan di Qrispy.
    expect(await qrispyTiruan.cekStatusQris(dipesan.qrisId)).toEqual({
      paymentStatus: "cancelled",
    });
  });

  // PRD §5.8: bila Qrispy menolak pembatalan karena tagihannya sudah dibayar, Pesanan diproses sebagai
  // sudah dibayar lewat pemroses kabar pembayaran. Pembeli kembali ke Tautan Pesanan dengan tanda
  // pembatalan sudah dibayar, supaya Halaman Pesanan Selesai menampilkan pesan penjelasnya (issue T20-b).
  it("bila Qrispy tiruan menolak pembatalan dan status QRIS paid, Pesanan diproses sebagai sudah dibayar dan menjadi Selesai", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    // Pembeli sudah membayar sebelum menekan Batalkan, jadi Qrispy tiruan menolak pembatalannya.
    bayarQrisTiruan({ qrisId: dipesan.qrisId, amount: dipesan.totalBayar });

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}?pembatalan=sudah-dibayar`,
    });

    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    expect(await itemStokPesanan(dipesan.id)).toEqual([{ status: "Terkirim" }]);
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(9);
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
      { status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  it("bila Qrispy tiruan menolak pembatalan dan status QRIS pending, Pesanan tetap Menunggu Pembayaran dan Pembeli melihat pesan gagal", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    tolakPembatalanTiruan(dipesan.qrisId);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      keadaan: {
        galat:
          "Pesanan belum bisa dibatalkan karena Qrispy belum membatalkan QRIS-nya, jadi Pesanan masih Menunggu Pembayaran. Tekan Batalkan sekali lagi untuk mencoba lagi.",
      },
    });

    expect(await statusPesanan(dipesan.id)).toBe("Menunggu Pembayaran");
    expect(await itemStokPesanan(dipesan.id)).toEqual([{ status: "Ditahan" }]);
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(9);
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
    ]);
  });

  // ADR-0004: bila permintaan pembatalan gagal tetapi QRIS-nya ternyata sudah cancelled atau expired di
  // Qrispy, Pesanan tetap menjadi Dibatalkan.
  it("bila Qrispy tiruan menolak pembatalan dan QRIS-nya sudah cancelled, Pesanan menjadi Dibatalkan dan Item stok-nya kembali Tersedia", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    // QRIS-nya sudah dibatalkan di Qrispy, misalnya oleh permintaan sebelumnya yang jawabannya hilang.
    await qrispyTiruan.batalkanQris(dipesan.qrisId);
    tolakPembatalanTiruan(dipesan.qrisId);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}`,
    });

    expect(await statusPesanan(dipesan.id)).toBe("Dibatalkan");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(10);
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
      { status: "Dibatalkan", pelaku: "Pembeli" },
    ]);
  });

  it("bila Qrispy tiruan menolak pembatalan dan QRIS-nya sudah expired, Pesanan menjadi Dibatalkan", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    tolakPembatalanTiruan(dipesan.qrisId);
    vi.spyOn(qrispyTiruan, "cekStatusQris").mockResolvedValueOnce({
      paymentStatus: "expired",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await tekanBatalkan(dipesan.tautan);

    expect(await statusPesanan(dipesan.id)).toBe("Dibatalkan");
    expect((await bacaStokVarian(varianId)).stokVarian).toBe(10);
  });

  it("golden memuat Pesanan Selesai sebagai Pesanan yang tidak bisa dibatalkan", () => {
    expect(STATUS_TIDAK_BISA_DIBATALKAN).toContain("Selesai");
  });

  // PRD §5.8 (▶ Keputusan 2026-11-12 #99, issue T20-c): pembayarannya tercatat beberapa detik sebelum
  // "Batalkan" diproses, jadi Pesanan sudah Selesai. Pesanan itu tidak dibatalkan, dan Pembeli kembali ke
  // Tautan Pesanan dengan tanda pembatalan sudah dibayar, sama seperti pembatalan yang ditolak Qrispy.
  it("Pesanan yang sudah Selesai saat Batalkan diproses tidak dibatalkan, Qrispy tidak dimintai pembatalan, dan Pembeli kembali ke Tautan Pesanan dengan tanda pembatalan sudah dibayar", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    bayarQrisTiruan({ qrisId: dipesan.qrisId, amount: dipesan.totalBayar });
    await cekStatusPembayaran(dipesan.tautan);
    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    const batalkanQris = vi.spyOn(qrispyTiruan, "batalkanQris");

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}?pembatalan=sudah-dibayar`,
    });

    expect(batalkanQris).not.toHaveBeenCalled();
    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    expect(await itemStokPesanan(dipesan.id)).toEqual([{ status: "Terkirim" }]);
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
      { status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  // Issue T20-c: kabar pembayarannya diproses selama Qrispy dimintai pembatalan, jadi Pesanan sudah
  // Selesai saat toko hendak menjadikannya Dibatalkan.
  it("Pesanan yang menjadi Selesai selama pembatalannya diproses tidak dibatalkan, dan Pembeli kembali ke Tautan Pesanan dengan tanda pembatalan sudah dibayar", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    vi.spyOn(qrispyTiruan, "batalkanQris").mockImplementationOnce(async () => {
      await prosesKabarPembayaran({
        qrisId: dipesan.qrisId,
        nominalDiterima: dipesan.totalBayar,
        waktuBayar: new Date(),
      });
    });

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}?pembatalan=sudah-dibayar`,
    });

    expect(await statusPesanan(dipesan.id)).toBe("Selesai");
    expect(await riwayat(dipesan.id)).toEqual([
      { status: "Menunggu Pembayaran", pelaku: "Pembeli" },
      { status: "Selesai", pelaku: "Qrispy" },
    ]);
  });

  // PRD §5.8 (▶ Keputusan 2026-11-12 #99): Pesanan yang menjadi Bermasalah karena nominalnya kurang (§5.9)
  // tidak mendapat tanda itu, jadi Halaman Pesanan Bermasalah tampil tanpa pesan penjelas pembatalan.
  it("Pesanan yang sudah Bermasalah saat Batalkan diproses tidak dibatalkan, dan Pembeli kembali ke Tautan Pesanan tanpa tanda pembatalan sudah dibayar", async () => {
    const varianId = await netflixSatuBulan(10);
    const dipesan = await checkout(varianId);
    bayarQrisTiruan({
      qrisId: dipesan.qrisId,
      amount: dipesan.totalBayar - 1,
    });
    await cekStatusPembayaran(dipesan.tautan);
    expect(await statusPesanan(dipesan.id)).toBe("Bermasalah");
    const batalkanQris = vi.spyOn(qrispyTiruan, "batalkanQris");

    expect(await tekanBatalkan(dipesan.tautan)).toEqual({
      alamat: `/pesanan/${dipesan.tautan}`,
    });

    expect(batalkanQris).not.toHaveBeenCalled();
    expect(await statusPesanan(dipesan.id)).toBe("Bermasalah");
  });

  // PRD §5.7 dan tests/golden/transisi-status-pesanan.json: hanya Pesanan Menunggu Pembayaran yang bisa
  // dibatalkan. Pembeli dikembalikan ke Tautan Pesanan, yang menampilkan statusnya saat ini. Pesanan
  // Selesai mendapat tanda pembatalan sudah dibayar dan diuji di test sebelumnya.
  it.each(STATUS_TIDAK_BISA_DIBATALKAN.filter((s) => s !== "Selesai"))(
    "Pesanan %s tidak bisa dibatalkan: statusnya tidak berubah dan Qrispy tidak dimintai pembatalan",
    async (statusAwal) => {
      const varianId = await netflixSatuBulan(10);
      const dipesan = await sisipkanPesanan({ varianId, status: statusAwal });
      const batalkanQris = vi.spyOn(qrispyTiruan, "batalkanQris");

      expect(await tekanBatalkan(dipesan.tautan)).toEqual({
        alamat: `/pesanan/${dipesan.tautan}`,
      });

      expect(await statusPesanan(dipesan.id)).toBe(statusAwal);
      expect(batalkanQris).not.toHaveBeenCalled();
      expect(await riwayat(dipesan.id)).toEqual([]);
    },
  );

  // PRD §6.2: hanya pemegang Tautan Pesanan yang bisa membatalkan Pesanan itu, dan pemeriksaannya ada di
  // server, bukan di tampilan.
  it.each([
    [
      "satu huruf yang diubah",
      (asli: string) => `${asli.slice(0, -1)}${asli.endsWith("A") ? "B" : "A"}`,
    ],
    ["Tautan Pesanan yang terpotong", (asli: string) => asli.slice(0, -1)],
    [
      "Tautan Pesanan lain yang tidak dikenal",
      () => randomBytes(32).toString("base64url"),
    ],
    ["isian Tautan Pesanan yang kosong", () => ""],
  ])(
    "pembatalan dengan %s ditolak dengan pesan, dan tidak ada Pesanan yang berubah",
    async (_kasus, tautanSalah) => {
      const varianId = await netflixSatuBulan(10);
      const dipesan = await checkout(varianId);
      const batalkanQris = vi.spyOn(qrispyTiruan, "batalkanQris");

      expect(await tekanBatalkan(tautanSalah(dipesan.tautan))).toEqual({
        keadaan: {
          galat:
            "Tautan Pesanan ini tidak dikenal, jadi tidak ada Pesanan yang dibatalkan. Buka lagi Pesanan Anda lewat Tautan Pesanan-nya, lalu tekan Batalkan.",
        },
      });

      expect(batalkanQris).not.toHaveBeenCalled();
      expect(await statusPesanan(dipesan.id)).toBe("Menunggu Pembayaran");
      expect(await itemStokPesanan(dipesan.id)).toEqual([
        { status: "Ditahan" },
      ]);
    },
  );
});
