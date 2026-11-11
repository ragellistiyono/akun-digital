const formatAngka = new Intl.NumberFormat("id-ID");

/** Angka rupiah dengan titik pemisah ribuan, misalnya "135.000". */
export function angkaRupiah(nilai: number) {
  return formatAngka.format(nilai);
}

/** Nominal rupiah untuk ditampilkan, misalnya "Rp 135.000". */
export function rupiah(nilai: number) {
  return `Rp ${angkaRupiah(nilai)}`;
}
