// Data seed UAT M1 untuk `pnpm db:seed` (scripts/db-seed.mts): isi "Persiapan bersama" di docs/UAT.md,
// tanpa Member dan Voucher (PRD §13 ▶ Keputusan 2026-11-11). Semua nilai di berkas ini contoh [CONTOH],
// bukan aturan.
//
// Data ditulis lewat fungsi server yang sama dengan dasbor admin, supaya melewati aturan yang sama: nama
// Kategori unik, Format Item stok dan harga diperiksa domain, gambar diperiksa simpanGambar, dan Item stok
// disimpan terenkripsi seperti Item stok yang ditempel Admin (PRD §12).
//
// Seed boleh dijalankan ulang tanpa menggandakan data. Data seed yang sudah ada dikenali dari email Admin,
// nama Kategori, nama Produk, nama Varian di Produknya, isi Item stok di Variannya, dan qris_id Pesanan seed,
// lalu dilewati. Foto contoh hanya diunggah ke Produk yang belum punya foto, dan Pengaturan toko hanya diisi
// selama masih kosong. Data yang sudah ada tidak diubah, jadi perubahan pemilik selama UAT tetap tersimpan.
import { randomBytes } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import { and, eq } from "drizzle-orm";

import { periksaFormatItemStok } from "@/domain/format-item-stok";
import { namaKategoriDipakai } from "@/domain/nama-kategori";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import { rapikanNomorWhatsapp } from "@/domain/nomor-whatsapp";
import type { StatusPesanan } from "@/domain/status-pesanan";
import { totalBayar } from "@/domain/total-bayar";
import { periksaHarga } from "@/domain/validasi-harga";

import { buatAdmin } from "./auth/buat-admin";
import { db } from "./db";
import { itemStok, pesanan, riwayatStatusPesanan } from "./db/schema";
import { bacaKunciItemStok, sidikJariItemStok } from "./enkripsi-item-stok";
import { unggahFotoProduk } from "./foto-produk";
import { tempelItemStokVarian } from "./item-stok";
import { buatKategori, daftarKategori } from "./kategori";
import { bacaPengaturanToko, simpanPengaturanToko } from "./pengaturan-toko";
import { bacaProduk, buatProduk, daftarProduk } from "./produk";
import { daftarVarian, tambahVarian } from "./varian";

/**
 * Admin seed. Password-nya sengaja ditulis di sini supaya pemilik bisa login saat UAT (docs/UAT.md,
 * "Persiapan bersama"). [CONTOH]
 */
export const ADMIN_SEED = {
  email: "admin@miwe.example",
  password: "sandi-contoh-admin-uat",
};

/**
 * Warna piksel gambar contoh sebagai merah, hijau, biru (0–255), diambil dari palet docs/DESIGN.md. Warna
 * ini isi gambar, bukan warna antarmuka, jadi tidak memakai token CSS.
 */
type Rgb = readonly [number, number, number];

type VarianSeed = {
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  /** Item stok Tersedia, satu baris per Item stok dengan kolom dipisah | seperti tempelan Admin. */
  itemStok: string[];
};

type ProdukSeed = {
  nama: string;
  kategori: string;
  unggulan: boolean;
  aktif: boolean;
  deskripsi: string;
  ketentuanGaransi: string;
  formatItemStok: string[];
  /** Warna petak foto contoh Produk. */
  warnaFoto: Rgb;
  varian: VarianSeed[];
};

/** Kategori seed beserta warna petak ikon contohnya. [CONTOH] */
const KATEGORI: { nama: string; warnaIkon: Rgb }[] = [
  { nama: "Streaming", warnaIkon: [42, 31, 77] }, // langit
  { nama: "Musik", warnaIkon: [159, 95, 112] }, // mauve
  { nama: "Game", warnaIkon: [24, 96, 62] }, // st-selesai
];

/** Item stok contoh, nomor 1 sampai `jumlah`, dari pola isi barisnya. [CONTOH] */
const berurut = (jumlah: number, baris: (nomor: number) => string) =>
  Array.from({ length: jumlah }, (_, i) => baris(i + 1));

