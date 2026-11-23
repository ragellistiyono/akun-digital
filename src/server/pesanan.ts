// Pesanan (PRD §5.1, §5.5, §6.2, §9.6) beserta QRIS-nya dari Qrispy (ADR-0004) dan Item stok yang
// ditahannya (PRD §5.3) atau dikirim kepadanya (PRD §6.1). Aturan Total bayar dan pemeriksaan nominal QRIS
// ada di src/domain/total-bayar.ts; bentuk Nomor Pesanan ada di src/domain/nomor-pesanan.ts; Stok Varian
// ada di src/domain/stok-varian.ts; kapan dan bagaimana Item stok Terkirim tampil ada di
// src/domain/item-stok-terkirim.ts; batas Pesanan Menunggu Pembayaran per email ada di
// src/domain/batas-pesanan-menunggu.ts; email Member nonaktif ada di src/domain/member-nonaktif.ts; urutan
// pemeriksaan checkout ada di src/domain/checkout.ts; penilaian Voucher ada di src/server/penilaian-voucher.ts; bayar
// dengan saldo ada di src/domain/bayar-saldo.ts; Sisa jatah dan urutan pemeriksaan "Ambil gratis" Produk gratis ada
// di src/domain/produk-gratis.ts.
import { randomBytes } from "node:crypto";

import { and, DrizzleQueryError, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";

import { batasPesananMenunggu } from "@/domain/batas-pesanan-menunggu";
import { bayarSaldo } from "@/domain/bayar-saldo";
import { hasilCheckout } from "@/domain/checkout";
import {
  itemStokTampil,
  kolomItemStokTerkirim,
} from "@/domain/item-stok-terkirim";
import type { AlasanVoucherDitolak } from "@/domain/kelayakan-voucher";
import { emailBaku } from "@/domain/kesamaan-email";
import { emailMilikMemberNonaktif } from "@/domain/member-nonaktif";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import {
  hasilAmbilGratis,
  NOMINAL_PESANAN_GRATIS,
  sisaJatah,
} from "@/domain/produk-gratis";
import { nominalTagihanQris, periksaTagihanQris } from "@/domain/total-bayar";

import { db } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatSaldo,
  riwayatStatusPesanan,
  user,
  varian,
} from "./db/schema";
import { bukaItemStok } from "./enkripsi-item-stok";
import { bacaStokVarian } from "./item-stok";
import {
  jadwalkanEmailPesananSelesai,
  jadwalkanKedaluwarsaPesanan,
} from "./pekerjaan-latar";
import { nilaiVoucherCheckout } from "./penilaian-voucher";
import { qrispyAktif, type QrisBaru, type Qrispy } from "./qrispy";

/** Potongan voucher Pesanan tanpa Voucher, dan Perkiraan bayar di form Checkout sebelum Voucher dipakai. */
const POTONGAN_VOUCHER_TANPA_VOUCHER = 0;

/** Pelaku perubahan status "Selesai" Pesanan yang dibayar dengan saldo (PRD §5.7 ▶ Keputusan 2026-11-20). */
const PELAKU_BAYAR_SALDO = "Pembeli (saldo)";

/** Pelaku perubahan status "Selesai" Pesanan gratis (PRD §5.7 ▶ Keputusan 2026-11-22, §16.3). */
const PELAKU_GRATIS = "Pembeli (gratis)";

/**
 * Ruang nama advisory lock PostgreSQL untuk batas Pesanan menunggu (PRD §5.4), supaya kunci per email ini
 * tidak bertabrakan dengan advisory lock lain, misalnya milik pg-boss.
 */
const KUNCI_BATAS_PESANAN_MENUNGGU = "batas-pesanan-menunggu";

/**
 * Berapa kali checkout dicoba ulang bila Nomor Pesanan acaknya sudah dipakai Pesanan lain, atau potongan Voucher
 * yang dipakai berubah setelah QRIS diminta.
 */
const BATAS_PERCOBAAN_NOMOR = 5;

const nomorPesananAcak = () => nomorPesanan(randomBytes(6));

type Penghubung = Pick<typeof db, "select">;

/** Tautan Pesanan (PRD §6.2): 32 byte acak (256 bit) dalam base64url, sehingga tidak bisa ditebak. */
const tautanPesananAcak = () => randomBytes(32).toString("base64url");

/** Bentuk Tautan Pesanan, yaitu 32 byte acak dalam base64url, untuk memvalidasi tautan dari URL. */
export const TautanPesanan = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Apakah penulisan ditolak indeks unik Nomor Pesanan, karena nomor acaknya sudah dipakai Pesanan lain. */
const nomorSudahDipakai = (galat: unknown) =>
  galat instanceof DrizzleQueryError &&
  galat.cause instanceof postgres.PostgresError &&
  galat.cause.code === "23505" &&
  galat.cause.constraint_name === "pesanan_nomor_pesanan_unik";

/**
 * Membatalkan QRIS yang tidak jadi dipakai. Bila pembatalannya gagal, checkout tetap gagal seperti
 * semula; QRIS itu tidak tertaut ke Pesanan mana pun dan kedaluwarsa sendiri setelah 15 menit.
 */
async function batalkanQrisTakTerpakai(qrispy: Qrispy, qris: QrisBaru) {
  try {
    await qrispy.batalkanQris(qris.qrisId);
  } catch (galat) {
    console.error(
      `QRIS ${qris.qrisId} tidak jadi dipakai, tetapi pembatalannya di Qrispy gagal. QRIS itu tidak tertaut ke Pesanan mana pun.`,
      galat,
    );
  }
}

/**
 * Varian yang bisa dibeli, yaitu Varian aktif dari Produk aktif (PRD §3.7), atau undefined. Produk dan Kategori
 * Produk-nya ikut dibaca untuk Cakupan voucher (PRD §8.4), begitu juga apakah Produk itu Produk gratis beserta Batas
 * per Member-nya (PRD §16.1).
 */
