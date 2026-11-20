// Format rupiah toko untuk teks yang dilihat pengguna, misalnya "Rp 135.000".
const formatAngka = new Intl.NumberFormat("id-ID");

/** Angka rupiah dengan titik pemisah ribuan, misalnya "135.000". */
export function angkaRupiah(nilai: number) {
  return formatAngka.format(nilai);
}

/** Nominal rupiah untuk ditampilkan, misalnya "Rp 135.000". */
export function rupiah(nilai: number) {
  return `Rp ${angkaRupiah(nilai)}`;
}

/** Nominal rupiah yang bisa negatif, misalnya laba: "Rp 15.000", atau "−Rp 10.000" dengan tanda minus. */
export function rupiahBertanda(nilai: number) {
  return nilai < 0 ? `−${rupiah(-nilai)}` : rupiah(nilai);
}