/** Produk seed menurut "Persiapan bersama" di docs/UAT.md. [CONTOH] */
const PRODUK: ProdukSeed[] = [
  {
    nama: "Netflix Premium",
    kategori: "Streaming",
    unggulan: true,
    aktif: true,
    deskripsi:
      "Satu profil Netflix Premium untuk satu Pembeli, dengan kualitas tayang hingga 4K. Detail login dan nama profil dikirim begitu pembayaran masuk.",
    ketentuanGaransi:
      "Garansi penggantian selama masa langganan bila profil tidak bisa dipakai. Hubungi kami lewat WhatsApp dengan Nomor Pesanan Anda.",
    formatItemStok: ["Email", "Password", "Profil"],
    warnaFoto: [91, 74, 146], // langit-garis
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 50000,
        hargaNormal: 75000,
        // Dua akun berbagi, masing-masing lima profil (PRD §4.3).
        itemStok: ["a", "b"].flatMap((akun) =>
          berurut(
            5,
            (nomor) =>
              `netflix-${akun}@miwe.example|sandi-contoh-${akun}|Profil ${nomor}`,
          ),
        ),
      },
      {
        nama: "3 Bulan",
        hargaJual: 135000,
        hargaNormal: null,
        itemStok: berurut(
          4,
          (nomor) => `netflix-c@miwe.example|sandi-contoh-c|Profil ${nomor}`,
        ),
      },
    ],
  },
  {
    nama: "YouTube Premium",
    kategori: "Streaming",
    unggulan: false,
    aktif: true,
    deskripsi:
      "Akun YouTube Premium tanpa iklan, dengan putar di latar belakang dan unduhan video. Detail login dikirim begitu pembayaran masuk.",
    ketentuanGaransi:
      "Garansi penggantian selama masa langganan bila akun tidak bisa dipakai. Hubungi kami lewat WhatsApp dengan Nomor Pesanan Anda.",
    formatItemStok: ["Email", "Password"],
    warnaFoto: [235, 201, 103], // matahari
    varian: [
      { nama: "1 Bulan", hargaJual: 20000, hargaNormal: null, itemStok: [] },
      {
        nama: "3 Bulan",
        hargaJual: 55000,
        hargaNormal: null,
        itemStok: berurut(
          3,
          (nomor) => `youtube-${nomor}@miwe.example|sandi-contoh-yt-${nomor}`,
        ),
      },
    ],
  },
  {
    nama: "Spotify Premium",
    kategori: "Musik",
    unggulan: false,
    aktif: true,
    deskripsi:
      "Akun Spotify Premium untuk mendengarkan musik tanpa iklan dan tanpa batas lompat lagu. Detail login dikirim begitu pembayaran masuk.",
    ketentuanGaransi:
      "Garansi penggantian selama masa langganan bila akun tidak bisa dipakai. Hubungi kami lewat WhatsApp dengan Nomor Pesanan Anda.",
    formatItemStok: ["Email", "Password"],
    warnaFoto: [237, 144, 101], // persik
    varian: [
      { nama: "1 Bulan", hargaJual: 25000, hargaNormal: null, itemStok: [] },
    ],
  },
  {
    nama: "Uji Bayar",
    kategori: "Streaming",
    unggulan: false,
    aktif: true,
    deskripsi:
      "Produk untuk menguji pembayaran QRIS sungguhan sebesar Rp 1.000 ditambah Kode unik. Item stok-nya berupa kode contoh.",
    ketentuanGaransi: "Tanpa garansi.",
    formatItemStok: ["Kode"],
    warnaFoto: [117, 72, 242], // aksi
    varian: [
      {
        nama: "Standar",
        hargaJual: 1000,
        hargaNormal: null,
        itemStok: berurut(
          10,
          (nomor) => `UJIBAYAR-CONTOH-${String(nomor).padStart(2, "0")}`,
        ),
      },
    ],
  },
  {
    // Persiapan bersama tidak menyebut Varian untuk Game Lama, jadi Produk ini tanpa Varian.
    nama: "Game Lama",
    kategori: "Game",
    unggulan: false,
    aktif: false,
    deskripsi: "Akun game lama yang sudah tidak dijual.",
    ketentuanGaransi: "Tanpa garansi.",
    formatItemStok: ["Email", "Password"],
    warnaFoto: [98, 88, 121], // tinta-redup
    varian: [],
  },
];

/**
 * Pengaturan toko seed (PRD §9.8). Nomor WhatsApp ditulis seperti isian Admin, lalu dirapikan
 * rapikanNomorWhatsapp. Setiap baris teks menjadi satu paragraf di halamannya. [CONTOH]
 */
