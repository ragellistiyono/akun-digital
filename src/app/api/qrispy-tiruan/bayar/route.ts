import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import { picuPembayaranTiruan } from "@/server/qrispy";

const ContohIsi = '{"qrisId": "<qris_id>", "amount": <nominal>}';

const IsiPemicu = z.object({
  qrisId: z.string().min(1),
  amount: z.number().int().positive(),
});

const teks = (isi: string, status: number) =>
  new Response(isi, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

// Pemicu pembayaran Qrispy tiruan untuk pengembangan dan test (ADR-0004): membayar QRIS itu dengan nominal
// yang diatur, termasuk nominal kurang dari Total bayar. Hanya aktif bila QRISPY_MODE=tiruan. Pesanan
// berubah saat kabar pembayarannya diproses, misalnya lewat cek status saat halaman Pesanan dimuat.
export async function POST(request: Request) {
  let mentah: unknown;
  try {
    mentah = await request.json();
  } catch {
    mentah = undefined;
  }
  const isi = IsiPemicu.safeParse(mentah);
  if (!isi.success) {
    return teks(
      `Isi permintaan tidak dikenali, jadi tidak ada pembayaran yang dicatat. Kirim JSON ${ContohIsi} dengan nominal rupiah bulat lebih dari 0.`,
      400,
    );
  }

  if (picuPembayaranTiruan(isi.data).hasil === "tidak-aktif") {
    return teks(
      "Pemicu pembayaran tiruan hanya aktif bila QRISPY_MODE=tiruan, jadi tidak ada pembayaran yang dicatat. Jalankan toko dengan QRISPY_MODE=tiruan untuk memakainya.",
      404,
    );
  }
  return teks(
    `Pembayaran tiruan untuk QRIS ${isi.data.qrisId} sebesar ${rupiah(isi.data.amount)} tercatat. Muat ulang halaman Pesanan untuk memproses kabar pembayarannya.`,
    200,
  );
}
