// Nomor WhatsApp toko di Pengaturan toko (PRD §9.8 ▶ Keputusan 2026-11-11, #53). Nomor toko dianggap
// selalu nomor Indonesia, dan tombol WhatsApp membuka https://wa.me/<nomor>.

/** Panjang nomor WhatsApp terbesar setelah dirapikan, dalam jumlah angka (PRD §9.8). */
export const PANJANG_NOMOR_WHATSAPP_MAKSIMUM = 15;

export type AlasanNomorWhatsappDitolak =
  "bukan-angka" | "bukan-nomor-indonesia" | "terlalu-panjang";

type HasilRapikanNomorWhatsapp =
  | { sah: true; nomor: string | null }
  | { sah: false; alasan: AlasanNomorWhatsappDitolak };

/**
 * Merapikan nomor WhatsApp yang ditulis Admin. Spasi, tanda hubung, dan tanda + dibuang, lalu satu
 * angka 0 di depan diganti 62. Hasilnya harus angka saja, diawali 62, dan paling banyak 15 angka.
 * Isian kosong atau hanya spasi berarti nomor belum diisi (nomor null).
 *
 * Hanya satu alasan yang dikembalikan, dengan urutan pemeriksaan: bukan angka, bukan nomor Indonesia,
 * lalu terlalu panjang.
 */
export function rapikanNomorWhatsapp({
  isian,
}: {
  isian: string;
}): HasilRapikanNomorWhatsapp {
  if (isian.trim() === "") return { sah: true, nomor: null };

  const angka = isian.replace(/[\s+-]/g, "");
  if (!/^[0-9]+$/.test(angka)) return { sah: false, alasan: "bukan-angka" };

  const nomor = angka.startsWith("0") ? `62${angka.slice(1)}` : angka;
  if (!nomor.startsWith("62")) {
    return { sah: false, alasan: "bukan-nomor-indonesia" };
  }
  if (nomor.length > PANJANG_NOMOR_WHATSAPP_MAKSIMUM) {
    return { sah: false, alasan: "terlalu-panjang" };
  }
  return { sah: true, nomor };
}
