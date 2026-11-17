// Format rupiah toko ada di modul domain, supaya pesan dari domain memakai format yang sama (PRD §8.7).
export { angkaRupiah, rupiah } from "@/domain/rupiah";

// Harga ditulis seperti kebiasaan di Indonesia: titik memisahkan ribuan dan koma memisahkan sen,
// boleh diawali "Rp". Contohnya "50000", "50.000", "Rp 50.000", dan "1.500,5".
const POLA_RUPIAH = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;

/** Nilai rupiah dari teks isian, atau null bila teksnya bukan angka rupiah. */
export function rupiahDariTeks(teks: string) {
  const angka = teks.replace(/^rp\.?\s*/i, "");
  if (!POLA_RUPIAH.test(angka)) return null;
  return Number(angka.replaceAll(".", "").replace(",", "."));
}
