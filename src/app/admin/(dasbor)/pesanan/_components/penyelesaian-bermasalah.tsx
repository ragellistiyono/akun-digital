"use client";

import { PackageCheck, RotateCcw } from "lucide-react";
import { useActionState, useState } from "react";

import {
  aksiSelesaikanBermasalah,
  type KeadaanPenyelesaianBermasalah,
} from "../aksi";
import {
  HasilAksi,
  KELAS_TOMBOL_GARIS,
  KELAS_TOMBOL_UTAMA,
} from "./hasil-aksi";

type Cara = "kirim-item-stok" | "dana-dikembalikan";

/** Penegasan setiap cara penyelesaian: kalimat yang menyebut akibatnya, lalu ikon dan label tombol "Ya, …". */
const PENEGASAN = {
  "kirim-item-stok": {
    kalimat: (email: string) =>
      `Kirim satu Item stok Tersedia dari Varian yang sama ke Pesanan ini? Pesanan menjadi Selesai, dan email "Pesanan selesai" dikirim ke ${email}. Aksi ini tidak bisa dibatalkan.`,
    Ikon: PackageCheck,
    tombol: "Ya, kirim Item stok",
    memproses: "Mengirim…",
  },
  "dana-dikembalikan": {
    kalimat: () =>
      "Tandai Pesanan ini Dana Dikembalikan? Pesanan ini tidak akan mendapat Item stok, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.",
    Ikon: RotateCcw,
    tombol: "Ya, tandai Dana Dikembalikan",
    memproses: "Menandai…",
  },
} satisfies Record<Cara, unknown>;

/**
 * Aksi menyelesaikan Pesanan Bermasalah di detail Pesanan (PRD §5.9, §9.5): "Kirim Item stok" sebagai tombol
 * utama dan "Tandai Dana Dikembalikan" sebagai tombol garis. Keduanya tidak bisa dibatalkan, jadi tombol yang
 * ditekan diganti penegasan di tempat, tanpa dialog, seperti hapus Item stok (PRD §5.9 dan DESIGN.md
 * Navigation, ▶ Keputusan 2026-11-12). Penegasan itu menyebut akibat aksinya, lalu tombol "Ya, …" dan Batal.
 * Kalimatnya ada di atas tombol, jadi klik kedua dari klik ganda pada tombol pembukanya jatuh di kalimat itu,
 * bukan di tombol "Ya, …". Selama aksi diproses, kedua tombol penegasan nonaktif, supaya klik ganda tidak
 * mengirim permintaan kedua. Bila berhasil, detail Pesanan dimuat ulang dengan status barunya, dan panel ini
 * hilang karena Pesanan tidak lagi Bermasalah. Bila ditolak, kedua tombol tampil lagi di atas pesannya.
 * Halaman hanya memasangnya untuk Pesanan Bermasalah; aksinya tetap diperiksa lagi di server.
 */
export function PenyelesaianBermasalah({
  pesananId,
  email,
}: {
  pesananId: string;
  email: string;
}) {
  // Cara penyelesaian yang sedang ditegaskan, atau null bila Admin belum menekan salah satu tombol.
  const [ditegaskan, setDitegaskan] = useState<Cara | null>(null);
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPenyelesaianBermasalah,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiSelesaikanBermasalah(sebelumnya, formData);
    setDitegaskan(null);
    return hasil;
  }, {});

  const penegasan =
    ditegaskan === null ? null : { cara: ditegaskan, ...PENEGASAN[ditegaskan] };

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
      <div className="flex flex-col gap-3">
        {penegasan ? (
          <form action={aksi} className="flex flex-col gap-3">
            <input type="hidden" name="pesananId" value={pesananId} />
            <input type="hidden" name="cara" value={penegasan.cara} />
            <p className="text-sm font-bold [overflow-wrap:anywhere]">
              {penegasan.kalimat(email)}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={sedangMemproses}
                className={KELAS_TOMBOL_UTAMA}
              >
                <penegasan.Ikon
                  aria-hidden="true"
                  className="size-6 shrink-0"
                />
                {sedangMemproses ? penegasan.memproses : penegasan.tombol}
              </button>
              {/* Aksi yang sudah dikirim tidak bisa ditarik, jadi Batal ikut nonaktif selama diproses. */}
              <button
                type="button"
                disabled={sedangMemproses}
                onClick={() => setDitegaskan(null)}
                className={KELAS_TOMBOL_GARIS}
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDitegaskan("kirim-item-stok")}
              className={KELAS_TOMBOL_UTAMA}
            >
              <PackageCheck aria-hidden="true" className="size-6 shrink-0" />
              Kirim Item stok
            </button>
            <button
              type="button"
              onClick={() => setDitegaskan("dana-dikembalikan")}
              className={KELAS_TOMBOL_GARIS}
            >
              <RotateCcw aria-hidden="true" className="size-6 shrink-0" />
              Tandai Dana Dikembalikan
            </button>
          </div>
        )}
        <HasilAksi keadaan={sedangMemproses ? {} : keadaan} />
      </div>
    </section>
  );
}
