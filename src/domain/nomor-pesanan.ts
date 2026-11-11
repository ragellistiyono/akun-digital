// Nomor Pesanan (PRD §9.6): MIWE- diikuti 6 karakter acak dari huruf besar dan angka, tanpa karakter
// yang mirip, yaitu O, 0, I, dan 1.

const AWALAN = "MIWE-";

/** Karakter Nomor Pesanan: A–Z tanpa I dan O, lalu 2–9. Jumlahnya 32. */
const KARAKTER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PANJANG = 6;

const POLA = new RegExp(`^${AWALAN}[${KARAKTER}]{${PANJANG}}$`);

/**
 * Nomor Pesanan dari 6 byte acak (PRD §9.6). Keacakannya diambil lapisan server, karena modul domain
 * tidak membaca sumber acak. Setiap byte memilih satu dari 32 karakter; 256 habis dibagi 32, jadi setiap
 * karakter muncul sama sering.
 */
export function nomorPesanan(byteAcak: Uint8Array): string {
  if (byteAcak.length < PANJANG) {
    throw new RangeError(
      `Nomor Pesanan butuh ${PANJANG} byte acak, tetapi hanya mendapat ${byteAcak.length}.`,
    );
  }
  const acak = Array.from(
    byteAcak.subarray(0, PANJANG),
    (byte) => KARAKTER[byte % KARAKTER.length],
  );
  return `${AWALAN}${acak.join("")}`;
}

/** Apakah teks itu berbentuk Nomor Pesanan (PRD §9.6). */
export function nomorPesananSah(nomor: string): boolean {
  return POLA.test(nomor);
}
