/**
 * Teks halaman Syarat & Ketentuan atau Kebijakan Privasi dari Pengaturan toko (PRD §9.8). Teks tampil
 * sebagai teks biasa, dan setiap baris menjadi satu paragraf. Baris kosong tidak menjadi paragraf.
 */
export function TeksHalamanHukum({ teks }: { teks: string }) {
  const paragraf = teks.split("\n").filter((baris) => baris.trim() !== "");
  if (paragraf.length === 0) return null;

  return (
    <section className="mt-4 flex max-w-[65ch] flex-col gap-4 rounded-[20px] bg-permukaan p-4 text-[15px] leading-[1.6] shadow-bayang">
      {paragraf.map((isi, urutan) => (
        <p key={urutan}>{isi}</p>
      ))}
    </section>
  );
}
