// Bagian yang sama di setiap email toko (PRD §10.2): teks yang aman ditaruh di HTML, dan footer WhatsApp.

/** Teks yang aman ditaruh di HTML. */
export const aman = (teks: string) =>
  teks
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Footer "Butuh bantuan? Hubungi kami di WhatsApp +62…" (PRD §10.2 ▶ Keputusan 2026-11-12), sebagai baris
 * teks biasa dan baris HTML yang ditaruh di akhir email. Nomornya membuka https://wa.me/<nomor> seperti
 * tombol WhatsApp di web, dan seperti tombol itu footer tidak ada selama nomor WhatsApp belum diisi
 * (PRD §9.8): kedua daftar baris kosong.
 */
export function footerWhatsapp(nomorWhatsapp: string | null): {
  teks: string[];
  html: string[];
} {
  if (!nomorWhatsapp) return { teks: [], html: [] };
  const label = `WhatsApp +${nomorWhatsapp}`;
  const alamat = `https://wa.me/${nomorWhatsapp}`;
  const bantuan = "Butuh bantuan? Hubungi kami di";
  return {
    teks: ["", `${bantuan} ${label} (${alamat})`],
    html: [
      `<hr style="margin:24px 0 16px">`,
      `<p style="margin:0">${aman(bantuan)} <a href="${aman(alamat)}">${aman(label)}</a></p>`,
    ],
  };
}
