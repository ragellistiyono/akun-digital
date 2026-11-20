// Grafik Produk terlaris di Laporan keuangan (PRD §14.7 grafik 4).

/** Jumlah paling banyak Produk di grafik Produk terlaris (PRD §14.7). */
const JUMLAH_PRODUK_TERLARIS = 10;

/** Pembanding nama Produk A sampai Z, tanpa membedakan huruf besar dan kecil. */
const pembandingNama = new Intl.Collator("id", { sensitivity: "base" });

type PesananSelesaiProduk = {
  produkId: string;
  namaProduk: string;
  totalBayar: number;
};

/**
 * Produk terlaris dari Pesanan Selesai yang sudah lolos saringan Laporan keuangan (PRD §14.7 grafik 4,
 * tests/golden/produk-terlaris.json). Pesanan dijumlahkan per Produk dari semua Variannya, dan Pendapatan setiap
 * Produk adalah jumlah Total bayar Pesanan-nya. Paling banyak 10 Produk, urut jumlah Pesanan Selesai terbanyak,
 * lalu Pendapatan terbesar, lalu nama Produk A sampai Z. Produk dikenali dari id-nya, jadi dua Produk bernama
 * sama tidak digabung. Setiap Produk membawa Pesanan yang dihitungnya sebagai bahan hitung.
 */
export function produkTerlaris<P extends PesananSelesaiProduk>({
  pesananSelesai,
}: {
  pesananSelesai: readonly P[];
}) {
  const perProduk = new Map<
    string,
    { produkId: string; namaProduk: string; dihitung: P[] }
  >();
  for (const p of pesananSelesai) {
    const produk = perProduk.get(p.produkId) ?? {
      produkId: p.produkId,
      namaProduk: p.namaProduk,
      dihitung: [],
    };
    produk.dihitung.push(p);
    perProduk.set(p.produkId, produk);
  }

  const terlaris = [...perProduk.values()]
    .map((produk) => ({
      ...produk,
      pesananSelesai: produk.dihitung.length,
      pendapatan: produk.dihitung.reduce(
        (jumlah, p) => jumlah + p.totalBayar,
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.pesananSelesai - a.pesananSelesai ||
        b.pendapatan - a.pendapatan ||
        pembandingNama.compare(a.namaProduk, b.namaProduk) ||
        (a.produkId < b.produkId ? -1 : a.produkId > b.produkId ? 1 : 0),
    )
    .slice(0, JUMLAH_PRODUK_TERLARIS);

  return { terlaris };
}
