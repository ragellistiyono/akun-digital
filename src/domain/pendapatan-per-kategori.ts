// Grafik Pendapatan per Kategori di Laporan keuangan (PRD §14.7 grafik 5).
import { pendapatanPesanan } from "./pendapatan";

/** Pembanding nama Kategori A sampai Z, tanpa membedakan huruf besar dan kecil. */
const pembandingNama = new Intl.Collator("id", { sensitivity: "base" });

type PesananSelesaiKategori = {
  kategoriId: string;
  namaKategori: string;
  hargaJual: number;
  potonganVoucher: number;
};

/**
 * Pendapatan per Kategori dari Pesanan Selesai yang sudah lolos saringan Laporan keuangan (PRD §14.7 grafik 5).
 * Kategori sebuah Pesanan adalah Kategori Produknya saat Laporan dibuka (§14.6), dan Pendapatan-nya adalah jumlah
 * (Harga jual − potongan voucher), tanpa Kode unik (§9.3 ▶ Keputusan 2026-11-23). Kategori diurutkan menurut Pendapatan terbesar, lalu nama Kategori A sampai Z. Kategori tanpa
 * Pesanan Selesai tidak ada di hasilnya. Setiap Kategori membawa Pesanan yang dihitungnya sebagai bahan hitung.
 */
export function pendapatanPerKategori<P extends PesananSelesaiKategori>({
  pesananSelesai,
}: {
  pesananSelesai: readonly P[];
}) {
  const perKategori = new Map<
    string,
    { kategoriId: string; namaKategori: string; dihitung: P[] }
  >();
  for (const p of pesananSelesai) {
    const kategori = perKategori.get(p.kategoriId) ?? {
      kategoriId: p.kategoriId,
      namaKategori: p.namaKategori,
      dihitung: [],
    };
    kategori.dihitung.push(p);
    perKategori.set(p.kategoriId, kategori);
  }

  const kategori = [...perKategori.values()]
    .map((k) => ({
      ...k,
      pesananSelesai: k.dihitung.length,
      pendapatan: k.dihitung.reduce(
        (jumlah, p) => jumlah + pendapatanPesanan(p),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.pendapatan - a.pendapatan ||
        pembandingNama.compare(a.namaKategori, b.namaKategori),
    );

  return { kategori };
}
