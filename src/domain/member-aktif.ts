// Member aktif di Ringkasan dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17, §9.2, GLOSSARY).

/**
 * Jumlah Member aktif: Member yang sudah diverifikasi dan tidak nonaktif (PRD §2.3 ▶ Keputusan 2026-11-17).
 * `semuaMember` hanya memuat Member, yang baru ada begitu Kode verifikasi yang benar dimasukkan (PRD §7.3),
 * jadi Pendaftar tidak pernah ikut. Hasilnya membawa Member yang dihitung sebagai bahan hitungnya.
 */
export function jumlahMemberAktif<M extends { nonaktif: boolean }>({
  semuaMember,
}: {
  semuaMember: readonly M[];
}) {
  const dihitung = semuaMember.filter((member) => !member.nonaktif);
  return { jumlah: dihitung.length, dihitung };
}
