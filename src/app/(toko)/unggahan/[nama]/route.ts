import {
  bacaBerkasUnggahan,
  NamaBerkasUnggahan,
} from "@/server/berkas-unggahan";

const PESAN_TIDAK_DITEMUKAN =
  "Gambar ini tidak ditemukan, mungkin karena sudah diganti atau dihapus. Muat ulang halaman toko untuk melihat gambar terbaru.";

const tidakDitemukan = () =>
  new Response(PESAN_TIDAK_DITEMUKAN, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

// Menyajikan gambar unggahan Admin, misalnya ikon Kategori, kepada semua pengunjung toko. Nama
// berkasnya acak dan tidak pernah ditimpa, jadi browser boleh menyimpannya selama setahun.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/unggahan/[nama]">,
) {
  const nama = NamaBerkasUnggahan.safeParse((await params).nama);
  if (!nama.success) return tidakDitemukan();

  const berkas = await bacaBerkasUnggahan(nama.data);
  if (!berkas) return tidakDitemukan();

  return new Response(berkas.isi, {
    headers: {
      "Content-Type": berkas.jenis,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Pertahanan berlapis: berkas ini tidak pernah boleh memuat atau menjalankan apa pun.
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
