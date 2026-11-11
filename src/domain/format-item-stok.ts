/** Sebab sebuah Format Item stok ditolak. Nomor kolom dihitung dari 1, sesuai urutan isian. */
export type MasalahFormatItemStok =
  | { alasan: "tanpa-kolom" }
  | { alasan: "kolom-kosong"; nomorKolom: number[] }
  | { alasan: "kolom-kembar"; nomorKolom: number[] };

export type HasilFormatItemStok =
  | { sah: true; kolom: string[] }
  | { sah: false; masalah: MasalahFormatItemStok[] };

/**
 * Memeriksa Format Item stok sebuah Produk, yaitu daftar nama kolom (PRD §4.1). Aturannya dari
 * issue T07 (#14): minimal satu kolom, dan nama kolom tidak boleh kosong atau kembar.
 *
 * Spasi di awal dan akhir nama kolom dibuang. Dua nama kolom dianggap kembar bila sama persis
 * setelah itu, termasuk huruf besar dan kecilnya. Dari nama yang kembar, kolom pertama
 * dipertahankan dan kolom berikutnya disebut. Kolom kosong tidak dihitung kembar.
 */
export function periksaFormatItemStok(kolom: string[]): HasilFormatItemStok {
  if (kolom.length === 0) {
    return { sah: false, masalah: [{ alasan: "tanpa-kolom" }] };
  }

  const namaKolom = kolom.map((nama) => nama.trim());
  const kosong: number[] = [];
  const kembar: number[] = [];
  const sudahAda = new Set<string>();
  namaKolom.forEach((nama, indeks) => {
    if (nama === "") {
      kosong.push(indeks + 1);
      return;
    }
    if (sudahAda.has(nama)) kembar.push(indeks + 1);
    sudahAda.add(nama);
  });

  const masalah: MasalahFormatItemStok[] = [];
  if (kosong.length > 0) {
    masalah.push({ alasan: "kolom-kosong", nomorKolom: kosong });
  }
  if (kembar.length > 0) {
    masalah.push({ alasan: "kolom-kembar", nomorKolom: kembar });
  }
  return masalah.length > 0
    ? { sah: false, masalah }
    : { sah: true, kolom: namaKolom };
}
