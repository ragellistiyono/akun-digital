// Data seed UAT lokal untuk `pnpm db:seed` (scripts/db-seed.mts): isi "Persiapan bersama" di docs/UAT.md,
// termasuk Member dan Voucher (docs/UAT.md ▶ Keputusan 2026-11-17). Seed ini hanya untuk komputer lokal; UAT di
// server produksi dijalankan tanpa seed. Semua nilai di berkas ini contoh [CONTOH], bukan aturan.
//
// Data ditulis lewat fungsi server yang sama dengan dasbor admin, supaya melewati aturan yang sama: nama
// Kategori unik, Format Item stok dan harga diperiksa domain, gambar diperiksa simpanGambar, dan Item stok
// disimpan terenkripsi seperti Item stok yang ditempel Admin (PRD §12).
//
// Seed boleh dijalankan ulang tanpa menggandakan data. Data seed yang sudah ada dikenali dari email Admin dan
// Member, nama Kategori, nama Produk, nama Varian di Produknya, isi Item stok di Variannya, kode Voucher,
// qris_id Pesanan dan Top up seed, serta tanggal dan keterangan Biaya operasional, lalu dilewati. Foto contoh hanya diunggah ke Produk yang belum punya foto, dan
// Pengaturan toko hanya diisi selama masih kosong. Data yang sudah ada tidak diubah, jadi perubahan pemilik
// selama UAT tetap tersimpan. Akibatnya Pesanan Selesai seed yang dibuat sebelum T60, tanpa voucher, tetap
// tanpa voucher; kosongkan database lokal lalu jalankan ulang seed untuk mendapat Pesanan Selesai dengan HEMAT5.
import { randomBytes } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import { and, eq } from "drizzle-orm";

import { periksaIsianBiayaOperasional } from "@/domain/biaya-operasional";
import {
  biayaTransaksi,
  MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL,
  PERSEN_BIAYA_TRANSAKSI_AWAL,
} from "@/domain/biaya-transaksi";
import { periksaFormatItemStok } from "@/domain/format-item-stok";
import { periksaHargaModal } from "@/domain/harga-modal";
import { periksaIsianVoucher } from "@/domain/isian-voucher";
import { tempelItemStok } from "@/domain/item-stok";
import { emailBaku } from "@/domain/kesamaan-email";
import { namaKategoriDipakai } from "@/domain/nama-kategori";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import { nomorTopUp } from "@/domain/nomor-top-up";
import { rapikanNomorWhatsapp } from "@/domain/nomor-whatsapp";
import { potonganVoucher } from "@/domain/potongan-voucher";
import type { StatusPesanan } from "@/domain/status-pesanan";
import { totalBayar } from "@/domain/total-bayar";
import { periksaHarga } from "@/domain/validasi-harga";

import { auth } from "./auth/auth";
import { buatAdmin } from "./auth/buat-admin";
import { tulisAkun } from "./auth/sisipkan-akun";
import { BATAS_UKURAN_GAMBAR_MB } from "./berkas-unggahan";
import {
  daftarBiayaOperasional,
  tambahBiayaOperasional,
} from "./biaya-operasional";
import { db } from "./db";
import {
  itemStok,
  pesanan,
  riwayatSaldo,
  riwayatStatusPesanan,
  riwayatStatusTopUp,
  topUp,
  user,
  varian,
  voucher,
} from "./db/schema";
import { bacaKunciItemStok, sidikJariItemStok } from "./enkripsi-item-stok";
import { unggahFotoProduk } from "./foto-produk";
import { tempelItemStokVarian } from "./item-stok";
import { buatKategori, daftarKategori } from "./kategori";
import {
  bacaPengaturanBiayaTransaksi,
  bacaPengaturanToko,
  simpanPengaturanToko,
} from "./pengaturan-toko";
import { bacaProduk, buatProduk, daftarProduk } from "./produk";
import { riwayatSaldoMember, ubahSaldoOlehAdmin } from "./saldo";
import { daftarVarian, tambahVarian } from "./varian";
import { buatVoucher, type SyaratVoucher } from "./voucher";
import { tanggalIsianWib } from "./zona-waktu-toko";

/**
 * Admin seed. Password-nya sengaja ditulis di sini supaya pemilik bisa login saat UAT (docs/UAT.md,
 * "Persiapan bersama"). [CONTOH]
 */
export const ADMIN_SEED = {
  email: "admin@miwe.example",
  password: "sandi-contoh-admin-uat",
};

/**
 * Member seed, keduanya sudah diverifikasi: satu aktif dan satu nonaktif (PRD §2.3). Password-nya sengaja
 * ditulis di sini supaya pemilik bisa login saat UAT (docs/UAT.md, "Persiapan bersama"). [CONTOH]
 */
