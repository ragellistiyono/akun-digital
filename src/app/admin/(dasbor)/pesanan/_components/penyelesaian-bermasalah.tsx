"use client";

import { PackageCheck, RotateCcw } from "lucide-react";
import { useActionState, useState } from "react";

import { aksiSelesaikanBermasalah } from "../aksi";
import {
  HasilAksi,
  KELAS_TOMBOL_GARIS,
  KELAS_TOMBOL_UTAMA,
} from "./hasil-aksi";

/**
 * Aksi menyelesaikan Pesanan Bermasalah di detail Pesanan (PRD §5.9, §9.5): "Kirim Item stok" sebagai tombol
 * utama dan "Tandai Dana Dikembalikan" sebagai tombol garis, di satu form. Selama salah satunya diproses,
 * keduanya nonaktif, supaya klik ganda tidak mengirim permintaan kedua. Bila berhasil, detail Pesanan
 * dimuat ulang dengan status barunya, dan panel ini hilang karena Pesanan tidak lagi Bermasalah. Halaman
 * hanya memasangnya untuk Pesanan Bermasalah; aksinya tetap diperiksa lagi di server.
 */
export function PenyelesaianBermasalah({ pesananId }: { pesananId: string }) {
  const [keadaan, aksi, sedangMemproses] = useActionState(
    aksiSelesaikanBermasalah,
    {},
  );
  // Tombol yang terakhir ditekan, untuk label prosesnya.
  const [ditekan, setDitekan] = useState<string | null>(null);
  const memproses = (cara: string) => sedangMemproses && ditekan === cara;

  return (
    <section
      aria-labelledby="judul-penyelesaian-bermasalah"
      className="flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <h2
        id="judul-penyelesaian-bermasalah"
        className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Selesaikan Pesanan Bermasalah
      </h2>
      <p className="text-[15px] text-tinta-redup">
        Pesanan ini sudah dibayar, tetapi Item stoknya belum terkirim. Kirim
        satu Item stok Tersedia dari Varian yang sama, atau tandai Dana
        Dikembalikan setelah uangnya dikembalikan di luar sistem. Keduanya tidak
        bisa dibatalkan.
      </p>
      <form
        action={aksi}
        aria-label="Selesaikan Pesanan Bermasalah"
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="pesananId" value={pesananId} />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="cara"
            value="kirim-item-stok"
            disabled={sedangMemproses}
            onClick={() => setDitekan("kirim-item-stok")}
            className={KELAS_TOMBOL_UTAMA}
          >
            <PackageCheck aria-hidden="true" className="size-6 shrink-0" />
            {memproses("kirim-item-stok") ? "Mengirim…" : "Kirim Item stok"}
          </button>
          <button
            type="submit"
            name="cara"
            value="dana-dikembalikan"
            disabled={sedangMemproses}
            onClick={() => setDitekan("dana-dikembalikan")}
            className={KELAS_TOMBOL_GARIS}
          >
            <RotateCcw aria-hidden="true" className="size-6 shrink-0" />
            {memproses("dana-dikembalikan")
              ? "Menandai…"
              : "Tandai Dana Dikembalikan"}
          </button>
        </div>
        <HasilAksi keadaan={sedangMemproses ? {} : keadaan} />
      </form>
    </section>
  );
}