const PENGATURAN_TOKO = {
  nomorWhatsapp: "0812-0000-0000",
  syaratKetentuan: [
    "Teks contoh untuk UAT, bukan Syarat & Ketentuan sungguhan.",
    "Setiap Pesanan berisi satu Item stok yang dikirim otomatis begitu pembayaran QRIS masuk.",
    "Pastikan email yang Anda isi saat checkout benar, karena detail Pesanan dikirim ke email itu.",
    "Klaim garansi diajukan lewat WhatsApp dengan menyebut Nomor Pesanan, sesuai ketentuan garansi di Halaman Produk.",
  ].join("\n"),
  kebijakanPrivasi: [
    "Teks contoh untuk UAT, bukan Kebijakan Privasi sungguhan.",
    "Toko menyimpan email Anda untuk mengirim detail Pesanan dan menampilkan Riwayat Pesanan.",
    "Toko tidak membagikan email Anda kepada pihak lain di luar layanan pengiriman email dan pembayaran.",
  ].join("\n"),
};

type PesananSeed = {
  /** qris_id contoh, yang unik, sekaligus penanda Pesanan seed yang sudah ada. */
  qrisId: string;
  email: string;
  produk: string;
  varian: string;
  status: Extract<StatusPesanan, "Selesai" | "Bermasalah">;
  kodeUnik: number;
  /** Berapa menit sebelum seed dijalankan Pesanan ini dibuat. */
  menitLalu: number;
  /** Item stok yang Terkirim ke Pesanan Selesai, dalam bentuk baris tempelan. */
  itemStok?: string;
};

/**
 * Pesanan seed menurut "Persiapan bersama" di docs/UAT.md, tanpa voucher (M2). Pesanan Bermasalah meniru
 * pembayaran yang nominalnya kurang dari Total bayar (PRD §5.9), jadi tidak memegang Item stok dan Stok
 * Varian tetap utuh. [CONTOH]
 */
const PESANAN: PesananSeed[] = [
  {
    qrisId: "seed-uat-selesai",
    email: "member@miwe.example",
    produk: "Netflix Premium",
    varian: "1 Bulan",
    status: "Selesai",
    kodeUnik: 123,
    menitLalu: 90,
    itemStok: "netflix-d@miwe.example|sandi-contoh-d|Profil 1",
  },
  {
    qrisId: "seed-uat-bermasalah-1",
    email: "bermasalah-1@miwe.example",
    produk: "Netflix Premium",
    varian: "1 Bulan",
    status: "Bermasalah",
    kodeUnik: 200,
    menitLalu: 60,
  },
  {
    qrisId: "seed-uat-bermasalah-2",
    email: "bermasalah-2@miwe.example",
    produk: "Netflix Premium",
    varian: "1 Bulan",
    status: "Bermasalah",
    kodeUnik: 345,
    menitLalu: 30,
  },
];

/**
 * Gambar PNG berupa petak satu warna, buatan sendiri tanpa logo layanan pihak ketiga (docs/DESIGN.md,
 * Don'ts).
 */
function petakWarna({
  lebar,
  tinggi,
  warna,
}: {
  lebar: number;
  tinggi: number;
  warna: Rgb;
}) {
  // Setiap baris piksel diawali byte filter 0, lalu RGB setiap piksel.
  const baris = Buffer.alloc(1 + lebar * 3);
  for (let x = 0; x < lebar; x++) baris.set(warna, 1 + x * 3);
  const piksel = Buffer.concat(Array.from({ length: tinggi }, () => baris));

  const potongan = (jenis: string, isi: Buffer) => {
    const jenisDanIsi = Buffer.concat([Buffer.from(jenis, "ascii"), isi]);
    const panjang = Buffer.alloc(4);
    panjang.writeUInt32BE(isi.length);
    const cek = Buffer.alloc(4);
    cek.writeUInt32BE(crc32(jenisDanIsi));
    return Buffer.concat([panjang, jenisDanIsi, cek]);
  };
  const kepala = Buffer.alloc(13);
  kepala.writeUInt32BE(lebar, 0);
  kepala.writeUInt32BE(tinggi, 4);
  kepala[8] = 8; // 8 bit per warna
  kepala[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan("IHDR", kepala),
    potongan("IDAT", deflateSync(piksel)),
    potongan("IEND", Buffer.alloc(0)),
  ]);
}

