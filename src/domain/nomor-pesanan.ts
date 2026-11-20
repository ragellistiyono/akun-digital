// Nomor Pesanan (PRD §9.6): MIWE- diikuti 6 karakter acak dari huruf besar dan angka, tanpa karakter
// yang mirip, yaitu O, 0, I, dan 1. Nomor Top up (PRD §15.3) memakai aturan karakter yang sama dengan
// awalan TOPUP-.

const AWALAN = "MIWE-";

/** Karakter Nomor Pesanan: A–Z tanpa I dan O, lalu 2–9. Jumlahnya 32. */
const KARAKTER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PANJANG = 6;

/**
 * Nomor berawalan `awalan` dari 6 byte acak, dengan karakter Nomor Pesanan (PRD §9.6). Keacakannya diambil
 * lapisan server, karena modul domain tidak membaca sumber acak. Setiap byte memilih satu dari 32 karakter;
 * 256 habis dibagi 32, jadi setiap karakter muncul sama sering. `nama` dan `fungsi` dipakai di pesan galat.
 */
export function nomorAcak(
  { awalan, nama, fungsi }: { awalan: string; nama: string; fungsi: string },
  byteAcak: Uint8Array,
): string {
  if (byteAcak.length < PANJANG) {
    throw new RangeError(
      `${nama} butuh ${PANJANG} byte acak, tetapi hanya mendapat ${byteAcak.length}. Panggil ${fungsi} dengan ${PANJANG} byte acak yang dibuat di lapisan server.`,
    );
  }
  const acak = Array.from(
    byteAcak.subarray(0, PANJANG),
    (byte) => KARAKTER[byte % KARAKTER.length],
  );
  return `${awalan}${acak.join("")}`;
}

/** Apakah teks itu berbentuk `awalan` diikuti 6 karakter Nomor Pesanan (PRD §9.6). */
export function nomorAcakSah(awalan: string, nomor: string): boolean {
  return new RegExp(`^${awalan}[${KARAKTER}]{${PANJANG}}$`).test(nomor);
}

/** Nomor Pesanan dari 6 byte acak (PRD §9.6). */
export function nomorPesanan(byteAcak: Uint8Array): string {
  return nomorAcak(
    { awalan: AWALAN, nama: "Nomor Pesanan", fungsi: "nomorPesanan" },
    byteAcak,
  );
}

/** Apakah teks itu berbentuk Nomor Pesanan (PRD §9.6). */
export function nomorPesananSah(nomor: string): boolean {
  return nomorAcakSah(AWALAN, nomor);
}