export const MEMBER_SEED = {
  aktif: { email: "member@miwe.example", password: "sandi-contoh-member-uat" },
  nonaktif: {
    email: "nonaktif@miwe.example",
    password: "sandi-contoh-nonaktif-uat",
  },
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
  /**
   * Harga modal dari persiapan M4 di docs/UAT.md (▶ Keputusan 2026-11-20), atau null untuk Varian yang meniru
   * Varian sebelum fitur Harga modal tayang (PRD §14.1).
   */
  hargaModal: number | null;
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
  /**
   * Batas per Member bila Produk ini Produk gratis (PRD §16.1, §16.2), dari persiapan M6 di docs/UAT.md (▶ Keputusan
   * 2026-11-22), atau null bila bukan Produk gratis.
   */
  batasPerMember: number | null;
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
    batasPerMember: null,
    warnaFoto: [91, 74, 146], // langit-garis
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 50000,
        hargaNormal: 75000,
        hargaModal: 35000,
        // Dua login Netflix yang dipakai bersama, masing-masing lima profil: satu Item stok untuk satu
        // profil (PRD §4.3).
        itemStok: ["a", "b"].flatMap((login) =>
          berurut(
            5,
            (nomor) =>
              `netflix-${login}@miwe.example|sandi-contoh-${login}|Profil ${nomor}`,
          ),
        ),
      },
      {
        nama: "3 Bulan",
        hargaJual: 135000,
        hargaNormal: null,
        hargaModal: 100000,
        itemStok: [
          ...berurut(
            4,
            (nomor) => `netflix-c@miwe.example|sandi-contoh-c|Profil ${nomor}`,
          ),
          // Persiapan M6 di docs/UAT.md (▶ Keputusan 2026-11-22): Item stok yang ditempel ulang di Varian lain
          // pada UAT-D5, dan ditolak sebagai Item stok kembar.
          "uji-kembar@mail.com|pass9|Profil 1",
        ],
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
    batasPerMember: null,
    warnaFoto: [235, 201, 103], // matahari
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 20000,
        hargaNormal: null,
        hargaModal: 14000,
        itemStok: [],
      },
      {
        nama: "3 Bulan",
        hargaJual: 55000,
        hargaNormal: null,
        hargaModal: 40000,
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
    batasPerMember: null,
    warnaFoto: [237, 144, 101], // persik
    varian: [
      {
        nama: "1 Bulan",
        hargaJual: 25000,
        hargaNormal: null,
        hargaModal: 18000,
        itemStok: [],
      },
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
    batasPerMember: null,
    warnaFoto: [117, 72, 242], // aksi
    varian: [
      {
        nama: "Standar",
        hargaJual: 1000,
        hargaNormal: null,
        // Sengaja tanpa Harga modal, supaya UAT-N3 bisa menguji pengisian Harga modal pertama.
        hargaModal: null,
        itemStok: berurut(
          10,
          (nomor) => `UJIBAYAR-CONTOH-${String(nomor).padStart(2, "0")}`,
        ),
      },
    ],
  },
  {
    // Persiapan M6 di docs/UAT.md (▶ Keputusan 2026-11-22): Produk gratis untuk UAT-P1 sampai UAT-P5.
    nama: "Akun Uji Gratis",
    kategori: "Streaming",
    unggulan: false,
    aktif: true,
    deskripsi:
      "Produk gratis untuk menguji pengambilan Produk gratis oleh Member. Item stok-nya berupa akun contoh.",
    ketentuanGaransi: "Tanpa garansi.",
    formatItemStok: ["Email", "Password"],
    batasPerMember: 2,
    warnaFoto: [24, 96, 62], // st-selesai
    varian: [
      {
        nama: "Akun Baru",
        hargaJual: 1000,
        hargaNormal: 15000,
        hargaModal: 0,
        itemStok: [
          // Item stok yang ditempel ulang dengan ejaan lain pada UAT-D5.
          "budi.santoso@mail.com|rahasia1",
          ...berurut(
            4,
            (nomor) =>
              `gratis-${nomor}@miwe.example|sandi-contoh-gratis-${nomor}`,
          ),
        ],
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
    batasPerMember: null,
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
  // Persiapan bersama docs/UAT.md: Ambang stok menipis 5.
  ambangStokMenipis: 5,
};

/** Satu hari dalam milidetik, untuk masa berlaku Voucher LAMA. */
const SEHARI_MS = 24 * 60 * 60_000;
const SATU_MENIT_MS = 60_000;

/** Syarat Voucher yang tidak disebut di daftar Voucher seed: kosong, kecuali Batas per email bawaan. */
const TANPA_SYARAT: SyaratVoucher = {
  jenisPotongan: "nominal",
  nilai: 0,
  batasMaksimum: null,
  kuotaVoucher: null,
  // Nilai bawaan Batas per email (PRD §8.4), sama seperti form Voucher baru.
  batasPerEmail: 1,
  minimalHargaJual: null,
  mulai: null,
  berakhir: null,
  cakupan: { jenis: "semua" },
  khususMember: false,
  aktif: true,
};

/**
 * Voucher seed menurut "Persiapan bersama" di docs/UAT.md, dibuat sesuai urutan daftarnya. Masa berlaku LAMA
 * berakhir sehari sebelum `sekarang`, dibulatkan ke bawah ke menit seperti isian dasbor admin (PRD §8.4).
 * Potongan LAMA dan MATI tidak disebut di sana, jadi memakai nominal Rp 5.000 seperti HEMAT5. [CONTOH]
 */
function voucherSeed(sekarang: number): (SyaratVoucher & { kode: string })[] {
  const kemarin =
    Math.floor((sekarang - SEHARI_MS) / SATU_MENIT_MS) * SATU_MENIT_MS;
  return [
    { ...TANPA_SYARAT, kode: "HEMAT5", nilai: 5000 },
    {
      ...TANPA_SYARAT,
      kode: "HEMAT10",
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      minimalHargaJual: 50000,
    },
    {
      ...TANPA_SYARAT,
      kode: "MEMBER20",
      jenisPotongan: "persen",
      nilai: 20,
      khususMember: true,
    },
    { ...TANPA_SYARAT, kode: "SATUKALI", nilai: 2000, kuotaVoucher: 1 },
    {
      ...TANPA_SYARAT,
      kode: "LAMA",
      nilai: 5000,
      berakhir: new Date(kemarin),
    },
    { ...TANPA_SYARAT, kode: "MATI", nilai: 5000, aktif: false },
  ];
}

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
  /** Kode Voucher seed yang dipakai Pesanan ini. */
  voucher?: string;
};

/**
 * Pesanan seed menurut "Persiapan bersama" di docs/UAT.md. Pesanan Selesai memakai HEMAT5 (docs/UAT.md ▶
 * Keputusan 2026-11-17), sehingga email itu sudah memakai Batas per email HEMAT5. Pesanan Bermasalah meniru
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
    voucher: "HEMAT5",
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
  member: number;
  voucher: number;
  kategori: number;
  produk: number;
  varian: number;
  itemStok: number;
  foto: number;
  pesanan: number;
  pengaturanToko: number;
  biayaOperasional: number;
  saldo: number;
  topUp: number;
};

/** Menghentikan seed dengan pesan yang menyebut sebabnya dan langkah berikutnya. */
function gagal(sebab: string, langkah: string): never {
  throw new Error(`Seed UAT berhenti: ${sebab} ${langkah}`);
}

/** Langkah berikutnya bila data seed di berkas ini ditolak aturan toko. */
const PERBAIKI_DATA_SEED =
  "Perbaiki data seed itu di src/server/seed-uat.ts, lalu jalankan ulang `pnpm db:seed`.";

/**
 * Langkah berikutnya bila data seed hilang di tengah jalan, misalnya diubah atau dihapus di dasbor admin
 * selama seed berjalan. Seed berikutnya membuat lagi data seed yang belum ada.
 */
const JALANKAN_ULANG =
  "Data itu mungkin diubah atau dihapus selama seed berjalan. Jalankan ulang `pnpm db:seed`; data seed yang belum ada akan dibuat lagi.";

const SEBAB_KUNCI_BERMASALAH =
  "ITEM_STOK_KEY belum diisi atau tidak sah, jadi Item stok tidak bisa disimpan terenkripsi.";
const LANGKAH_KUNCI_BERMASALAH =
  "Isi ITEM_STOK_KEY di .env dengan 32 byte acak dalam base64, lalu jalankan ulang `pnpm db:seed`.";

/** Sebab gambar contoh ditolak simpanGambar, untuk pesan galat. */
const ALASAN_GAMBAR_DITOLAK = {
  "bukan-gambar": "bukan gambar PNG, JPEG, atau WebP",
  "terlalu-besar": `lebih besar dari ${BATAS_UKURAN_GAMBAR_MB} MB`,
} as const;

type KunciItemStok = Extract<
  ReturnType<typeof bacaKunciItemStok>,
  { hasil: "ada" }
>["kunci"];

/**
 * Membuat Member seed yang emailnya belum dipakai, terverifikasi dan langsung bisa login seperti Member yang
 * mendaftar (tulisAkun). Member nonaktif ditulis beserta tanda nonaktifnya dalam transaksi yang sama.
 */
async function isiMember(ringkasan: RingkasanSeed) {
  const konteks = await auth.$context;
  for (const [jenis, { email, password }] of Object.entries(MEMBER_SEED)) {
    const emailMember = emailBaku(email);
    const [ada] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailMember));
    if (ada) continue;

    const hash = await konteks.password.hash(password);
    await db.transaction(async (tx) => {
      const id = await tulisAkun(tx, {
        email: emailMember,
        hash,
        peran: "Member",
      });
      if (jenis === "nonaktif") {
        await tx.update(user).set({ nonaktif: true }).where(eq(user.id, id));
      }
    });
    ringkasan.member++;
  }
}