async function varianDijual(varianId: string, penghubung: Penghubung = db) {
  const [baris] = await penghubung
    .select({
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      hargaJual: varian.hargaJual,
      produkId: produk.id,
      kategoriId: produk.kategoriId,
      gratis: produk.gratis,
      batasPerMember: produk.batasPerMember,
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(
      and(
        eq(varian.id, varianId),
        eq(varian.aktif, true),
        eq(produk.aktif, true),
      ),
    );
  return baris;
}

/**
 * Saldo Member dengan id itu, atau null bila tidak ada Member dengan id itu. Bila `penghubung` adalah transaksi dan
 * `kunci`, baris user Member itu dikunci sampai transaksi selesai, seperti setiap perubahan saldo (src/server/saldo.ts).
 */
async function bacaSaldo(
  penghubung: Penghubung,
  idMember: string,
  { kunci = false }: { kunci?: boolean } = {},
) {
  const cari = penghubung
    .select({ email: user.email, saldo: user.saldo })
    .from(user)
    .where(and(eq(user.id, idMember), eq(user.peran, "Member")));
  const [baris] = kunci ? await cari.for("update") : await cari;
  return baris ?? null;
}

/**
 * Batas per Member Produk gratis itu. Melempar galat bila tidak ada, karena Produk gratis selalu punya Batas per
 * Member (PRD §16.1, check constraint produk_gratis_punya_batas_per_member).
 */
function batasPerMemberProdukGratis(dijual: {
  produkId: string;
  batasPerMember: number | null;
}) {
  if (dijual.batasPerMember === null) {
    throw new Error(
      `Produk gratis ${dijual.produkId} tidak punya Batas per Member, padahal Produk gratis selalu punya Batas per Member (PRD §16.1). Periksa produk.batas_per_member Produk itu di database.`,
    );
  }
  return dijual.batasPerMember;
}

/**
 * Sisa jatah Member dengan email itu untuk Produk gratis itu menurut sisaJatah (PRD §16.2). Saringan di database hanya
 * mempersempit bacaan ke Pesanan gratis Produk itu yang emailnya memuat bentuk baku email Member, seperti Riwayat
 * Pesanan; yang memutuskan adalah sisaJatah.
 */
async function bacaSisaJatah(
  penghubung: Penghubung,
  {
    produkId,
    emailMember,
    batasPerMember,
  }: { produkId: string; emailMember: string; batasPerMember: number },
) {
  const pesananGratis = await penghubung
    .select({
      produk: varian.produkId,
      metode: pesanan.metode,
      email: pesanan.email,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .where(
      and(
        eq(varian.produkId, produkId),
        eq(pesanan.metode, "Gratis"),
        sql`strpos(lower(${pesanan.email}), ${emailBaku(emailMember)}) > 0`,
      ),
    );
  return sisaJatah({
    produk: produkId,
    emailMember,
    batasPerMember,
    pesanan: pesananGratis,
  });
}

/**
 * Isi form checkout sebuah Varian (PRD §5.2): nama Produk dan Varian, Harga jual, dan Perkiraan bayar,
 * yaitu nominal yang akan dikirim ke Qrispy sebelum Qrispy menambahkan Kode unik (docs/DESIGN.md "Rincian
 * Total bayar"). Bila `idMember` diisi, yaitu Member sedang login, hasilnya juga membawa bayar dengan saldo tanpa
 * Voucher menurut bayarSaldo (PRD §15.7); untuk Tamu `saldo` null. Bila Produk-nya Produk gratis dan Member sedang
 * login, `jatah` adalah Sisa jatah Member itu menurut sisaJatah (PRD §16.2, §16.3); selain itu `jatah` null. Hasilnya
 * null bila Varian itu tidak bisa dibeli (PRD §3.7).
 */
export async function bacaCheckout(
  varianId: string,
  { idMember = null }: { idMember?: string | null } = {},
) {
  const dijual = await varianDijual(varianId);
  if (!dijual) return null;
  const member = idMember === null ? null : await bacaSaldo(db, idMember);
  const { namaProduk, namaVarian, hargaJual } = dijual;
  const { nominal } = nominalTagihanQris({
    hargaJual,
    potonganVoucher: POTONGAN_VOUCHER_TANPA_VOUCHER,
  });
  return {
    varianId,
    namaProduk,
    namaVarian,
    hargaJual,
    perkiraanBayar: nominal,
    saldo:
      member &&
      bayarSaldo({
        saldo: member.saldo,
        hargaJual,
        potonganVoucher: POTONGAN_VOUCHER_TANPA_VOUCHER,
      }),
    jatah:
      member && dijual.gratis
        ? await bacaSisaJatah(db, {
            produkId: dijual.produkId,
            emailMember: member.email,
            batasPerMember: batasPerMemberProdukGratis(dijual),
          })
        : null,
  };
}

/**
 * Bayar dengan saldo Member itu untuk Varian itu dengan potongan voucher itu, menurut bayarSaldo (PRD §15.7), atau
 * null bila tidak ada Member dengan id itu. Dipakai tombol "Pakai", supaya kecukupan saldo dihitung ulang setiap
 * kali potongan voucher berubah.
 */
export async function bacaBayarSaldo({
  idMember,
  hargaJual,
  potonganVoucher,
}: {
  idMember: string;
  hargaJual: number;
  potonganVoucher: number;
}) {
  const member = await bacaSaldo(db, idMember);
  return (
    member && bayarSaldo({ saldo: member.saldo, hargaJual, potonganVoucher })
  );
}

type VarianDijual = NonNullable<Awaited<ReturnType<typeof varianDijual>>>;

/**
 * Semua Pesanan Menunggu Pembayaran beserta email, Tautan Pesanan, dan waktu kedaluwarsanya, untuk batas Pesanan
 * menunggu (PRD §5.4). Saringan status hanya mempersempit bacaan; batasPesananMenunggu yang memutuskan. Pesanan
 * Menunggu Pembayaran selalu Pesanan QRIS, yang punya waktu kedaluwarsa (PRD §15.7, §16.3).
 */
async function bacaPesananMenunggu(penghubung: Penghubung) {
  return (
    await penghubung
      .select({
        email: pesanan.email,
        status: pesanan.status,
        tautan: pesanan.tautan,
        kedaluwarsaPada: pesanan.kedaluwarsaPada,
      })
      .from(pesanan)
      .where(eq(pesanan.status, "Menunggu Pembayaran"))
  ).flatMap(({ kedaluwarsaPada, ...lainnya }) =>
    kedaluwarsaPada ? [{ ...lainnya, kedaluwarsaPada }] : [],
  );
}

/**
 * Hasil checkout Varian itu menurut hasilCheckout (PRD §3.7, §5.2, §5.4, §8.7). `varianDijual` adalah Varian yang
 * dijual menurut varianDijual, atau undefined bila tidak dijual. Member nonaktif, Pesanan Menunggu Pembayaran,
 * Stok Varian, dan Voucher dibaca lewat `penghubung`, supaya pemeriksaan ini bisa diulang di dalam transaksi
 * checkout. Hasil yang boleh membawa Voucher yang dipakai, atau null. Kode voucher hanya dinilai bila diisi (`kodeVoucher` tidak null) dan Varian itu dijual, dengan Harga
 * jual `varianDijual`. Bila `kunciVoucher`, Voucher itu dikunci sampai transaksi `penghubung` selesai
 * (nilaiVoucherCheckout). Bila Member membayar dengan saldo, `saldo` adalah saldonya, dan kecukupannya diperiksa
 * terakhir menurut bayarSaldo dengan potongan Voucher yang dipakai (PRD §5.2 ▶ Keputusan 2026-11-20); hasil yang
 * boleh lalu membawa hasil bayarSaldo itu. `saldo` null berarti Pesanan dibayar dengan QRIS.
 */
async function periksaCheckout(
  penghubung: Penghubung,
  {
    varianDijual,
    varianId,
    email,
    kodeVoucher,
    member,
    kunciVoucher,
    saldo = null,
  }: {
    varianDijual: VarianDijual | undefined;
    varianId: string;
    email: string;
    kodeVoucher: string | null;
    member: boolean;
    kunciVoucher: boolean;
    saldo?: number | null;
  },
) {
  // Saringan Member nonaktif dan status Pesanan hanya mempersempit bacaan; emailMilikMemberNonaktif dan
  // batasPesananMenunggu yang memutuskan.
  const semuaMemberNonaktif = await penghubung
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.peran, "Member"), eq(user.nonaktif, true)));
  const pesananLain = await bacaPesananMenunggu(penghubung);
  const { stokVarian } = await bacaStokVarian(varianId, penghubung);
  const voucherDinilai =
    kodeVoucher !== null && varianDijual
      ? await nilaiVoucherCheckout(penghubung, {
          kode: kodeVoucher,
          varian: {
            produk: varianDijual.produkId,
            kategori: varianDijual.kategoriId,
            hargaJual: varianDijual.hargaJual,
          },
          emailCheckout: email,
          member,
          kunci: kunciVoucher,
        })
      : null;
  const voucherDipakai = voucherDinilai?.dipakai ? voucherDinilai : null;
  const bayar =
    saldo !== null && varianDijual
      ? bayarSaldo({
          saldo,
          hargaJual: varianDijual.hargaJual,
          potonganVoucher:
            voucherDipakai?.potonganVoucher ?? POTONGAN_VOUCHER_TANPA_VOUCHER,
        })
      : null;
  const hasil = hasilCheckout({
    varianDijual,
    memberNonaktif: emailMilikMemberNonaktif({ email, semuaMemberNonaktif }),
    batasPesananMenunggu: batasPesananMenunggu({ email, pesananLain }),
    stokVarian,
    voucher: voucherDinilai,
    saldo: bayar,
  });
  // Checkout yang boleh membawa Voucher yang dipakai, atau null bila kode voucher tidak diisi, dan bayar dengan
  // saldo-nya, atau null bila dibayar dengan QRIS.
  return hasil.hasil === "boleh"
    ? { ...hasil, voucher: voucherDipakai, bayar }
    : hasil;
}

type HasilPesananMenunggu =
  | { hasil: "pesanan-menunggu-di-browser-ini"; tautan: string }
  | { hasil: "pesanan-menunggu-di-browser-lain"; kedaluwarsaPada: Date };

type HasilCheckoutDitolak =
  | { hasil: "tidak-dijual" }
  | { hasil: "member-nonaktif" }
  | { hasil: "stok-habis" }
  | { hasil: "voucher-ditolak"; alasan: AlasanVoucherDitolak; pesan: string }
  | { hasil: "saldo-kurang"; saldo: number; harusDibayar: number }
  | HasilPesananMenunggu;

type PemeriksaanCheckout = Awaited<ReturnType<typeof periksaCheckout>>;

/**
 * Hasil buatPesanan untuk checkout yang ditolak hasilCheckout. Bila email itu masih punya Pesanan Menunggu
 * Pembayaran (PRD §5.4) dan browser ini memegang Tautan Pesanan-nya, karena Pesanan itu dibuat di browser
 * ini, hasilnya Tautan Pesanan itu. Bila tidak, hasilnya hanya waktu kedaluwarsanya, supaya Tautan Pesanan
 * itu tidak pernah sampai ke browser lain (▶ Keputusan 2026-11-11). Voucher yang ditolak menghasilkan pesan
 * penolakannya (PRD §8.7).
 */
function checkoutDitolak(
  ditolak: Exclude<PemeriksaanCheckout, { hasil: "boleh" }>,
  tautanDiBrowser: readonly string[],
): HasilCheckoutDitolak {
  if (ditolak.hasil !== "pesanan-menunggu") return ditolak;
  return pesananMenungguDiBrowser(ditolak.pesananMenunggu, tautanDiBrowser);
}

/**
 * Pesanan Menunggu Pembayaran yang menghalangi Pesanan baru (PRD §5.4): Tautan Pesanan-nya bila browser ini
 * memegangnya, atau hanya waktu kedaluwarsanya bila tidak (▶ Keputusan 2026-11-11).
 */
function pesananMenungguDiBrowser(
  { tautan, kedaluwarsaPada }: { tautan: string; kedaluwarsaPada: Date },
  tautanDiBrowser: readonly string[],
): HasilPesananMenunggu {
  return tautanDiBrowser.includes(tautan)
    ? { hasil: "pesanan-menunggu-di-browser-ini", tautan }
    : { hasil: "pesanan-menunggu-di-browser-lain", kedaluwarsaPada };
}

type HasilBuatPesanan =
  | { hasil: "dibuat"; tautan: string }
  | { hasil: "qris-gagal" }
  | HasilCheckoutDitolak;

const QRIS_GAGAL = { hasil: "qris-gagal" } as const;
const STOK_HABIS = { hasil: "stok-habis" } as const;
const TIDAK_DIJUAL = { hasil: "tidak-dijual" } as const;

/** Hasil transaksi checkout bila Voucher yang dipakai atau potongannya berubah sejak QRIS diminta. */
const VOUCHER_BERUBAH = { hasil: "voucher-berubah" } as const;

/** Kode voucher yang diisi Pembeli, atau null bila isiannya kosong atau hanya spasi. */
const kodeVoucherDiisi = (kode: string | null) =>
  kode === null || kode.trim() === "" ? null : kode;

/**
 * Checkout satu Varian: membuat Pesanan Menunggu Pembayaran beserta QRIS-nya (PRD §5.1, ADR-0004).
 *
 * Urutan pemeriksaannya ditentukan hasilCheckout: Produk dan Varian yang dijual, lalu Member nonaktif, lalu
 * batas Pesanan menunggu, lalu Stok Varian, lalu Voucher (PRD §5.2 ▶ Keputusan 2026-11-17, §5.4 ▶ Keputusan
 * 2026-11-12).
 *
 * - Produk dan Varian-nya harus aktif (PRD §3.7). Bila tidak, tidak ada QRIS maupun Pesanan yang dibuat.
 * - Email milik Member nonaktif ditolak (PRD §2.3), tanpa QRIS maupun Pesanan, walaupun email itu masih punya
 *   Pesanan Menunggu Pembayaran. Pesanan yang sudah ada tetap berjalan seperti biasa.
 * - Bila email itu masih punya Pesanan Menunggu Pembayaran (PRD §5.4), tidak ada QRIS maupun Pesanan baru,
 *   walaupun Stok Varian-nya 0. Hasilnya Tautan Pesanan itu bila `tautanDiBrowser`, yaitu Tautan Pesanan
 *   yang dibuat di browser Pembeli, memuatnya; bila tidak, hasilnya hanya waktu kedaluwarsa Pesanan itu.
 * - Checkout ditolak karena stok habis bila Stok Varian-nya 0 (PRD §5.2), juga tanpa QRIS maupun Pesanan.
 * - Bila `kodeVoucher` diisi, Voucher itu dinilai nilaiVoucherCheckout dengan `email` dan `member` (Pembeli
 *   login sebagai Member). Voucher yang ditolak menolak checkout dengan pesan penolakannya, tanpa QRIS maupun
 *   Pesanan; Pesanan tidak pernah dibuat tanpa Voucher bila kodenya diisi (PRD §8.7 ▶ Keputusan 2026-11-17).
 * - Harga jual, Harga modal Varian (null bila belum ada, PRD §14.1), dan potongan voucher dicatat saat
 *   checkout, beserta id dan kode Voucher yang dipakai. Qrispy diminta Harga jual − potongan voucher. Kode
 *   unik, Total bayar, waktu kedaluwarsa, dan gambar QR diambil dari QRIS yang diterbitkan Qrispy, dengan
 *   Nomor Pesanan sebagai payment_reference.
 * - Bila Qrispy gagal, atau nominal QRIS-nya tidak cocok (periksaTagihanQris), QRIS itu dibatalkan dan
 *   tidak ada Pesanan yang tersisa.
 * - Pesanan, baris pertama Riwayat status Pesanan, Penahanan satu Item stok Tersedia dari Varian itu
 *   (PRD §5.3), dan pekerjaan kedaluwarsa pada waktu kedaluwarsa QRIS-nya (PRD §5.8) ditulis dalam satu
 *   transaksi. Item stok Ditahan mencatat Pesanan yang menahannya.
 * - Di dalam transaksi itu, pemeriksaan checkout diulang sebelum Item stok ditahan. Checkout bersamaan dengan
 *   email yang sama menulis transaksinya satu per satu, dan Voucher yang dipakai dikunci, sehingga checkout
 *   bersamaan yang berebut sisa Kuota voucher atau Batas per email menghasilkan paling banyak satu Pesanan
 *   yang memakai Voucher itu (PRD §8.5). Yang kalah membatalkan QRIS-nya, tanpa Pesanan.
 * - Bila Item stok terakhirnya sudah ditahan checkout lain setelah QRIS terbit, QRIS itu dibatalkan dan
 *   checkout ditolak karena stok habis, tanpa Pesanan.
 * - Bila Nomor Pesanan acaknya sudah dipakai Pesanan lain, atau Voucher yang dipakai berubah potongannya
 *   setelah QRIS diminta, QRIS-nya dibatalkan, lalu pemeriksaan, nomor, dan QRIS dibuat ulang.
 *
 * Adaptor Qrispy dan pembuat Nomor Pesanan bisa diganti untuk test.
 */
export async function buatPesanan(
  {
    varianId,
    email,
    tautanDiBrowser = [],
    kodeVoucher = null,
    member = false,
  }: {
    varianId: string;
    email: string;
    tautanDiBrowser?: readonly string[];
    kodeVoucher?: string | null;
    member?: boolean;
  },
  {
    qrispy = qrispyAktif(),
    buatNomorPesanan = nomorPesananAcak,
  }: { qrispy?: Qrispy; buatNomorPesanan?: () => string } = {},
): Promise<HasilBuatPesanan> {
  const kode = kodeVoucherDiisi(kodeVoucher);

  for (let percobaan = 1; ; percobaan++) {
    const pemeriksaan = await periksaCheckout(db, {
      varianDijual: await varianDijual(varianId),
      varianId,
      email,
      kodeVoucher: kode,
      member,
      kunciVoucher: false,
    });
    if (pemeriksaan.hasil !== "boleh") {
      return checkoutDitolak(pemeriksaan, tautanDiBrowser);
    }
    const dijual = pemeriksaan.varianDijual;
    const voucherDipakai = pemeriksaan.voucher;

    const { hargaJual } = dijual;
    const potonganVoucher =
      voucherDipakai?.potonganVoucher ?? POTONGAN_VOUCHER_TANPA_VOUCHER;
    const { nominal } = nominalTagihanQris({ hargaJual, potonganVoucher });

    const nomor = buatNomorPesanan();

    let qris: QrisBaru;
    try {
      qris = await qrispy.buatQris({
        amount: nominal,
        paymentReference: nomor,
      });
    } catch (galat) {
      console.error(`QRIS untuk Pesanan ${nomor} gagal dibuat.`, galat);
      return QRIS_GAGAL;
    }

    const tagihan = periksaTagihanQris({
      hargaJual,
      potonganVoucher,
      requestedAmount: qris.requestedAmount,
      uniqueId: qris.uniqueId,
      amount: qris.amount,
    });
    if (!tagihan.cocok) {
      console.error(
        `QRIS ${qris.qrisId} untuk Pesanan ${nomor} ditolak: ${tagihan.alasan}.`,
      );
      await batalkanQrisTakTerpakai(qrispy, qris);
      return QRIS_GAGAL;
    }

    const tautan = tautanPesananAcak();
    let hasil;
    try {
      hasil = await db.transaction(async (tx) => {
        // Checkout dengan email yang sama menurut §7.4 menunggu giliran di sini sampai transaksi checkout
        // sebelumnya selesai, sehingga pemeriksaan Pesanan menunggu di bawah melihat Pesanan yang baru saja
        // disimpannya (PRD §5.4). Kunci ini lepas sendiri di akhir transaksi.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${KUNCI_BATAS_PESANAN_MENUNGGU}), hashtext(${emailBaku(email)}))`,
        );

        // Pemeriksaan checkout diulang dengan urutan yang sama, untuk Varian yang dijual saat pemeriksaan
        // pertama, sehingga batas Pesanan menunggu tetap didahulukan sebelum stok habis. Voucher yang dipakai
        // dikunci sampai transaksi ini selesai, jadi checkout lain dengan Voucher yang sama menunggu di sini
        // lalu menghitung Pesanan yang disimpan transaksi ini (PRD §8.5).
        const pemeriksaanUlang = await periksaCheckout(tx, {
          varianDijual: dijual,
          varianId,
          email,
          kodeVoucher: kode,
          member,
          kunciVoucher: true,
        });
        if (pemeriksaanUlang.hasil !== "boleh") {
          return checkoutDitolak(pemeriksaanUlang, tautanDiBrowser);
        }
        const voucherUlang = pemeriksaanUlang.voucher;
        if (
          voucherUlang?.voucherId !== voucherDipakai?.voucherId ||
          voucherUlang?.potonganVoucher !== voucherDipakai?.potonganVoucher
        ) {
          return VOUCHER_BERUBAH;
        }

        // Harga modal Varian saat ini dicatat di Pesanan, atau null bila Varian itu belum punya Harga modal
        // (PRD §14.1). Baris Varian dikunci FOR SHARE sampai Pesanan tersimpan, sebelum Item stok seperti
        // urutan kunci pengisian Item stok dan hapus Varian, supaya isi pertama Harga modal yang disimpan
        // bersamaan (ubahVarian) tidak melewatkan Pesanan ini. Varian yang terhapus selagi checkout menunggu
        // kunci ini tidak dijual lagi.
        const [harga] = await tx
          .select({ hargaModal: varian.hargaModal })
          .from(varian)
          .where(eq(varian.id, varianId))
          .for("share");
        if (!harga) return TIDAK_DIJUAL;

        // Penahanan Item stok (PRD §5.3). Item stok yang sedang dikunci checkout lain dilewati, supaya
        // dua checkout bersamaan tidak pernah menahan Item stok yang sama. Bila Item stok terakhirnya
        // sedang dikunci checkout lain yang belum selesai, checkout ini ditolak karena stok habis.
        const [tersedia] = await tx
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, varianId),
              eq(itemStok.status, "Tersedia"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        if (!tersedia) return STOK_HABIS;

        const [{ id }] = await tx
          .insert(pesanan)
          .values({
            nomorPesanan: nomor,
            tautan,
            email,
            varianId,
            hargaJual,
            hargaModal: harga.hargaModal,
            potonganVoucher,
            kodeUnik: tagihan.rincian.kodeUnik,
            totalBayar: tagihan.rincian.totalBayar,
            qrisId: qris.qrisId,
            kedaluwarsaPada: qris.expiredAt,
            gambarQr: qris.gambarQr,
            status: "Menunggu Pembayaran",
            voucherId: voucherDipakai?.voucherId ?? null,
            kodeVoucher: voucherDipakai?.kodeVoucher ?? null,
          })
          .returning({ id: pesanan.id });
        await tx.insert(riwayatStatusPesanan).values({
          pesananId: id,
          waktu: new Date(),
          status: "Menunggu Pembayaran",
          pelaku: "Pembeli",
        });
        await tx
          .update(itemStok)
          .set({ status: "Ditahan", pesananId: id })
          .where(eq(itemStok.id, tersedia.id));
        await jadwalkanKedaluwarsaPesanan(
          { pesananId: id, kedaluwarsaPada: qris.expiredAt },
          tx,
        );
        return { hasil: "dibuat", tautan } as const;
      });
    } catch (galat) {
      await batalkanQrisTakTerpakai(qrispy, qris);
      if (nomorSudahDipakai(galat) && percobaan < BATAS_PERCOBAAN_NOMOR) {
        continue;
      }
      throw galat;
    }
    if (hasil.hasil === "dibuat") return hasil;
    await batalkanQrisTakTerpakai(qrispy, qris);
    if (hasil.hasil !== VOUCHER_BERUBAH.hasil) return hasil;
    if (percobaan >= BATAS_PERCOBAAN_NOMOR) {
      console.error(
        `Checkout Varian ${varianId} dihentikan: potongan Voucher berubah di setiap ${percobaan} percobaan.`,
      );
      return QRIS_GAGAL;
    }
  }
}

