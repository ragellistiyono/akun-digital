const PANJANG_MAKSIMAL_LABEL = 12;

/**
 * Label Member di bilah atas (PRD §11.1 ▶ Keputusan 2026-11-17): bagian email sebelum "@". Bila bagian itu
 * lebih dari 12 karakter, label berisi 12 karakter pertamanya diikuti "…" (U+2026). Email Member sudah
 * tersimpan dalam bentuk bakunya (PRD §7.4), jadi tidak dibakukan lagi di sini. Karakter dihitung per
 * code point, supaya karakter di luar BMP tidak terbelah.
 */
export function labelMember(email: string): string {
  const bagianNama = Array.from(email.slice(0, email.lastIndexOf("@")));
  if (bagianNama.length <= PANJANG_MAKSIMAL_LABEL) return bagianNama.join("");
  return `${bagianNama.slice(0, PANJANG_MAKSIMAL_LABEL).join("")}…`;
}