/**
 * Membuat Voucher seed yang kodenya belum dipakai, lewat buatVoucher seperti form Voucher dasbor admin. Isiannya
 * diperiksa periksaIsianVoucher lebih dulu, seperti Server Action form itu. Voucher yang kodenya sudah ada
 * ditolak buatVoucher sebagai kembar, lalu dilewati tanpa diubah.
 */
async function isiVoucher(sekarang: number, ringkasan: RingkasanSeed) {
  for (const { kode, khususMember, aktif, ...isian } of voucherSeed(sekarang)) {
    const periksa = periksaIsianVoucher(isian);
    if (!periksa.sah) {
      gagal(
        `Isian Voucher seed ${kode} ditolak aturan isian Voucher PRD §8.4 dengan alasan ${periksa.galat.join(", ")}.`,
        PERBAIKI_DATA_SEED,
      );
    }
    const hasil = await buatVoucher({ kode, khususMember, aktif, ...isian });
    if (hasil.hasil === "dibuat") ringkasan.voucher++;
    if (hasil.hasil === "kode-ditolak" && hasil.alasan !== "kembar") {
      gagal(
        `Kode Voucher seed ${kode} ditolak aturan kode Voucher PRD §8.4 dengan alasan ${hasil.alasan}.`,
        PERBAIKI_DATA_SEED,
      );
    }
  }
}

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
      gagal(
        `Ikon contoh Kategori "${nama}" ditolak karena ${ALASAN_GAMBAR_DITOLAK[hasil.alasan]}.`,
        PERBAIKI_DATA_SEED,
      );
    }
  }
  const semua = await daftarKategori();
  return new Map(
    KATEGORI.map(({ nama }) => {
      const ada = semua.find((k) => namaKategoriDipakai(nama, [k.nama]));
      if (!ada) {
        gagal(
          `Kategori "${nama}" tidak ditemukan setelah dibuat.`,
          JALANKAN_ULANG,
        );
      }
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
    if (!format.sah) {
      gagal(
        `Format Item stok Produk "${p.nama}" ditolak: Format harus punya minimal satu kolom, dan nama kolomnya tidak boleh kosong atau kembar (PRD §4.1).`,
        PERBAIKI_DATA_SEED,
      );
    }
    const kategoriId = idKategori.get(p.kategori);
    if (kategoriId === undefined) {
      gagal(
        `Produk "${p.nama}" memakai Kategori "${p.kategori}", yang tidak ada di daftar Kategori seed.`,
        PERBAIKI_DATA_SEED,
      );
    }
    const hasil = await buatProduk({
      nama: p.nama,
      kategoriId,
      deskripsi: p.deskripsi,
      ketentuanGaransi: p.ketentuanGaransi,
      unggulan: p.unggulan,
      aktif: p.aktif,
      // Produk gratis seed ditandai hanya saat dibuat, supaya centang yang dilepas Admin saat UAT-P4 tidak dipasang
      // lagi oleh seed berikutnya.
      gratis: p.batasPerMember !== null,
      batasPerMember: p.batasPerMember,
      formatItemStok: format.kolom,
    });
    if (hasil.hasil !== "dibuat") {
      gagal(
        `Kategori "${p.kategori}" hilang sebelum Produk "${p.nama}" tersimpan.`,
        JALANKAN_ULANG,
      );
    }
    ringkasan.produk++;
    id = await idProduk(p.nama);
    if (id === undefined) {
      gagal(
        `Produk "${p.nama}" tidak ditemukan setelah dibuat.`,
        JALANKAN_ULANG,
      );
    }
  }

  if ((await bacaProduk(id))?.foto.length === 0) {
    const foto = berkasPng(
      petakWarna({ lebar: 800, tinggi: 600, warna: p.warnaFoto }),
      "foto.png",
    );
    const hasil = await unggahFotoProduk({ produkId: id, foto });
    if (hasil.hasil === "ditolak") {
      gagal(
        `Foto contoh Produk "${p.nama}" ditolak karena ${ALASAN_GAMBAR_DITOLAK[hasil.alasan]}.`,
        PERBAIKI_DATA_SEED,
      );
    }
    if (hasil.hasil === "tidak-ada") {
      gagal(
        `Produk "${p.nama}" hilang sebelum foto contohnya tersimpan.`,
        JALANKAN_ULANG,
      );
    }
    if (hasil.hasil === "melebihi-batas") {
      gagal(
        `Produk "${p.nama}" sudah punya ${hasil.batas} foto sebelum foto contohnya tersimpan.`,
        JALANKAN_ULANG,
      );
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
    const harga = periksaHarga(v);
    if (!harga.valid) {
      gagal(
        `Harga Varian "${p.nama} ${v.nama}" ditolak aturan harga PRD §3.2 dan §3.5 dengan alasan ${harga.alasan}.`,
        PERBAIKI_DATA_SEED,
      );
    }
    const isian = {
      produkId,
      nama: v.nama,
      hargaJual: v.hargaJual,
      hargaNormal: v.hargaNormal,
      aktif: true,
    };
    if (v.hargaModal === null) {
      // Form Varian dan tambahVarian selalu meminta Harga modal, jadi Varian tanpa Harga modal, seperti
      // Varian yang dibuat sebelum fitur ini tayang, ditulis langsung.
      await db.insert(varian).values(isian);
    } else {
      const modal = periksaHargaModal({
        hargaModal: v.hargaModal,
        hargaJual: v.hargaJual,
      });
      if (!modal.valid) {
        gagal(
          `Harga modal Varian "${p.nama} ${v.nama}" ditolak aturan Harga modal PRD §14.1 dengan alasan ${modal.alasan}.`,
          PERBAIKI_DATA_SEED,
        );
      }
      await tambahVarian({ ...isian, hargaModal: v.hargaModal });
    }
    ringkasan.varian++;
  }

  const semua = await daftarVarian(produkId);
  for (const v of p.varian) {
    if (v.itemStok.length === 0) continue;
    const varianId = semua.find((lama) => lama.nama === v.nama)?.id;
    if (varianId === undefined) {
      gagal(
        `Varian "${p.nama} ${v.nama}" tidak ditemukan setelah dibuat.`,
        JALANKAN_ULANG,
      );
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
  if (hasil.hasil === "kunci-bermasalah") {
    gagal(SEBAB_KUNCI_BERMASALAH, LANGKAH_KUNCI_BERMASALAH);
  }
  if (hasil.hasil === "varian-tidak-ada") {
    gagal(
      `Varian untuk Item stok "${baris[0]}" hilang sebelum Item stok itu tersimpan.`,
      JALANKAN_ULANG,
    );
  }
  ringkasan.itemStok += hasil.tempel.tersimpan.length;
}

/** Voucher seed dengan kode itu, untuk Pesanan seed milik `email` yang memakainya. */
async function voucherLewatKode(kode: string, email: string) {
  const [ada] = await db.select().from(voucher).where(eq(voucher.kode, kode));
  if (!ada) {
    gagal(
      `Voucher ${kode} untuk Pesanan seed ${email} tidak ditemukan.`,
      "Pastikan kode itu ada di daftar Voucher seed di src/server/seed-uat.ts, lalu jalankan ulang `pnpm db:seed`; data seed yang belum ada akan dibuat lagi.",
    );
  }
  return ada;
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
async function isiPesanan(
  kunci: KunciItemStok,
  sekarang: number,
  ringkasan: RingkasanSeed,
) {
  for (const p of PESANAN) {
    const [ada] = await db
      .select({ id: pesanan.id })
      .from(pesanan)
      .where(eq(pesanan.qrisId, p.qrisId));
    if (ada) continue;

    const produkId = await idProduk(p.produk);
    const produkDipesan = produkId && (await bacaProduk(produkId));
    const dipesan =
      produkId &&
      (await daftarVarian(produkId)).find((v) => v.nama === p.varian);
    if (!produkId || !produkDipesan || !dipesan) {
      gagal(
        `Varian "${p.produk} ${p.varian}" untuk Pesanan seed ${p.email} tidak ditemukan.`,
        "Pastikan Produk dan Varian itu ada di daftar Produk seed di src/server/seed-uat.ts, lalu jalankan ulang `pnpm db:seed`; data seed yang belum ada akan dibuat lagi.",
      );
    }

    // Isi kolom Item stok Terkirim, dipisah dan dirapikan seperti tempelan Admin (PRD §4.2).
    let nilaiTerkirim: string[] | undefined;
    if (p.itemStok) {
      [nilaiTerkirim] = tempelItemStok({
        kolom: produkDipesan.formatItemStok,
        teks: p.itemStok,
        itemStokSama: () => [],
      }).tersimpan;
      if (!nilaiTerkirim) {
        gagal(
          `Item stok "${p.itemStok}" untuk Pesanan seed ${p.email} tidak cocok dengan Format Item stok ${p.produk}.`,
          PERBAIKI_DATA_SEED,
        );
      }
      await tempelSeed(
        { produkId, varianId: dipesan.id, baris: [p.itemStok] },
        ringkasan,
      );
    }

    const voucherDipakai = p.voucher
      ? await voucherLewatKode(p.voucher, p.email)
      : null;

    const dibuat = new Date(sekarang - p.menitLalu * 60_000);
    const dibayar = new Date(dibuat.getTime() + 2 * 60_000);
    const rincian = totalBayar({
      hargaJual: dipesan.hargaJual,
      potonganVoucher: voucherDipakai
        ? potonganVoucher({
            hargaJual: dipesan.hargaJual,
            voucher: voucherDipakai,
          }).potonganVoucher
        : 0,
      kodeUnik: p.kodeUnik,
    });
    // Semua Pesanan seed sudah dibayar, jadi Biaya transaksi-nya dicatat dari Pengaturan toko saat itu, seperti
    // pemroses kabar pembayaran (PRD §14.3).
    const biaya = biayaTransaksi({
      totalBayar: rincian.totalBayar,
      ...(await bacaPengaturanBiayaTransaksi()),
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
          // Harga modal Varian saat Pesanan dibuat, seperti checkout (PRD §14.1).
          hargaModal: dipesan.hargaModal,
          potonganVoucher: rincian.potonganVoucher,
          kodeUnik: rincian.kodeUnik,
          totalBayar: rincian.totalBayar,
          biayaTransaksi: biaya.biayaTransaksi,
          qrisId: p.qrisId,
          kedaluwarsaPada: new Date(dibuat.getTime() + 15 * 60_000),
          gambarQr: GAMBAR_QR_SEED,
          status: p.status,
          waktuBayar: dibayar,
          voucherId: voucherDipakai?.id ?? null,
          kodeVoucher: voucherDipakai?.kode ?? null,
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

      if (!nilaiTerkirim) return;
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
            eq(itemStok.sidikJari, sidikJariItemStok(kunci, nilaiTerkirim)),
            eq(itemStok.status, "Tersedia"),
          ),
        )
        .returning({ id: itemStok.id });
      if (terkirim.length === 0) {
        gagal(
          `Item stok "${p.itemStok}" untuk Pesanan seed ${p.email} tidak Tersedia lagi.`,
          "Hapus Pesanan yang memakainya, atau ganti isi Item stok itu di src/server/seed-uat.ts, lalu jalankan ulang `pnpm db:seed`.",
        );
      }
    });
    ringkasan.pesanan++;
  }
}

/** Biaya operasional seed dari persiapan M4 di docs/UAT.md (▶ Keputusan 2026-11-20). [CONTOH] */
const BIAYA_OPERASIONAL_SEED = { keterangan: "Sewa server", nominal: 150_000 };

/**
 * Mencatat Biaya operasional "Sewa server" bertanggal 1 pada bulan seed dijalankan menurut zona waktu toko, bila
 * bulan itu belum punya biaya dengan keterangan yang sama. Isiannya diperiksa periksaIsianBiayaOperasional lebih
 * dulu, seperti Server Action form Biaya operasional.
 */
async function isiBiayaOperasional(sekarang: number, ringkasan: RingkasanSeed) {
  const hariIni = tanggalIsianWib(new Date(sekarang));
  const bulan = hariIni.slice(0, 7);
  const tanggal = `${bulan}-01`;
  const periksa = periksaIsianBiayaOperasional({
    hariIni,
    tanggal,
    ...BIAYA_OPERASIONAL_SEED,
  });
  if (!periksa.valid || periksa.keteranganTersimpan === null) {
    gagal(
      `Biaya operasional seed "${BIAYA_OPERASIONAL_SEED.keterangan}" ditolak aturan isian Biaya operasional PRD §14.4.`,
      PERBAIKI_DATA_SEED,
    );
  }
  const keterangan = periksa.keteranganTersimpan;
  const { biaya } = await daftarBiayaOperasional(bulan);
  if (biaya.some((b) => b.tanggal === tanggal && b.keterangan === keterangan)) {
    return;
  }
  await tambahBiayaOperasional({
    tanggal,
    keterangan,
    nominal: BIAYA_OPERASIONAL_SEED.nominal,
  });
  ringkasan.biayaOperasional++;
}

/**
 * Saldo awal Member seed dari persiapan M5 di docs/UAT.md (▶ Keputusan 2026-11-20), ditambahkan sebagai "Ditambah
 * Admin" berketerangan "Saldo awal seed". [CONTOH]
 */
const SALDO_SEED = [
  { email: MEMBER_SEED.aktif.email, nominal: 100_000 },
  { email: MEMBER_SEED.nonaktif.email, nominal: 20_000 },
];
const KETERANGAN_SALDO_SEED = "Saldo awal seed";

/**
 * Mengisi saldo awal setiap Member seed yang belum punya Riwayat saldo, lewat ubahSaldoOlehAdmin seperti "Tambah
 * saldo" di halaman Member, jadi setiap saldo seed punya satu baris Riwayat saldo (PRD §15.2).
 */
async function isiSaldo(ringkasan: RingkasanSeed) {
  for (const { email, nominal } of SALDO_SEED) {
    const [member] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailBaku(email)));
    if (!member) gagal(`Member seed ${email} tidak ada.`, JALANKAN_ULANG);
    const { jumlah } = await riwayatSaldoMember({
      idMember: member.id,
      halaman: 1,
    });
    if (jumlah > 0) continue;

    const hasil = await ubahSaldoOlehAdmin({
      idMember: member.id,
      aksi: "tambah",
      nominal: String(nominal),
      keterangan: KETERANGAN_SALDO_SEED,
    });
    if (hasil.hasil !== "diubah") {
      gagal(
        `Saldo awal seed ${email} ditolak aturan Tambah saldo PRD §15.6.`,
        PERBAIKI_DATA_SEED,
      );
    }
    ringkasan.saldo++;
  }
}

/**
 * Top up seed milik member@miwe.example dari persiapan M5 di docs/UAT.md (▶ Keputusan 2026-11-20). [CONTOH] Kode unik
 * Top up Bermasalah Rp 123 mengikuti Total bayar Rp 50.123 = Nominal top up + Kode unik (PRD §15.3).
 */
const TOP_UP_SEED: {
  qrisId: string;
  nominalTopUp: number;
  kodeUnik: number;
  nominalDiterima: number;
  status: "Berhasil" | "Bermasalah";
  menitLalu: number;
}[] = [
  {
    qrisId: "seed-uat-top-up-berhasil",
    nominalTopUp: 100_000,
    kodeUnik: 77,
    nominalDiterima: 100_077,
    status: "Berhasil",
    menitLalu: 150,
  },
  {
    qrisId: "seed-uat-top-up-bermasalah",
    nominalTopUp: 50_000,
    kodeUnik: 123,
    nominalDiterima: 50_000,
    status: "Bermasalah",
    menitLalu: 120,
  },
];

/** Pelaku pembuatan Top up di Riwayat status Top up, sama dengan top-up.ts (PRD §15.4). */
const PELAKU_MEMBER = "Member";

/**
 * Membuat Top up seed yang belum ada, dikenali dari qris_id-nya. Setiap Top up mencatat Riwayat status seperti Top up
 * sungguhan: Menunggu Pembayaran oleh Member saat dibuat, lalu status akhirnya oleh kabar pembayaran Qrispy dua menit
 * kemudian, beserta waktu bayar, nominal diterima, dan Biaya transaksi dari Pengaturan toko saat itu (PRD §15.5).
 *
 * Top up Berhasil seed juga menambah saldo Member sebesar Nominal top up-nya, dengan satu baris Riwayat saldo jenis
 * Top up yang merujuk Nomor Top up-nya, seperti Top up Berhasil sungguhan (PRD §15.2; docs/UAT.md Persiapan M5
 * ▶ Keputusan 2026-11-21, issue 240). Saldo awal seed sudah tercatat lebih dulu, jadi baris itu tampil di atas baris
 * "Saldo awal seed", dan waktunya waktu seed dijalankan supaya baris terbaru tetap di atas. Top up Bermasalah seed tidak
 * mengubah saldo. [CONTOH]
 */
async function isiTopUp(sekarang: number, ringkasan: RingkasanSeed) {
  const email = MEMBER_SEED.aktif.email;
  const [member] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, emailBaku(email)));
  if (!member) gagal(`Member seed ${email} tidak ada.`, JALANKAN_ULANG);

  for (const t of TOP_UP_SEED) {
    const [ada] = await db
      .select({ id: topUp.id })
      .from(topUp)
      .where(eq(topUp.qrisId, t.qrisId));
    if (ada) continue;

    const dibuat = new Date(sekarang - t.menitLalu * 60_000);
    const dibayar = new Date(dibuat.getTime() + 2 * 60_000);
    const totalBayar = t.nominalTopUp + t.kodeUnik;
    const biaya = biayaTransaksi({
      totalBayar,
      ...(await bacaPengaturanBiayaTransaksi()),
    });
    const nomor = nomorTopUp(randomBytes(6));
    await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(topUp)
        .values({
          nomorTopUp: nomor,
          userId: member.id,
          nominalTopUp: t.nominalTopUp,
          kodeUnik: t.kodeUnik,
          totalBayar,
          qrisId: t.qrisId,
          kedaluwarsaPada: new Date(dibuat.getTime() + 15 * 60_000),
          gambarQr: GAMBAR_QR_SEED,
          status: t.status,
          waktuBayar: dibayar,
          nominalDiterima: t.nominalDiterima,
          biayaTransaksi: biaya.biayaTransaksi,
        })
        .returning({ id: topUp.id });
      await tx.insert(riwayatStatusTopUp).values([
        {
          topUpId: id,
          waktu: dibuat,
          status: "Menunggu Pembayaran",
          pelaku: PELAKU_MEMBER,
        },
        {
          topUpId: id,
          waktu: dibayar,
          status: t.status,
          pelaku: PELAKU_KABAR_PEMBAYARAN,
        },
      ]);
      if (t.status !== "Berhasil") return;
      const [{ saldo }] = await tx
        .select({ saldo: user.saldo })
        .from(user)
        .where(eq(user.id, member.id))
        .for("update");
      const saldoSesudah = saldo + t.nominalTopUp;
      await tx
        .update(user)
        .set({ saldo: saldoSesudah })
        .where(eq(user.id, member.id));
      await tx.insert(riwayatSaldo).values({
        userId: member.id,
        waktu: new Date(),
        jenis: "Top up",
        nominal: t.nominalTopUp,
        saldoSesudah,
        rujukan: nomor,
      });
    });
    ringkasan.topUp++;
  }
}