/** Hasil buatPesananSaldo. */
type HasilBuatPesananSaldo =
  | { hasil: "dibuat"; tautan: string }
  | { hasil: "tidak-ada-member" }
  | HasilCheckoutDitolak;

/**
 * Checkout satu Varian yang dibayar dengan saldo Member itu (PRD §15.7): membuat Pesanan yang langsung Selesai, tanpa
 * Menunggu Pembayaran dan tanpa QRIS. Email Pesanan-nya email Member itu (PRD §5.2).
 *
 * - Pemeriksaan checkout berjalan dengan urutan yang sama seperti buatPesanan, termasuk batas Pesanan menunggu
 *   (PRD §5.4) dan Voucher, lalu saldo sebagai langkah keenam (PRD §5.2 ▶ Keputusan 2026-11-20). Saldo yang kurang
 *   dari Harga jual − potongan voucher ditolak dengan saldo dan yang harus dibayar untuk pesannya.
 * - Semua pemeriksaan dan penulisan terjadi dalam satu transaksi. Urutan kuncinya: kunci batas Pesanan menunggu per
 *   email, lalu baris user Member (seperti setiap perubahan saldo di src/server/saldo.ts), lalu Voucher yang dipakai,
 *   baris Varian FOR SHARE, dan satu Item stok Tersedia, sama seperti buatPesanan. Karena itu saldo yang dikurangi
 *   Admin bersamaan dinilai dengan saldo terbarunya, dan saldo tidak pernah negatif (PRD §15.1).
 * - Bila berhasil: saldo berkurang sebesar Total bayar, Riwayat saldo mencatat baris Pembelian dengan Nomor
 *   Pesanan-nya (PRD §15.2), Pesanan dibuat Selesai dengan Metode Saldo, Kode unik Rp 0, Biaya transaksi Rp 0, dan
 *   waktu bayar sama dengan waktu dibuatnya, Riwayat status Pesanan mencatat satu perubahan "Selesai" oleh
 *   "Pembeli (saldo)" (PRD §5.7 ▶ Keputusan 2026-11-20), satu Item stok Tersedia menjadi Terkirim dengan nama
 *   kolom Format Item stok saat itu (PRD §4.1), dan email "Pesanan selesai" dijadwalkan (PRD §6.3).
 * - Bila salah satunya tidak bisa, misalnya Item stok terakhirnya sedang dikunci checkout lain, tidak ada yang
 *   berubah, dan checkout ditolak karena stok habis.
 * - Bila Nomor Pesanan acaknya sudah dipakai Pesanan lain, transaksinya diulang dengan nomor baru.
 *
 * Pembuat Nomor Pesanan dan waktu "sekarang" bisa diganti untuk test.
 */
