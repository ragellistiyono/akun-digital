"use client";

import { PackageCheck, RotateCcw } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { ModalPenegasan } from "../../_components/modal-penegasan";
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

/**
 * Penegasan setiap cara penyelesaian di Modal penegasan: judul, kalimat yang menyebut akibatnya, lalu label tombol
 * "Ya, …" dan teks prosesnya.
 */
const PENEGASAN = {
  "kirim-item-stok": {
    judul: "Kirim Item stok?",
    kalimat: (email: string) =>
      `Kirim satu Item stok Tersedia dari Varian yang sama ke Pesanan ini? Pesanan menjadi Selesai, dan email "Pesanan selesai" dikirim ke ${email}. Aksi ini tidak bisa dibatalkan.`,
    tombol: "Ya, kirim Item stok",
    memproses: "Mengirim…",
  },
  "dana-dikembalikan": {
    judul: "Tandai Dana Dikembalikan?",
    kalimat: () =>
      "Tandai Pesanan ini Dana Dikembalikan? Pesanan ini tidak akan mendapat Item stok, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.",
    tombol: "Ya, tandai Dana Dikembalikan",
    memproses: "Menandai…",
  },
} satisfies Record<Cara, unknown>;

/**
 * Aksi menyelesaikan Pesanan Bermasalah di detail Pesanan (PRD §5.9, §9.5): "Kirim Item stok" sebagai tombol
 * utama dan "Tandai Dana Dikembalikan" sebagai tombol garis. Keduanya tidak bisa dibatalkan, jadi tombol yang
 * ditekan membuka Modal penegasan (PRD §9.10) yang menyebut akibat aksinya, lalu tombol "Ya, …" dan Batal. Bila
 * berhasil, detail Pesanan dimuat ulang dengan status barunya, dan panel ini hilang karena Pesanan tidak lagi
 * Bermasalah. Bila ditolak, modal tertutup dan pesannya tampil di bawah tombol. Halaman hanya memasangnya untuk
 * Pesanan Bermasalah; aksinya tetap diperiksa lagi di server.
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
  const tombolKirim = useRef<HTMLButtonElement>(null);
  const tombolDana = useRef<HTMLButtonElement>(null);
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPenyelesaianBermasalah,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiSelesaikanBermasalah(sebelumnya, formData);
    setDitegaskan(null);
    return hasil;
  }, {});

  return (
    <section
      aria-labelledby="judul-penyelesaian-bermasalah"
      className="kartu flex flex-col gap-4 p-4"
    >
      <h2 id="judul-penyelesaian-bermasalah" className="text-[26px]">
        Selesaikan Pesanan Bermasalah
      </h2>
      <p className="text-base text-pensil-redup">
        Pesanan ini sudah dibayar, tetapi Item stoknya belum terkirim. Kirim
        satu Item stok Tersedia dari Varian yang sama, atau tandai Dana
        Dikembalikan setelah uangnya dikembalikan di luar sistem. Keduanya tidak
        bisa dibatalkan.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            ref={tombolKirim}
            type="button"
            onClick={() => setDitegaskan("kirim-item-stok")}
            className={KELAS_TOMBOL_UTAMA}
          >
            <PackageCheck
              aria-hidden="true"
              className="size-6 shrink-0"
              strokeWidth={2.5}
            />
            Kirim Item stok
          </button>
          <button
            ref={tombolDana}
            type="button"
            onClick={() => setDitegaskan("dana-dikembalikan")}
            className={KELAS_TOMBOL_GARIS}
          >
            <RotateCcw
              aria-hidden="true"
              className="size-6 shrink-0"
              strokeWidth={2.5}
            />
            Tandai Dana Dikembalikan
          </button>
        </div>
        {ditegaskan && (
          <ModalPenegasan
            pemicu={ditegaskan === "kirim-item-stok" ? tombolKirim : tombolDana}
            judul={PENEGASAN[ditegaskan].judul}
            rincian={PENEGASAN[ditegaskan].kalimat(email)}
            labelYa={PENEGASAN[ditegaskan].tombol}
            labelProses={PENEGASAN[ditegaskan].memproses}
            aksi={aksi}
            isian={{ pesananId, cara: ditegaskan }}
            sedangMemproses={sedangMemproses}
            onBatal={() => setDitegaskan(null)}
          />
        )}
        <HasilAksi keadaan={sedangMemproses ? {} : keadaan} />
      </div>
    </section>
  );
}