/**
 * Mengisi database dengan data seed UAT yang belum ada. Hasilnya jumlah data yang baru dibuat. Melempar
 * galat yang menyebut sebabnya bila ada data seed yang ditolak.
 */
export async function isiSeedUat(): Promise<RingkasanSeed> {
  // Diperiksa sebelum ada data yang ditulis, karena tanpa kunci ini Item stok tidak bisa disimpan.
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    gagal(SEBAB_KUNCI_BERMASALAH, LANGKAH_KUNCI_BERMASALAH);
  }

  const sekarang = Date.now();
  const ringkasan = {
    admin: 0,
    member: 0,
    voucher: 0,
    kategori: 0,
    produk: 0,
    varian: 0,
    itemStok: 0,
    foto: 0,
    pesanan: 0,
    pengaturanToko: 0,
    biayaOperasional: 0,
    saldo: 0,
    topUp: 0,
  };
  // Admin yang emailnya sudah dipakai dilewati.
  if ((await buatAdmin(ADMIN_SEED)).hasil === "dibuat") ringkasan.admin++;
  await isiMember(ringkasan);
  const idKategori = await isiKategori(ringkasan);
  for (const p of PRODUK) {
    const produkId = await isiProduk(p, idKategori, ringkasan);
    await isiVarian(produkId, p, ringkasan);
  }
  await isiVoucher(sekarang, ringkasan);
  await isiPesanan(kunci.kunci, sekarang, ringkasan);
  await isiBiayaOperasional(sekarang, ringkasan);
  await isiSaldo(ringkasan);
  await isiTopUp(sekarang, ringkasan);

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
    if (!nomor.sah) {
      gagal(
        `Nomor WhatsApp contoh "${PENGATURAN_TOKO.nomorWhatsapp}" ditolak aturan nomor WhatsApp PRD §9.8 dengan alasan ${nomor.alasan}.`,
        PERBAIKI_DATA_SEED,
      );
    }
    // Biaya transaksi memakai nilai awal PRD §14.3.
    await simpanPengaturanToko(
      { ...PENGATURAN_TOKO, nomorWhatsapp: nomor.nomor },
      {
        persen: PERSEN_BIAYA_TRANSAKSI_AWAL,
        minimalTotalBayar: MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL,
      },
    );
    ringkasan.pengaturanToko++;
  }
  return ringkasan;
}
