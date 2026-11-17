// Pesanan (PRD §5.1, §5.5, §6.2, §9.6) beserta QRIS-nya dari Qrispy (ADR-0004) dan Item stok yang
// ditahannya (PRD §5.3) atau dikirim kepadanya (PRD §6.1). Aturan Total bayar dan pemeriksaan nominal QRIS
// ada di src/domain/total-bayar.ts; bentuk Nomor Pesanan ada di src/domain/nomor-pesanan.ts; Stok Varian
// ada di src/domain/stok-varian.ts; kapan dan bagaimana Item stok Terkirim tampil ada di
// src/domain/item-stok-terkirim.ts; batas Pesanan Menunggu Pembayaran per email ada di
// src/domain/batas-pesanan-menunggu.ts; email Member nonaktif ada di src/domain/member-nonaktif.ts; urutan
// pemeriksaan checkout ada di src/domain/checkout.ts; penilaian Voucher ada di src/server/penilaian-voucher.ts.
import { randomBytes } from "node:crypto";

import { and, DrizzleQueryError, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";

import { batasPesananMenunggu } from "@/domain/batas-pesanan-menunggu";
import { hasilCheckout } from "@/domain/checkout";
import {
  itemStokTampil,
  kolomItemStokTerkirim,
} from "@/domain/item-stok-terkirim";
import { emailBaku } from "@/domain/kesamaan-email";
import { emailMilikMemberNonaktif } from "@/domain/member-nonaktif";
import { nomorPesanan } from "@/domain/nomor-pesanan";
import { nominalTagihanQris, periksaTagihanQris } from "@/domain/total-bayar";

import { db } from "./db";
import {
  itemStok,
  pesanan,
  produk,
  riwayatStatusPesanan,
  user,
  varian,
} from "./db/schema";
import { bukaItemStok } from "./enkripsi-item-stok";
import { bacaStokVarian } from "./item-stok";
import { jadwalkanKedaluwarsaPesanan } from "./pekerjaan-latar";
import { nilaiVoucherCheckout } from "./penilaian-voucher";
import { qrispyAktif, type QrisBaru, type Qrispy } from "./qrispy";

/** Potongan voucher Pesanan tanpa Voucher, dan Perkiraan bayar di form Checkout sebelum Voucher dipakai. */
const POTONGAN_VOUCHER_TANPA_VOUCHER = 0;

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
 * Produk-nya ikut dibaca untuk Cakupan voucher (PRD §8.4).
 */
async function varianDijual(varianId: string) {
  const [baris] = await db
    .select({
      namaProduk: produk.nama,
      namaVarian: varian.nama,
      hargaJual: varian.hargaJual,
      produkId: produk.id,
      kategoriId: produk.kategoriId,
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
 * Isi form checkout sebuah Varian (PRD §5.2): nama Produk dan Varian, Harga jual, dan Perkiraan bayar,
 * yaitu nominal yang akan dikirim ke Qrispy sebelum Qrispy menambahkan Kode unik (docs/DESIGN.md "Rincian
 * Total bayar"). Hasilnya null bila Varian itu tidak bisa dibeli (PRD §3.7).
 */
export async function bacaCheckout(varianId: string) {
  const dijual = await varianDijual(varianId);
  if (!dijual) return null;
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
  };
}

type Penghubung = Pick<typeof db, "select">;

type VarianDijual = NonNullable<Awaited<ReturnType<typeof varianDijual>>>;

/**
 * Hasil checkout Varian itu menurut hasilCheckout (PRD §3.7, §5.2, §5.4, §8.7). `varianDijual` adalah Varian yang
 * dijual menurut varianDijual, atau undefined bila tidak dijual. Member nonaktif, Pesanan Menunggu Pembayaran,
 * Stok Varian, dan Voucher dibaca lewat `penghubung`, supaya pemeriksaan ini bisa diulang di dalam transaksi
 * checkout. Hasil yang boleh membawa Voucher yang dipakai, atau null. Kode voucher hanya dinilai bila diisi (`kodeVoucher` tidak null) dan Varian itu dijual, dengan Harga
 * jual `varianDijual`. Bila `kunciVoucher`, Voucher itu dikunci sampai transaksi `penghubung` selesai
 * (nilaiVoucherCheckout).
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
  }: {
    varianDijual: VarianDijual | undefined;
    varianId: string;
    email: string;
    kodeVoucher: string | null;
    member: boolean;
    kunciVoucher: boolean;
  },
) {
  // Saringan Member nonaktif dan status Pesanan hanya mempersempit bacaan; emailMilikMemberNonaktif dan
  // batasPesananMenunggu yang memutuskan.
  const semuaMemberNonaktif = await penghubung
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.peran, "Member"), eq(user.nonaktif, true)));
  const pesananLain = await penghubung
    .select({
      email: pesanan.email,
      status: pesanan.status,
      tautan: pesanan.tautan,
      kedaluwarsaPada: pesanan.kedaluwarsaPada,
    })
    .from(pesanan)
    .where(eq(pesanan.status, "Menunggu Pembayaran"));
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
  const hasil = hasilCheckout({
    varianDijual,
    memberNonaktif: emailMilikMemberNonaktif({ email, semuaMemberNonaktif }),
    batasPesananMenunggu: batasPesananMenunggu({ email, pesananLain }),
    stokVarian,
    voucher: voucherDinilai,
  });
  // Checkout yang boleh membawa Voucher yang dipakai, atau null bila kode voucher tidak diisi.
  return hasil.hasil === "boleh"
    ? { ...hasil, voucher: voucherDinilai?.dipakai ? voucherDinilai : null }
    : hasil;
}

type HasilPesananMenunggu =
  | { hasil: "pesanan-menunggu-di-browser-ini"; tautan: string }
  | { hasil: "pesanan-menunggu-di-browser-lain"; kedaluwarsaPada: Date };

type HasilCheckoutDitolak =
  | { hasil: "tidak-dijual" }
  | { hasil: "member-nonaktif" }
  | { hasil: "stok-habis" }
  | { hasil: "voucher-ditolak"; pesan: string }
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
  const { tautan, kedaluwarsaPada } = ditolak.pesananMenunggu;
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
 * - Harga jual dan potongan voucher dicatat saat checkout, beserta id dan kode Voucher yang dipakai. Qrispy
 *   diminta Harga jual − potongan voucher. Kode unik, Total bayar, waktu kedaluwarsa, dan gambar QR diambil
 *   dari QRIS yang diterbitkan Qrispy, dengan Nomor Pesanan sebagai payment_reference.
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
 * rincian nominal yang dicatat di Pesanan (PRD §5.5) beserta kode Voucher-nya atau null bila tanpa Voucher, dan kolom-kolom Item stok-nya. Item stok hanya
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
    ...lainnya
  } = baris;
  return {
    ...lainnya,
    rincian: { hargaJual, potonganVoucher, kodeVoucher, kodeUnik, totalBayar },
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
