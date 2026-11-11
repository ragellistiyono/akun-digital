import { bacaBerkasUnggahan } from "@/server/berkas-unggahan";

// Menyajikan gambar unggahan Admin, misalnya ikon Kategori, kepada semua pengunjung toko. Nama
// berkasnya acak dan tidak pernah ditimpa, jadi browser boleh menyimpannya selama setahun.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/unggahan/[nama]">,
) {
  const berkas = await bacaBerkasUnggahan((await params).nama);
  if (!berkas) {
    return new Response("Berkas tidak ditemukan.", { status: 404 });
  }

  return new Response(berkas.isi, {
    headers: {
      "Content-Type": berkas.jenis,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
