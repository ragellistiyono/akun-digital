// Menilai satu kode Voucher untuk satu checkout (PRD §8.1–§8.5, §8.7): diterima dengan potongan voucher berapa,
// atau ditolak dengan pesan apa. Dipakai tombol "Pakai" dan pembuatan Pesanan di Checkout (src/server/pesanan.ts).
import { eq, sql } from "drizzle-orm";

import { kelayakanVoucher } from "@/domain/kelayakan-voucher";
import { kodeBaku } from "@/domain/kode-voucher";
import { pemakaianVoucher } from "@/domain/pemakaian-voucher";
import { penerapanVoucher } from "@/domain/penerapan-voucher";
import type { PotonganVoucherDiatur } from "@/domain/potongan-voucher";

import { bacaSesiMember } from "./auth/sesi-member";
import { db } from "./db";
import { pesanan, produk, varian, voucher } from "./db/schema";
import { bacaVoucher } from "./voucher";

/** Produk, Kategori Produk, dan Harga jual sebuah Varian pada saat ini, atau undefined bila Varian tidak ada. */
async function bacaVarianCheckout(varianId: string) {
  const [baris] = await db
    .select({
      produk: produk.id,
      kategori: produk.kategoriId,
      hargaJual: varian.hargaJual,
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(eq(varian.id, varianId));
  return baris;
}

type Penghubung = Pick<typeof db, "select">;

/**
 * Voucher dengan kode itu tanpa membedakan huruf besar dan kecil (PRD §8.1), beserta Cakupan voucher-nya, atau
 * null bila tidak ada. Bila `kunci`, baris Voucher itu dikunci FOR UPDATE sampai transaksi `penghubung` selesai.
 */
async function bacaVoucherLewatKode(
  penghubung: Penghubung,
  kode: string,
  kunci: boolean,
) {
  const cari = penghubung
    .select({ id: voucher.id })
    .from(voucher)
    .where(sql`upper(btrim(${voucher.kode})) = ${kodeBaku(kode)}`);
  const [baris] = kunci ? await cari.for("update") : await cari;
  return baris ? bacaVoucher(baris.id, penghubung) : null;
}

/**
 * Pengganti jenis potongan bila tidak ada Voucher dengan kode itu. kelayakanVoucher selalu menolak kode yang
 * tidak ada, jadi penerapanVoucher tidak pernah menghitung potongan dari nilai ini.
 */
const POTONGAN_KODE_TIDAK_DITEMUKAN: PotonganVoucherDiatur = {
  jenisPotongan: "nominal",
  nilai: 0,
  batasMaksimum: null,
};

/** Email checkout yang dipakai Batas per email, atau null bila email masih kosong. */
const emailAtauNull = (email: string | null) =>
  email === null || email.trim() === "" ? null : email;

/** Varian checkout yang dinilai: Produk, Kategori Produk, dan Harga jual-nya. */
type VarianDinilai = { produk: string; kategori: string; hargaJual: number };

/**
 * Menilai kode Voucher untuk satu checkout Varian itu, pada saat ini, dengan bacaan lewat `penghubung`. Hasilnya
 * penerapanVoucher: Voucher dipakai dengan potongan vouchernya, beserta id dan kode Voucher untuk dicatat di
 * Pesanan, atau ditolak dengan pesan penolakan PRD §8.7.
 *
 * - `emailCheckout` adalah email yang dipakai Batas per email, atau null bila belum diketahui (PRD §8.7 ▶
 *   Keputusan 2026-11-17). `member` menyatakan apakah Pembeli login sebagai Member.
 * - Bila `kunci`, baris Voucher dikunci FOR UPDATE sebelum pemakaiannya dihitung, sehingga checkout lain yang
 *   menilai Voucher yang sama di dalam transaksinya menunggu sampai transaksi `penghubung` selesai, lalu
 *   menghitung Pesanan yang baru disimpannya (PRD §8.5). Penguncian ini hanya berarti di dalam transaksi.
 */
export async function nilaiVoucherCheckout(
  penghubung: Penghubung,
  {
    kode,
    varian: checkout,
    emailCheckout,
    member,
    kunci,
  }: {
    kode: string;
    varian: VarianDinilai;
    emailCheckout: string | null;
    member: boolean;
    kunci: boolean;
  },
) {
  const voucherDinilai = await bacaVoucherLewatKode(penghubung, kode, kunci);
  const pesananDenganVoucher = voucherDinilai
    ? await penghubung
        .select({ email: pesanan.email, status: pesanan.status })
        .from(pesanan)
        .where(eq(pesanan.voucherId, voucherDinilai.id))
    : [];
  const pemakaian = pemakaianVoucher({ emailCheckout, pesananDenganVoucher });

  const kelayakan = kelayakanVoucher({
    voucher: voucherDinilai,
    checkout: { ...checkout, kodeDiketik: kode, waktu: new Date(), member },
    pemakaian,
  });
  const hasil = penerapanVoucher({
    hargaJual: checkout.hargaJual,
    voucher: voucherDinilai ?? POTONGAN_KODE_TIDAK_DITEMUKAN,
    kelayakan,
  });
  if (!hasil.dipakai) return hasil;
  if (!voucherDinilai) {
    throw new Error(
      `Kode voucher "${kode}" diterima padahal tidak ada Voucher dengan kode itu. kelayakanVoucher seharusnya menolak kode yang tidak ada dengan "Kode voucher tidak ditemukan"; periksa src/domain/kelayakan-voucher.ts.`,
    );
  }
  return {
    ...hasil,
    voucherId: voucherDinilai.id,
    kodeVoucher: voucherDinilai.kode,
  };
}

/**
 * Menilai kode Voucher yang diketik Pembeli untuk checkout Varian itu, pada saat ini, menurut
 * nilaiVoucherCheckout. Hasilnya null bila tidak ada Varian dengan id itu.
 *
 * - Kode dicocokkan tanpa membedakan huruf besar dan kecil (PRD §8.1).
 * - Produk dan Kategori Produk dibaca pada saat penilaian, jadi Produk yang dipindah ke Kategori lain dinilai
 *   dengan Kategori barunya (PRD §8.4 ▶ Keputusan 2026-11-17).
 * - Status login Member dibaca dari sesi di `kepala`. Bila Member sedang login, Batas per email memakai email
 *   Member itu, sama seperti email Pesanan-nya (PRD §5.2); bila tidak, memakai `email`.
 * - `email` boleh null atau kosong. Dalam keadaan itu Batas per email tidak diperiksa (PRD §8.7 ▶ Keputusan
 *   2026-11-17).
 * - Pemakaian dihitung pemakaianVoucher dari semua Pesanan yang mencatat Voucher itu (PRD §8.5).
 */
export async function nilaiVoucher({
  kode,
  varianId,
  email,
  kepala,
}: {
  kode: string;
  varianId: string;
  email: string | null;
  kepala: Headers;
}) {
  const [checkout, sesiMember] = await Promise.all([
    bacaVarianCheckout(varianId),
    bacaSesiMember(kepala),
  ]);
  if (!checkout) return null;
  return nilaiVoucherCheckout(db, {
    kode,
    varian: checkout,
    emailCheckout: sesiMember ? sesiMember.user.email : emailAtauNull(email),
    member: sesiMember !== null,
    kunci: false,
  });
}
