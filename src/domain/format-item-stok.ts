/** Sebab sebuah Format Item stok ditolak. Nomor kolom dihitung dari 1, sesuai urutan isian. */
export type MasalahFormatItemStok =
  | { alasan: "tanpa-kolom" }
  | { alasan: "kolom-kosong"; nomorKolom: number[] }
  | { alasan: "kolom-kembar"; nomorKolom: number[] };

export type HasilFormatItemStok =
  | { sah: true; kolom: string[] }
  | { sah: false; masalah: MasalahFormatItemStok[] };

/**
 * Memeriksa Format Item stok sebuah Produk, yaitu daftar nama kolom (PRD §4.1 ▶ Keputusan
 * 2026-11-11): minimal satu kolom, dan nama kolom tidak boleh kosong atau kembar.
 *
 * Spasi di awal dan akhir nama kolom dibuang. Dua nama kolom dianggap kembar tanpa membedakan
 * huruf besar dan kecil, jadi `Email` dan `email` kembar. Dari nama yang kembar, kolom pertama
 * dipertahankan dan kolom berikutnya disebut. Kolom kosong tidak dihitung kembar. Bila sah, nama
 * kolom dikembalikan dengan huruf seperti yang ditulis Admin.
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
    const namaBaku = nama.toLowerCase();
    if (sudahAda.has(namaBaku)) kembar.push(indeks + 1);
    sudahAda.add(namaBaku);
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

/** Jenis perubahan Format Item stok sebuah Produk yang sudah ada (PRD §4.1). */
export type PerubahanFormatItemStok =
  "ganti-nama" | "tambah-kolom" | "hapus-kolom";

/**
 * Apakah sebuah perubahan Format Item stok boleh dilakukan (PRD §4.1), menurut jumlah Item stok Tersedia dan
 * Ditahan Produk itu. Ganti nama kolom selalu boleh. Tambah atau hapus kolom hanya
 * boleh bila Produk itu tidak punya Item stok Tersedia atau Ditahan, karena isi Item stok itu tersimpan
 * menurut urutan kolom Format Item stok yang berlaku. Item stok Terkirim tidak menghalangi, karena tampil
 * dengan nama kolom yang dicatat saat Terkirim.
 */
export function bolehUbahFormatItemStok({
  perubahan,
  jumlahTersedia,
  jumlahDitahan,
}: {
  perubahan: PerubahanFormatItemStok;
  jumlahTersedia: number;
  jumlahDitahan: number;
}) {
  if (perubahan === "ganti-nama") return { boleh: true };
  return { boleh: jumlahTersedia === 0 && jumlahDitahan === 0 };
}

/**
 * Satu kolom Format Item stok baru yang disusun Admin: nama kolomnya, dan nomor kolom lamanya (dihitung
 * dari 1) bila kolom itu kolom Format Item stok lama, atau null bila kolom itu baru ditambah.
 */
export type KolomFormatBaru = { nama: string; nomorLama: number | null };

/**
 * Perubahan yang dikandung Format Item stok baru terhadap Format Item stok lama Produk itu (PRD §4.1),
 * menurut urutan ganti nama, tambah kolom, lalu hapus kolom. Daftar kosong berarti tidak ada perubahan.
 *
 * - Kolom lama yang namanya berbeda, setelah spasi di awal dan akhir dibuang, adalah ganti nama.
 * - Kolom tanpa nomor kolom lama, atau dengan nomor yang tidak ada di Format lama, adalah tambah kolom.
 * - Kolom lama yang tidak ada lagi di Format baru adalah hapus kolom.
 *
 * Isi Item stok tersimpan menurut urutan kolom, jadi kolom lama yang berpindah urutan dihitung dihapus dari
 * tempat lamanya lalu ditambah di tempat barunya. Hanya kolom lama yang tetap berurutan yang dihitung tetap.
 */
export function perubahanFormatItemStok({
  formatLama,
  formatBaru,
}: {
  formatLama: readonly string[];
  formatBaru: readonly KolomFormatBaru[];
}): PerubahanFormatItemStok[] {
  let gantiNama = false;
  let tambahKolom = false;
  let hapusKolom = false;
  // Nomor kolom lama berikutnya yang masih bisa dipertahankan menurut urutannya.
  let berikut = 1;
  for (const { nama, nomorLama } of formatBaru) {
    if (
      nomorLama === null ||
      nomorLama < berikut ||
      nomorLama > formatLama.length
    ) {
      tambahKolom = true;
      continue;
    }
    // Kolom lama di antara kolom tetap sebelumnya dan kolom ini sudah tidak ada.
    if (nomorLama > berikut) hapusKolom = true;
    if (nama.trim() !== formatLama[nomorLama - 1]) gantiNama = true;
    berikut = nomorLama + 1;
  }
  if (berikut <= formatLama.length) hapusKolom = true;

  const perubahan: PerubahanFormatItemStok[] = [];
  if (gantiNama) perubahan.push("ganti-nama");
  if (tambahKolom) perubahan.push("tambah-kolom");
  if (hapusKolom) perubahan.push("hapus-kolom");
  return perubahan;
}