export async function buatPesananSaldo(
  {
    varianId,
    idMember,
    tautanDiBrowser = [],
    kodeVoucher = null,
  }: {
    varianId: string;
    idMember: string;
    tautanDiBrowser?: readonly string[];
    kodeVoucher?: string | null;
  },
  {
    buatNomorPesanan = nomorPesananAcak,
    sekarang = () => new Date(),
  }: { buatNomorPesanan?: () => string; sekarang?: () => Date } = {},
): Promise<HasilBuatPesananSaldo> {
  const kode = kodeVoucherDiisi(kodeVoucher);
  const pemilik = await bacaSaldo(db, idMember);
  if (!pemilik) return { hasil: "tidak-ada-member" };
  const { email } = pemilik;

  for (let percobaan = 1; ; percobaan++) {
    const nomor = buatNomorPesanan();
    const tautan = tautanPesananAcak();
    try {
      return await db.transaction(async (tx) => {
        // Kunci yang sama dengan buatPesanan, supaya checkout bersamaan dengan email ini dinilai satu per satu
        // terhadap Pesanan menunggu yang baru disimpan (PRD §5.4).
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${KUNCI_BATAS_PESANAN_MENUNGGU}), hashtext(${emailBaku(email)}))`,
        );
        const member = await bacaSaldo(tx, idMember, { kunci: true });
        if (!member) return { hasil: "tidak-ada-member" } as const;

        const pemeriksaan = await periksaCheckout(tx, {
          varianDijual: await varianDijual(varianId, tx),
          varianId,
          email: member.email,
          kodeVoucher: kode,
          member: true,
          kunciVoucher: true,
          saldo: member.saldo,
        });
        if (pemeriksaan.hasil !== "boleh") {
          return checkoutDitolak(pemeriksaan, tautanDiBrowser);
        }
        const { bayar, voucher: voucherDipakai } = pemeriksaan;
        if (bayar?.saldoSesudah == null) {
          throw new Error(
            `Pesanan saldo untuk Varian ${varianId} lolos pemeriksaan checkout tanpa saldo yang cukup. Periksa hasilCheckout di src/domain/checkout.ts.`,
          );
        }

        // Harga modal dan Format Item stok saat ini. Baris Varian dikunci FOR SHARE sebelum Item stok, seperti
        // buatPesanan.
        const [harga] = await tx
          .select({
            hargaModal: varian.hargaModal,
            formatItemStok: produk.formatItemStok,
          })
          .from(varian)
          .innerJoin(produk, eq(varian.produkId, produk.id))
          .where(eq(varian.id, varianId))
          .for("share", { of: varian });
        if (!harga) return TIDAK_DIJUAL;

        const [tersedia] = await tx
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, varianId),
              eq(itemStok.status, "Tersedia"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        if (!tersedia) return STOK_HABIS;

        const waktu = sekarang();
        const [{ id }] = await tx
          .insert(pesanan)
          .values({
            nomorPesanan: nomor,
            tautan,
            email: member.email,
            varianId,
            hargaJual: bayar.hargaJual,
            hargaModal: harga.hargaModal,
            potonganVoucher: bayar.potonganVoucher,
            kodeUnik: bayar.kodeUnik,
            biayaTransaksi: bayar.biayaTransaksi,
            totalBayar: bayar.harusDibayar,
            metode: "Saldo",
            status: "Selesai",
            waktuBayar: waktu,
            voucherId: voucherDipakai?.voucherId ?? null,
            kodeVoucher: voucherDipakai?.kodeVoucher ?? null,
          })
          .returning({ id: pesanan.id });
        await tx.insert(riwayatStatusPesanan).values({
          pesananId: id,
          waktu,
          status: "Selesai",
          pelaku: PELAKU_BAYAR_SALDO,
        });
        await tx
          .update(itemStok)
          .set({
            status: "Terkirim",
            pesananId: id,
            formatSaatTerkirim: harga.formatItemStok,
          })
          .where(eq(itemStok.id, tersedia.id));
        await tx
          .update(user)
          .set({ saldo: bayar.saldoSesudah })
          .where(eq(user.id, idMember));
        await tx.insert(riwayatSaldo).values({
          userId: idMember,
          waktu,
          jenis: "Pembelian",
          nominal: -bayar.harusDibayar,
          saldoSesudah: bayar.saldoSesudah,
          rujukan: nomor,
        });
        await jadwalkanEmailPesananSelesai(id, tx);
        return { hasil: "dibuat", tautan } as const;
      });
    } catch (galat) {
      if (nomorSudahDipakai(galat) && percobaan < BATAS_PERCOBAAN_NOMOR) {
        continue;
      }
      throw galat;
    }
  }
}

/** Hasil buatPesananGratis. */
type HasilBuatPesananGratis =
  | { hasil: "dibuat"; tautan: string }
  | { hasil: "tidak-dijual" }
  | { hasil: "tidak-gratis" }
  | { hasil: "tidak-login" }
  | HasilPesananMenunggu
  | { hasil: "stok-habis" }
  | { hasil: "jatah-habis"; pesan: string };

/**
 * "Ambil gratis" satu Varian Produk gratis oleh Member itu (PRD §16.3): membuat Pesanan gratis yang langsung Selesai,
 * tanpa Menunggu Pembayaran dan tanpa QRIS. Email Pesanan-nya email Member itu (PRD §5.2). `idMember` null berarti
 * tidak ada Member yang sedang login.
 *
 * - Pemeriksaannya berurutan menurut hasilAmbilGratis: Produk dan Varian yang dijual, Produk yang masih gratis,
 *   Member yang login, batas Pesanan menunggu (PRD §5.4), Stok Varian, lalu Sisa jatah (PRD §16.2). Member nonaktif
 *   tidak punya sesi (PRD §2.3), jadi diperlakukan sama dengan Member yang tidak login.
 * - Semua pemeriksaan dan penulisan terjadi dalam satu transaksi, setelah kunci batas Pesanan menunggu per email yang
 *   sama dengan checkout. Karena itu dua pengambilan bersamaan oleh Member yang sama dinilai satu per satu, dan yang
 *   kedua menghitung Pesanan gratis yang disimpan yang pertama, sehingga Batas per Member tidak terlewati.
 * - Bila berhasil: Pesanan dibuat Selesai dengan Metode Gratis, nominal NOMINAL_PESANAN_GRATIS (PRD §16.5), Harga
 *   modal Varian saat itu (null bila belum ada, PRD §14.1), dan waktu bayar sama dengan waktu dibuatnya. Riwayat
 *   status Pesanan mencatat satu perubahan "Selesai" oleh "Pembeli (gratis)", satu Item stok Tersedia menjadi Terkirim
 *   dengan nama kolom Format Item stok saat itu (PRD §4.1), dan email "Pesanan selesai" dijadwalkan (PRD §6.3).
 * - Bila Item stok terakhirnya sedang dikunci checkout lain, tidak ada yang berubah, dan pengambilan ditolak karena
 *   stok habis.
 * - Bila Nomor Pesanan acaknya sudah dipakai Pesanan lain, transaksinya diulang dengan nomor baru.
 *
 * Pembuat Nomor Pesanan dan waktu "sekarang" bisa diganti untuk test.
 */
export async function buatPesananGratis(
  {
    varianId,
    idMember,
    tautanDiBrowser = [],
  }: {
    varianId: string;
    idMember: string | null;
    tautanDiBrowser?: readonly string[];
  },
  {
    buatNomorPesanan = nomorPesananAcak,
    sekarang = () => new Date(),
  }: { buatNomorPesanan?: () => string; sekarang?: () => Date } = {},
): Promise<HasilBuatPesananGratis> {
  for (let percobaan = 1; ; percobaan++) {
    const nomor = buatNomorPesanan();
    const tautan = tautanPesananAcak();
    try {
      return await db.transaction(async (tx) => {
        const [member] =
          idMember === null
            ? []
            : await tx
                .select({ email: user.email })
                .from(user)
                .where(
                  and(
                    eq(user.id, idMember),
                    eq(user.peran, "Member"),
                    eq(user.nonaktif, false),
                  ),
                );
        // Kunci yang sama dengan buatPesanan, supaya pengambilan dan checkout bersamaan dengan email ini dinilai satu
        // per satu terhadap Pesanan yang baru disimpan (PRD §5.4, §16.3).
        if (member) {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${KUNCI_BATAS_PESANAN_MENUNGGU}), hashtext(${emailBaku(member.email)}))`,
          );
        }

        const dijual = await varianDijual(varianId, tx);
        const { stokVarian } = await bacaStokVarian(varianId, tx);
        const pemeriksaan = hasilAmbilGratis({
          varianDijual: dijual,
          member:
            member && dijual?.gratis
              ? {
                  batasPesananMenunggu: batasPesananMenunggu({
                    email: member.email,
                    pesananLain: await bacaPesananMenunggu(tx),
                  }),
                  jatah: await bacaSisaJatah(tx, {
                    produkId: dijual.produkId,
                    emailMember: member.email,
                    batasPerMember: batasPerMemberProdukGratis(dijual),
                  }),
                }
              : null,
          stokVarian,
        });
        if (pemeriksaan.hasil === "pesanan-menunggu") {
          return pesananMenungguDiBrowser(
            pemeriksaan.pesananMenunggu,
            tautanDiBrowser,
          );
        }
        if (pemeriksaan.hasil !== "boleh") return pemeriksaan;
        if (!member) {
          throw new Error(
            `Pesanan gratis untuk Varian ${varianId} lolos pemeriksaan tanpa Member yang login. Periksa hasilAmbilGratis di src/domain/produk-gratis.ts.`,
          );
        }

        // Harga modal dan Format Item stok saat ini. Baris Varian dikunci FOR SHARE sebelum Item stok, seperti
        // buatPesanan.
        const [harga] = await tx
          .select({
            hargaModal: varian.hargaModal,
            formatItemStok: produk.formatItemStok,
          })
          .from(varian)
          .innerJoin(produk, eq(varian.produkId, produk.id))
          .where(eq(varian.id, varianId))
          .for("share", { of: varian });
        if (!harga) return TIDAK_DIJUAL;

        const [tersedia] = await tx
          .select({ id: itemStok.id })
          .from(itemStok)
          .where(
            and(
              eq(itemStok.varianId, varianId),
              eq(itemStok.status, "Tersedia"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        if (!tersedia) return STOK_HABIS;

        const waktu = sekarang();
        const [{ id }] = await tx
          .insert(pesanan)
          .values({
            nomorPesanan: nomor,
            tautan,
            email: member.email,
            varianId,
            ...NOMINAL_PESANAN_GRATIS,
            hargaModal: harga.hargaModal,
            metode: "Gratis",
            status: "Selesai",
            waktuBayar: waktu,
          })
          .returning({ id: pesanan.id });
        await tx.insert(riwayatStatusPesanan).values({
          pesananId: id,
          waktu,
          status: "Selesai",
          pelaku: PELAKU_GRATIS,
        });
        await tx
          .update(itemStok)
          .set({
            status: "Terkirim",
            pesananId: id,
            formatSaatTerkirim: harga.formatItemStok,
          })
          .where(eq(itemStok.id, tersedia.id));
        await jadwalkanEmailPesananSelesai(id, tx);
        return { hasil: "dibuat", tautan } as const;
      });
    } catch (galat) {
      if (nomorSudahDipakai(galat) && percobaan < BATAS_PERCOBAAN_NOMOR) {
        continue;
      }
      throw galat;
    }
  }
}

