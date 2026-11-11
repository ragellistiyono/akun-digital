import { cekStatusPembayaran } from "@/server/kabar-pembayaran";
import { bacaStatusPesanan, TautanPesanan } from "@/server/pesanan";

const tidakDitemukan = () =>
  new Response(
    "Tidak ada Pesanan dengan Tautan Pesanan ini, jadi statusnya tidak bisa dibaca. Buka Tautan Pesanan dari email Anda, atau checkout lagi dari Beranda.",
    {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );

// Status Pesanan yang ditanyakan Halaman bayar secara berkala (ADR-0004: Halaman bayar menanyakan status ke
// server toko, bukan ke Qrispy). Siapa pun yang memegang Tautan Pesanan boleh membacanya (PRD §6.2). Jalur
// cek status ke Qrispy dijalankan dulu, paling sering sekali per 15 detik untuk setiap Pesanan, supaya
// pembayaran yang sudah masuk terbaca tanpa Halaman bayar dimuat ulang.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/pesanan/[tautan]/status">,
) {
  const tautan = TautanPesanan.safeParse((await params).tautan);
  if (!tautan.success) return tidakDitemukan();

  await cekStatusPembayaran(tautan.data);
  const status = await bacaStatusPesanan(tautan.data);
  if (!status) return tidakDitemukan();

  return Response.json(
    { status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