const berkasPng = (isi: Buffer, nama: string) =>
  new File([new Uint8Array(isi)], nama, { type: "image/png" });

/** Jumlah data seed yang baru dibuat oleh satu kali jalan. */
type RingkasanSeed = {
  admin: number;
  kategori: number;
  produk: number;
  varian: number;
  itemStok: number;
  foto: number;
  pesanan: number;
  pengaturanToko: number;
};

function gagal(pesan: string): never {
  throw new Error(`Seed UAT berhenti: ${pesan}`);
}

const PESAN_KUNCI_BERMASALAH =
  "ITEM_STOK_KEY belum diisi atau tidak sah, jadi Item stok tidak bisa disimpan terenkripsi. Isi ITEM_STOK_KEY di .env dengan 32 byte acak dalam base64, lalu jalankan ulang `pnpm db:seed`.";

type KunciItemStok = Extract<
  ReturnType<typeof bacaKunciItemStok>,
  { hasil: "ada" }
>["kunci"];

/** Membuat Kategori seed yang belum ada. Hasilnya id setiap Kategori seed menurut namanya. */
async function isiKategori(ringkasan: RingkasanSeed) {
  for (const { nama, warnaIkon } of KATEGORI) {
    const ikon = berkasPng(
      petakWarna({ lebar: 96, tinggi: 96, warna: warnaIkon }),
      "ikon.png",
    );
    const hasil = await buatKategori({ nama, ikon });
    if (hasil.hasil === "dibuat") ringkasan.kategori++;
    if (hasil.hasil === "ditolak") {
      gagal(`ikon Kategori "${nama}" ditolak (${hasil.alasan}).`);
    }
  }
  const semua = await daftarKategori();
  return new Map(
    KATEGORI.map(({ nama }) => {
      const ada = semua.find((k) => namaKategoriDipakai(nama, [k.nama]));
      if (!ada) gagal(`Kategori "${nama}" tidak ditemukan setelah dibuat.`);
      return [nama, ada.id];
    }),
  );
}

/** Id Produk bernama itu, atau undefined bila belum ada. */
async function idProduk(nama: string) {
  return (await daftarProduk()).find((p) => p.nama === nama)?.id;
}

/**
 * Membuat Produk seed yang belum ada, lalu foto contohnya bila Produk itu belum punya foto. Hasilnya id
 * Produk itu.
 */
async function isiProduk(
  p: ProdukSeed,
  idKategori: Map<string, string>,
  ringkasan: RingkasanSeed,
) {
  let id = await idProduk(p.nama);
  if (id === undefined) {
    const format = periksaFormatItemStok(p.formatItemStok);
    if (!format.sah) gagal(`Format Item stok "${p.nama}" ditolak.`);
    const kategoriId = idKategori.get(p.kategori);
    if (kategoriId === undefined) {
      gagal(
        `Kategori "${p.kategori}" untuk Produk "${p.nama}" bukan Kategori seed.`,
      );
    }
    const hasil = await buatProduk({
      nama: p.nama,
      kategoriId,
      deskripsi: p.deskripsi,
      ketentuanGaransi: p.ketentuanGaransi,
      unggulan: p.unggulan,
      aktif: p.aktif,
      formatItemStok: format.kolom,
    });
    if (hasil.hasil !== "dibuat") {
      gagal(`Kategori "${p.kategori}" untuk Produk "${p.nama}" tidak ada.`);
    }
    ringkasan.produk++;
    id = await idProduk(p.nama);
    if (id === undefined) gagal(`Produk "${p.nama}" tidak ditemukan.`);
  }

  if ((await bacaProduk(id))?.foto.length === 0) {
    const foto = berkasPng(
      petakWarna({ lebar: 800, tinggi: 600, warna: p.warnaFoto }),
      "foto.png",
    );
    const hasil = await unggahFotoProduk({ produkId: id, foto });
    if (hasil.hasil !== "diunggah") {
      gagal(`foto contoh Produk "${p.nama}" ditolak (${hasil.hasil}).`);
    }
    ringkasan.foto++;
  }
  return id;
}

/**
 * Membuat Varian seed yang belum ada di Produk itu, lalu menempel Item stok seed-nya. Item stok yang isinya
 * sudah ada di Varian itu ditolak tempelan sebagai kembar (PRD §4.2), jadi tidak tergandakan.
 */