/**
 * Kolom-kolom Item stok yang Terkirim ke Pesanan itu, dengan nama kolom yang dicatat saat Item stok itu
 * Terkirim (PRD §4.1), atau null bila Pesanan itu belum dikirimi Item stok. Isinya dibuka dengan
 * ITEM_STOK_KEY.
 */
export async function bacaItemStokTerkirim(pesananId: string) {
  const [terkirim] = await db
    .select({
      isiTerenkripsi: itemStok.isiTerenkripsi,
      formatSaatTerkirim: itemStok.formatSaatTerkirim,
    })
    .from(itemStok)
    .where(
      and(eq(itemStok.pesananId, pesananId), eq(itemStok.status, "Terkirim")),
    );
  if (!terkirim) return null;
  if (!terkirim.formatSaatTerkirim) {
    throw new Error(
      `Item stok yang Terkirim ke Pesanan ${pesananId} tidak mencatat nama kolomnya, padahal nama kolom Format Item stok selalu dicatat saat Item stok Terkirim (PRD §4.1). Periksa item_stok.format_saat_terkirim untuk Pesanan itu di database.`,
    );
  }
  return kolomItemStokTerkirim({
    formatSaatTerkirim: terkirim.formatSaatTerkirim,
    nilai: bukaItemStok(terkirim.isiTerenkripsi),
  });
}

