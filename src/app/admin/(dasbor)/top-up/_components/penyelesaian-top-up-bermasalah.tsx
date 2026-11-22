"use client";

import { RotateCcw, WalletCards } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import type { CaraPenyelesaianTopUp } from "@/domain/penyelesaian-top-up-bermasalah";

import { ModalPenegasan } from "../../_components/modal-penegasan";
import {
  HasilAksi,
  KELAS_TOMBOL_GARIS,
  KELAS_TOMBOL_UTAMA,
} from "../../pesanan/_components/hasil-aksi";
import {
  aksiSelesaikanTopUpBermasalah,
  type KeadaanPenyelesaianTopUp,
} from "../aksi";

/** Bahan kalimat penegasan: Nominal top up yang sudah ditulis sebagai rupiah dan email Member pemiliknya. */
type Bahan = { nominalTopUp: string; email: string };

/**
 * Penegasan setiap cara penyelesaian di Modal penegasan: judul, kalimat yang menyebut akibatnya, lalu label tombol
 * "Ya, …" dan teks prosesnya.
 */
const PENEGASAN = {
  "tambahkan-ke-saldo": {
    judul: "Tambahkan ke saldo?",
    kalimat: ({ nominalTopUp, email }: Bahan) =>
      `Tambahkan ${nominalTopUp} ke saldo ${email}? Top up ini menjadi Berhasil, dan Riwayat saldo mencatat baris Top up. Aksi ini tidak bisa dibatalkan.`,
    tombol: "Ya, tambahkan ke saldo",
    memproses: "Menambahkan…",
  },
  "dana-dikembalikan": {
    judul: "Tandai Dana Dikembalikan?",
    kalimat: ({ email }: Bahan) =>
      `Tandai Top up ini Dana Dikembalikan? Saldo ${email} tidak bertambah, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.`,
    tombol: "Ya, tandai Dana Dikembalikan",
    memproses: "Menandai…",
  },
} satisfies Record<CaraPenyelesaianTopUp, unknown>;

/**
 * Aksi menyelesaikan Top up Bermasalah di detail Top up (PRD §15.9), mengikuti pola penyelesaian Pesanan Bermasalah
 * (PRD §5.9): "Tambahkan ke saldo" sebagai tombol utama dan "Tandai Dana Dikembalikan" sebagai tombol garis. Keduanya
 * tidak bisa dibatalkan, jadi tombol yang ditekan membuka Modal penegasan (PRD §9.10) yang menyebut akibat aksinya,
 * lalu tombol "Ya, …" dan Batal. Bila berhasil, detail Top up dimuat ulang dengan status barunya, dan panel ini hilang
 * karena Top up tidak lagi Bermasalah. Bila ditolak, modal tertutup dan pesannya tampil di bawah tombol. Halaman hanya
 * memasangnya untuk Top up Bermasalah; aksinya tetap diperiksa lagi di server.
 */
export function PenyelesaianTopUpBermasalah({
  topUpId,
  ...bahan
}: { topUpId: string } & Bahan) {
  // Cara penyelesaian yang sedang ditegaskan, atau null bila Admin belum menekan salah satu tombol.
  const [ditegaskan, setDitegaskan] = useState<CaraPenyelesaianTopUp | null>(
    null,
  );
  const tombolTambah = useRef<HTMLButtonElement>(null);
  const tombolDana = useRef<HTMLButtonElement>(null);
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPenyelesaianTopUp,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiSelesaikanTopUpBermasalah(sebelumnya, formData);
    setDitegaskan(null);
    return hasil;
  }, {});

  return (
    <section
      aria-labelledby="judul-penyelesaian-top-up"
      className="kartu flex flex-col gap-4 p-4"
    >
      <h2 id="judul-penyelesaian-top-up" className="text-[26px]">
        Selesaikan Top up Bermasalah
      </h2>
      <p className="text-base text-pensil-redup">
        Top up ini sudah dibayar dengan nominal kurang, jadi saldo belum
        bertambah. Tambahkan Nominal top up ke saldo Member, atau tandai Dana
        Dikembalikan setelah uangnya dikembalikan di luar sistem. Keduanya tidak
        bisa dibatalkan.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            ref={tombolTambah}
            type="button"
            onClick={() => setDitegaskan("tambahkan-ke-saldo")}
            className={KELAS_TOMBOL_UTAMA}
          >
            <WalletCards
              aria-hidden="true"
              className="size-6 shrink-0"
              strokeWidth={2.5}
            />
            Tambahkan ke saldo
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
            pemicu={
              ditegaskan === "tambahkan-ke-saldo" ? tombolTambah : tombolDana
            }
            judul={PENEGASAN[ditegaskan].judul}
            rincian={PENEGASAN[ditegaskan].kalimat(bahan)}
            labelYa={PENEGASAN[ditegaskan].tombol}
            labelProses={PENEGASAN[ditegaskan].memproses}
            aksi={aksi}
            isian={{ topUpId, cara: ditegaskan }}
            sedangMemproses={sedangMemproses}
            onBatal={() => setDitegaskan(null)}
          />
        )}
        <HasilAksi keadaan={sedangMemproses ? {} : keadaan} />
      </div>
    </section>
  );
}
