// Format dan pembacaan rupiah toko ada di modul domain, supaya pesan dan aturan dari domain memakai format yang
// sama (PRD §8.7, §15.6).
export {
  angkaRupiah,
  rupiah,
  rupiahBertanda,
  rupiahDariTeks,
  rupiahPlusMinus,
} from "@/domain/rupiah";
