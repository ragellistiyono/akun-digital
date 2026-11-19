/**
 * Teks halaman Syarat & Ketentuan atau Kebijakan Privasi dari Pengaturan toko (PRD §9.8). Teks tampil
 * sebagai teks biasa, dan setiap baris menjadi satu paragraf. Baris kosong tidak menjadi paragraf.
 * Wadahnya selembar kertas bergaris pensil yang ditempel selotip, tanpa diputar karena isinya teks panjang.
 * Lebarnya mengikuti kolom halaman (`tata-baca`, 720 px), dan jarak 32 px di atasnya memberi ruang bagi
 * selotip yang menonjol di atas kertas.
 */
export function TeksHalamanHukum({ teks }: { teks: string }) {
  const paragraf = teks.split("\n").filter((baris) => baris.trim() !== "");
  if (paragraf.length === 0) return null;

  return (
    <section className="kartu selotip relative mt-8 flex flex-col gap-4 p-5 text-[18px] leading-[1.6] lebar:p-8">
      {paragraf.map((isi, urutan) => (
        <p key={urutan}>{isi}</p>
      ))}
    </section>
  );
}