/**
 * Kolom-kolom Item stok Pesanan Selesai itu menurut bacaItemStokTerkirim. Melempar galat bila Pesanan itu
 * tidak punya Item stok Terkirim, karena Pesanan Selesai selalu sudah dikirimi Item stok (PRD §5.7).
 */
async function bacaItemStokPesananSelesai(pesananId: string, nomor: string) {
  const kolom = await bacaItemStokTerkirim(pesananId);
  if (!kolom) {
    throw new Error(
      `Pesanan ${nomor} Selesai tetapi tidak punya Item stok Terkirim, padahal Pesanan Selesai selalu sudah dikirimi Item stok (PRD §5.7). Periksa item_stok dengan pesanan_id Pesanan itu di database.`,
    );
  }
  return kolom;
}

/**
 * Pesanan yang dibuka lewat Tautan Pesanan (PRD §6.2), untuk Halaman bayar dan Halaman Pesanan: Nomor
 * Pesanan, status, id dan nama Produk beserta nama Varian, gambar QR beserta waktu kedaluwarsa QRIS-nya,
 * rincian nominal yang dicatat di Pesanan (PRD §5.5) beserta kode Voucher-nya atau null bila tanpa Voucher dan Metode-nya
 * (PRD §15.7), dan kolom-kolom Item stok-nya. Gambar QR dan waktu kedaluwarsa null untuk Pesanan yang dibayar dengan
 * saldo dan Pesanan gratis. Item stok hanya
 * dibaca untuk Pesanan Selesai (PRD §6.1); untuk status lain `itemStok` selalu null. `dibacaPada` adalah
 * jam server saat Pesanan dibaca, yang menjadi titik awal hitung mundur di Halaman bayar. Hasilnya null
 * bila tidak ada Pesanan dengan Tautan Pesanan itu.
 */
