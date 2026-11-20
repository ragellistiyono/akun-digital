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

/** Nominal rupiah yang selalu bertanda, misalnya di Riwayat saldo (PRD §15.2): "+Rp 50.000" atau "−Rp 45.000". */
export function rupiahPlusMinus(nilai: number) {
  return nilai < 0 ? `−${rupiah(-nilai)}` : `+${rupiah(nilai)}`;
}

// Harga ditulis seperti kebiasaan di Indonesia: titik memisahkan ribuan dan koma memisahkan sen,
// boleh diawali "Rp". Contohnya "50000", "50.000", "Rp 50.000", dan "1.500,5".
const POLA_RUPIAH = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;

/** Nilai rupiah dari teks isian, atau null bila teksnya bukan angka rupiah. */
export function rupiahDariTeks(teks: string) {
  const angka = teks.replace(/^rp\.?\s*/i, "");
  if (!POLA_RUPIAH.test(angka)) return null;
  return Number(angka.replaceAll(".", "").replace(",", "."));
}
