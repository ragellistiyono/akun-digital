import { Ticket } from "lucide-react";

// Isi tab Riwayat sebelum M2: hanya penjelasan Tautan Pesanan, tanpa ajakan login (PRD §11.1 ▶ Keputusan 2026-11-11).
export default function HalamanRiwayat() {
  return (
    <>
      <h1 className="mt-4">Riwayat Pesanan</h1>
      <div className="mt-4 grid gap-6 lebar:grid-cols-2 lebar:gap-8">
        <section className="flex items-start gap-3 rounded-[20px] bg-permukaan p-4 shadow-bayang">
          <Ticket
            aria-hidden="true"
            className="size-6 shrink-0 text-st-selesai"
          />
          <p className="max-w-[65ch] text-[15px] leading-[1.6]">
            Setiap Pesanan Selesai punya Tautan Pesanan di email &quot;Pesanan
            selesai&quot;. Buka tautan itu untuk melihat dan menyalin Item stok
            tanpa login.
          </p>
        </section>
      </div>
    </>
  );
}
