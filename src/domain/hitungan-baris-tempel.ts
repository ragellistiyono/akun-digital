/**
 * Hitungan "N baris akan diproses" di bawah kotak tempel Item stok (PRD §4.2 ▶ Keputusan 2026-11-20): jumlah
 * baris teks tempelan yang tidak kosong. Baris kosong dan baris yang hanya berisi spasi atau tab tidak dihitung,
 * karena tempelItemStok mengabaikannya. Baris dipisah dengan cara yang sama seperti tempelItemStok (akhir baris
 * `\n` atau `\r\n`), jadi N selalu sama dengan jumlah tersimpan ditambah ditolak setelah tempelan disimpan.
 */
export function hitunganBarisTempel(teks: string) {
  return {
    jumlahBaris: teks.split(/\r?\n/).filter((baris) => baris.trim() !== "")
      .length,
  };
}