async function isiVarian(
  produkId: string,
  p: ProdukSeed,
  ringkasan: RingkasanSeed,
) {
  const ada = await daftarVarian(produkId);
  for (const v of p.varian) {
    if (ada.some((lama) => lama.nama === v.nama)) continue;
    if (!periksaHarga(v).valid) {
      gagal(`harga Varian "${p.nama} ${v.nama}" ditolak.`);
    }
    await tambahVarian({
      produkId,
      nama: v.nama,
      hargaJual: v.hargaJual,
      hargaNormal: v.hargaNormal,
      aktif: true,
    });
    ringkasan.varian++;
  }

  const semua = await daftarVarian(produkId);
  for (const v of p.varian) {
    if (v.itemStok.length === 0) continue;
    const varianId = semua.find((lama) => lama.nama === v.nama)?.id;
    if (varianId === undefined) {
      gagal(`Varian "${p.nama} ${v.nama}" tidak ditemukan setelah dibuat.`);
    }
    await tempelSeed({ produkId, varianId, baris: v.itemStok }, ringkasan);
  }
}

/**
 * Menempel baris Item stok seed ke Varian itu lewat tempelan Admin (PRD §4.2), sehingga Item stok disimpan
 * terenkripsi (PRD §12). Baris yang isinya sudah ada di Varian itu ditolak sebagai kembar.
 */
async function tempelSeed(
  {
    produkId,
    varianId,
    baris,
  }: { produkId: string; varianId: string; baris: string[] },
  ringkasan: RingkasanSeed,
) {
  const hasil = await tempelItemStokVarian({
    produkId,
    varianId,
    teks: baris.join("\n"),
  });
  if (hasil.hasil === "kunci-bermasalah") gagal(PESAN_KUNCI_BERMASALAH);
  if (hasil.hasil === "varian-tidak-ada") {
    gagal(`Varian untuk Item stok "${baris[0]}" tidak ditemukan.`);
  }
  ringkasan.itemStok += hasil.tempel.tersimpan.length;
}

/** Pelaku di Riwayat status Pesanan, sama dengan checkout (pesanan.ts) dan kabar pembayaran Qrispy. */
const PELAKU_CHECKOUT = "Pembeli";
const PELAKU_KABAR_PEMBAYARAN = "Qrispy";

/** Gambar QR pengganti untuk Pesanan seed, karena QRIS-nya bukan terbitan Qrispy. */
const GAMBAR_QR_SEED = `data:image/png;base64,${petakWarna({ lebar: 1, tinggi: 1, warna: [255, 255, 255] }).toString("base64")}`;

/**
 * Membuat Pesanan seed yang belum ada. Pesanan seed dikenali dari qris_id-nya, yang unik. Setiap Pesanan
 * mencatat Riwayat status seperti Pesanan sungguhan: Menunggu Pembayaran oleh Pembeli saat dibuat, lalu
 * status akhirnya oleh kabar pembayaran Qrispy dua menit kemudian. Pesanan Selesai mendapat satu Item stok
 * Terkirim yang mencatat nama kolom Format Item stok saat itu (PRD §4.1). Email "Pesanan selesai" tidak
 * dijadwalkan, karena email Pesanan seed bukan email sungguhan.
 */
