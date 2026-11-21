// Member aktif, Member terdaftar, dan Total saldo Member di Ringkasan dasbor admin (PRD §2.3 ▶ Keputusan 2026-11-17,
// §9.2, GLOSSARY).

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

/**
 * Jumlah Member terdaftar: semua Member, aktif maupun nonaktif (PRD §9.2 ▶ Keputusan 2026-11-20). Pendaftar
 * (PRD §7.2) belum menjadi Member, jadi tidak pernah ada di `semuaMember`. Hasilnya membawa Member yang dihitung
 * sebagai bahan hitungnya.
 */
export function jumlahMemberTerdaftar<M>({
  semuaMember,
}: {
  semuaMember: readonly M[];
}) {
  return { jumlah: semuaMember.length, dihitung: semuaMember };
}

/**
 * Total saldo Member: jumlah saldo semua Member saat ini, aktif maupun nonaktif (PRD §9.2 ▶ Keputusan 2026-11-20,
 * §15.1). Saldo ini uang Member, bukan Pendapatan. Pendaftar belum menjadi Member, jadi tidak pernah ada di
 * `semuaMember`. Hasilnya membawa Member yang dihitung sebagai bahan hitungnya.
 */
export function totalSaldoMember<M extends { saldo: number }>({
  semuaMember,
}: {
  semuaMember: readonly M[];
}) {
  return {
    total: semuaMember.reduce((total, member) => total + member.saldo, 0),
    dihitung: semuaMember,
  };
}
