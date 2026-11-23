// Produk gratis (PRD §16): isian Batas per Member (§16.1, §16.2), Sisa jatah (§16.2), urutan pemeriksaan "Ambil gratis" (§16.3), dan
// nominal yang dicatat Pesanan gratis (§16.5). Batas Pesanan menunggu ada di batas-pesanan-menunggu.ts, dan Varian
// habis ada di stok-varian.ts.
import type { Metode } from "./bayar-saldo";
import type { HasilBatasPesananMenunggu } from "./batas-pesanan-menunggu";
import { emailSama } from "./kesamaan-email";
import { varianHabis } from "./stok-varian";

/**
 * Nominal yang dicatat setiap Pesanan gratis (PRD §16.5): Harga jual, potongan voucher, Kode unik, Total bayar, dan
 * Biaya transaksi Rp 0. Harga modal-nya adalah Harga modal Varian saat itu (PRD §14.1).
 */
export const NOMINAL_PESANAN_GRATIS = {
  hargaJual: 0,
  potonganVoucher: 0,
  kodeUnik: 0,
  totalBayar: 0,
  biayaTransaksi: 0,
} as const;

/** Batas per Member terkecil dan terbesar yang boleh disimpan (PRD §16.2). */
export const BATAS_PER_MEMBER_MINIMUM = 1;
export const BATAS_PER_MEMBER_MAKSIMUM = 999;

export type AlasanBatasPerMemberDitolak =
  "kosong" | "bukan-bilangan-bulat" | "di-luar-rentang";

/** Isian yang berupa bilangan bulat: angka saja, boleh diawali tanda minus. */
const POLA_BILANGAN_BULAT = /^-?[0-9]+$/;

/**
 * Memeriksa isian Batas per Member di form Produk (PRD §16.1, §16.2, tests/golden/isian-batas-per-member.json).
 * `batas` adalah teks isian apa adanya; spasi di awal dan akhirnya dibuang.
 * - Bila `produkGratis` false, isian tidak dipakai: hasilnya sah dan `batasTersimpan` null, apa pun isinya.
 * - Bila `produkGratis` true, Batas per Member wajib berupa bilangan bulat 1 sampai 999. Isian kosong ditolak dengan
 *   alasan "kosong", isian yang bukan bilangan bulat dengan "bukan-bilangan-bulat", dan bilangan bulat di luar rentang
 *   itu dengan "di-luar-rentang". `batasTersimpan` adalah Batas per Member yang disimpan, atau null bila ditolak.
 */
export function periksaBatasPerMember({
  produkGratis,
  batas,
}: {
  produkGratis: boolean;
  batas: string;
}):
  | { sah: true; alasan: null; batasTersimpan: number | null }
  | { sah: false; alasan: AlasanBatasPerMemberDitolak; batasTersimpan: null } {
  if (!produkGratis) return { sah: true, alasan: null, batasTersimpan: null };
  const isian = batas.trim();
  if (isian === "") {
    return { sah: false, alasan: "kosong", batasTersimpan: null };
  }
  if (!POLA_BILANGAN_BULAT.test(isian)) {
    return { sah: false, alasan: "bukan-bilangan-bulat", batasTersimpan: null };
  }
  const angka = Number(isian);
  if (angka < BATAS_PER_MEMBER_MINIMUM || angka > BATAS_PER_MEMBER_MAKSIMUM) {
    return { sah: false, alasan: "di-luar-rentang", batasTersimpan: null };
  }
  return { sah: true, alasan: null, batasTersimpan: angka };
}

/** Keterangan Halaman Produk gratis di bawah harganya, "Gratis khusus Member, maksimal M per Member" (PRD §16.4). */
export function keteranganProdukGratis({
  batasPerMember,
}: {
  batasPerMember: number;
}) {
  return `Gratis khusus Member, maksimal ${batasPerMember} per Member`;
}

/** Pesanan yang diperiksa untuk jatah terpakai: Produk-nya, Metode-nya, dan email-nya. */
type PesananJatah = { produk: string; metode: Metode; email: string };