async function isiPesanan(kunci: KunciItemStok, ringkasan: RingkasanSeed) {
  const sekarang = Date.now();
  for (const p of PESANAN) {
    const [ada] = await db
      .select({ id: pesanan.id })
      .from(pesanan)
      .where(eq(pesanan.qrisId, p.qrisId));
    if (ada) continue;

    const produkId = await idProduk(p.produk);
    if (produkId === undefined) {
      gagal(`Produk "${p.produk}" untuk Pesanan seed tidak ada.`);
    }
    const produkDipesan = await bacaProduk(produkId);
    const dipesan = (await daftarVarian(produkId)).find(
      (v) => v.nama === p.varian,
    );
    if (!dipesan || !produkDipesan) {
      gagal(`Varian "${p.produk} ${p.varian}" untuk Pesanan seed tidak ada.`);
    }
    if (p.itemStok) {
      await tempelSeed(
        { produkId, varianId: dipesan.id, baris: [p.itemStok] },
        ringkasan,
      );
    }

    const dibuat = new Date(sekarang - p.menitLalu * 60_000);
    const dibayar = new Date(dibuat.getTime() + 2 * 60_000);
    const rincian = totalBayar({
      hargaJual: dipesan.hargaJual,
      potonganVoucher: 0,
      kodeUnik: p.kodeUnik,
    });
    await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(pesanan)
        .values({
          nomorPesanan: nomorPesanan(randomBytes(6)),
          // Tautan Pesanan (PRD §6.2): 32 byte acak dalam base64url, seperti di pesanan.ts.
          tautan: randomBytes(32).toString("base64url"),
          email: p.email,
          varianId: dipesan.id,
          hargaJual: rincian.hargaJual,
          potonganVoucher: rincian.potonganVoucher,
          kodeUnik: rincian.kodeUnik,
          totalBayar: rincian.totalBayar,
          qrisId: p.qrisId,
          kedaluwarsaPada: new Date(dibuat.getTime() + 15 * 60_000),
          gambarQr: GAMBAR_QR_SEED,
          status: p.status,
          waktuBayar: dibayar,
        })
        .returning({ id: pesanan.id });
      await tx.insert(riwayatStatusPesanan).values([
        {
          pesananId: id,
          waktu: dibuat,
          status: "Menunggu Pembayaran",
          pelaku: PELAKU_CHECKOUT,
        },
        {
          pesananId: id,
          waktu: dibayar,
          status: p.status,
          pelaku: PELAKU_KABAR_PEMBAYARAN,
        },
      ]);

      if (!p.itemStok) return;
      const nilai = p.itemStok.split("|").map((kolom) => kolom.trim());
      const terkirim = await tx
        .update(itemStok)
        .set({
          status: "Terkirim",
          pesananId: id,
          formatSaatTerkirim: produkDipesan.formatItemStok,
        })
        .where(
          and(
            eq(itemStok.varianId, dipesan.id),
            eq(itemStok.sidikJari, sidikJariItemStok(kunci, nilai)),
            eq(itemStok.status, "Tersedia"),
          ),
        )
        .returning({ id: itemStok.id });
      if (terkirim.length === 0) {
        gagal(
          `Item stok "${p.itemStok}" untuk Pesanan seed ${p.email} tidak Tersedia lagi. Hapus Pesanan yang memakainya, atau ganti isi Item stok itu di src/server/seed-uat.ts, lalu jalankan ulang \`pnpm db:seed\`.`,
        );
      }
    });
    ringkasan.pesanan++;
  }
}

/**
 * Mengisi database dengan data seed UAT M1 yang belum ada. Hasilnya jumlah data yang baru dibuat. Melempar
 * galat yang menyebut sebabnya bila ada data seed yang ditolak.
 */
export async function isiSeedUat(): Promise<RingkasanSeed> {
  // Diperiksa sebelum ada data yang ditulis, karena tanpa kunci ini Item stok tidak bisa disimpan.
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") gagal(PESAN_KUNCI_BERMASALAH);

  const ringkasan = {
    admin: 0,
    kategori: 0,
    produk: 0,
    varian: 0,
    itemStok: 0,
    foto: 0,
    pesanan: 0,
    pengaturanToko: 0,
  };
  // Admin yang emailnya sudah dipakai dilewati.
  if ((await buatAdmin(ADMIN_SEED)).hasil === "dibuat") ringkasan.admin++;
  const idKategori = await isiKategori(ringkasan);
  for (const p of PRODUK) {
    const produkId = await isiProduk(p, idKategori, ringkasan);
    await isiVarian(produkId, p, ringkasan);
  }
  await isiPesanan(kunci.kunci, ringkasan);

  // Pengaturan toko hanya diisi selama masih kosong, supaya isian pemilik tidak tertimpa.
  const pengaturan = await bacaPengaturanToko();
  if (
    pengaturan.nomorWhatsapp === null &&
    pengaturan.syaratKetentuan === "" &&
    pengaturan.kebijakanPrivasi === ""
  ) {
    const nomor = rapikanNomorWhatsapp({
      isian: PENGATURAN_TOKO.nomorWhatsapp,
    });
    if (!nomor.sah) gagal(`nomor WhatsApp contoh ditolak (${nomor.alasan}).`);
    await simpanPengaturanToko({
      ...PENGATURAN_TOKO,
      nomorWhatsapp: nomor.nomor,
    });
    ringkasan.pengaturanToko++;
  }
  return ringkasan;
}