export async function bacaPesananLewatTautan(tautan: string) {
  const [baris] = await db
    .select({
      id: pesanan.id,
      nomorPesanan: pesanan.nomorPesanan,
      status: pesanan.status,
      produkId: produk.id,
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      gambarQr: pesanan.gambarQr,
      kedaluwarsaPada: pesanan.kedaluwarsaPada,
      hargaJual: pesanan.hargaJual,
      potonganVoucher: pesanan.potonganVoucher,
      kodeVoucher: pesanan.kodeVoucher,
      kodeUnik: pesanan.kodeUnik,
      totalBayar: pesanan.totalBayar,
      metode: pesanan.metode,
    })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(eq(pesanan.tautan, tautan));
  if (!baris) return null;

  const {
    id,
    hargaJual,
    potonganVoucher,
    kodeVoucher,
    kodeUnik,
    totalBayar,
    metode,
    ...lainnya
  } = baris;
  return {
    ...lainnya,
    rincian: {
      hargaJual,
      potonganVoucher,
      kodeVoucher,
      kodeUnik,
      totalBayar,
      metode,
    },
    itemStok: itemStokTampil(baris.status)
      ? await bacaItemStokPesananSelesai(id, baris.nomorPesanan)
      : null,
    dibacaPada: new Date(),
  };
}

/** Status Pesanan di Tautan Pesanan itu, atau null bila tidak ada Pesanan dengan Tautan Pesanan itu. */
export async function bacaStatusPesanan(tautan: string) {
  const [baris] = await db
    .select({ status: pesanan.status })
    .from(pesanan)
    .where(eq(pesanan.tautan, tautan));
  return baris?.status ?? null;
}