/**
 * Sisa jatah seorang Member untuk satu Produk gratis (PRD §16.2, tests/golden/batas-per-member.json):
 * - jatah terpakai = jumlah Pesanan bermetode Gratis untuk Produk itu, dari semua Variannya, yang emailnya sama dengan
 *   email Member menurut §7.4, sepanjang waktu. Pesanan QRIS dan Saldo dari Produk itu tidak dihitung;
 * - Sisa jatah = Batas per Member − jatah terpakai, paling kecil 0. Member boleh mengambil bila Sisa jatah lebih
 *   dari 0;
 * - `teksJatah` adalah baris "Jatah Anda: sisa N dari M" di Checkout (§16.3);
 * - `pesanJatahHabis` adalah "Anda sudah mengambil N dari batas M untuk Produk ini." bila Sisa jatah 0, yang tampil
 *   sebagai pengganti tombol "Ambil gratis" dan sebagai penolakan (§16.3), atau null bila masih ada sisa.
 *
 * `produk` adalah penanda Produk gratis itu, dengan bentuk yang sama seperti `produk` di setiap Pesanan. Hasilnya
 * membawa Batas per Member dan Pesanan yang dihitung sebagai bahan hitungnya.
 */
export function sisaJatah<P extends PesananJatah>({
  produk,
  emailMember,
  batasPerMember,
  pesanan,
}: {
  produk: string;
  emailMember: string;
  batasPerMember: number;
  pesanan: readonly P[];
}) {
  const dihitung = pesanan.filter(
    (p) =>
      p.produk === produk &&
      p.metode === "Gratis" &&
      emailSama(p.email, emailMember),
  );
  const jatahTerpakai = dihitung.length;
  const sisa = Math.max(0, batasPerMember - jatahTerpakai);
  return {
    batasPerMember,
    jatahTerpakai,
    sisaJatah: sisa,
    bolehAmbil: sisa > 0,
    teksJatah: `Jatah Anda: sisa ${sisa} dari ${batasPerMember}`,
    pesanJatahHabis:
      sisa > 0
        ? null
        : `Anda sudah mengambil ${jatahTerpakai} dari batas ${batasPerMember} untuk Produk ini.`,
    dihitung,
  };
}

/** Hasil sisaJatah yang dipakai pemeriksaan "Ambil gratis": pesan jatah habisnya, atau null bila masih ada sisa. */
type JatahDinilai = Pick<ReturnType<typeof sisaJatah>, "pesanJatahHabis">;

type HasilAmbilGratis<V, P> =
  | { hasil: "tidak-dijual" }
  | { hasil: "tidak-gratis" }
  | { hasil: "tidak-login" }
  | { hasil: "pesanan-menunggu"; pesananMenunggu: P }
  | { hasil: "stok-habis" }
  | { hasil: "jatah-habis"; pesan: string }
  | { hasil: "boleh"; varianDijual: V };

/**
 * Hasil "Ambil gratis" untuk satu Varian. Pemeriksaannya berurutan, dan yang pertama menolak menentukan hasilnya
 * (PRD §16.3):
 * 1. Varian atau Produk yang tidak dijual (`varianDijual` undefined) ditolak (PRD §3.7);
 * 2. Produk yang tidak lagi gratis (`varianDijual.gratis` false) ditolak;
 * 3. tanpa Member yang sedang login (`member` null), misalnya karena sesinya habis, ditolak;
 * 4. email Member yang masih punya Pesanan Menunggu Pembayaran menurut `batasPesananMenunggu` mengikuti batas Pesanan
 *    menunggu (PRD §5.4), dan hasilnya membawa Pesanan yang menghalangi itu;
 * 5. Varian dengan Stok Varian 0 ditolak karena stok habis (PRD §5.2);
 * 6. Sisa jatah 0 menurut `jatah` (hasil sisaJatah) ditolak dengan pesan jatah habisnya.
 *
 * Bila tidak ada yang menolak, Pesanan gratis untuk Varian itu boleh dibuat, dan hasilnya membawa Varian itu.
 */
export function hasilAmbilGratis<V extends { gratis: boolean }, P>({
  varianDijual,
  member,
  stokVarian,
}: {
  varianDijual: V | undefined;
  member: {
    batasPesananMenunggu: HasilBatasPesananMenunggu<P>;
    jatah: JatahDinilai;
  } | null;
  stokVarian: number;
}): HasilAmbilGratis<V, P> {
  if (varianDijual === undefined) return { hasil: "tidak-dijual" };
  if (!varianDijual.gratis) return { hasil: "tidak-gratis" };
  if (member === null) return { hasil: "tidak-login" };
  if (!member.batasPesananMenunggu.boleh) {
    return {
      hasil: "pesanan-menunggu",
      pesananMenunggu: member.batasPesananMenunggu.pesananMenunggu,
    };
  }
  if (varianHabis(stokVarian)) return { hasil: "stok-habis" };
  if (member.jatah.pesanJatahHabis !== null) {
    return { hasil: "jatah-habis", pesan: member.jatah.pesanJatahHabis };
  }
  return { hasil: "boleh", varianDijual };
}
