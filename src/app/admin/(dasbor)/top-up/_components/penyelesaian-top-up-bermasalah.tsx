"use client";

import { RotateCcw, WalletCards } from "lucide-react";
import { useActionState, useState } from "react";

import type { CaraPenyelesaianTopUp } from "@/domain/penyelesaian-top-up-bermasalah";

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

/** Penegasan setiap cara penyelesaian: kalimat yang menyebut akibatnya, lalu ikon dan label tombol "Ya, …". */
const PENEGASAN = {
  "tambahkan-ke-saldo": {
    kalimat: ({ nominalTopUp, email }: Bahan) =>
      `Tambahkan ${nominalTopUp} ke saldo ${email}? Top up ini menjadi Berhasil, dan Riwayat saldo mencatat baris Top up. Aksi ini tidak bisa dibatalkan.`,
    Ikon: WalletCards,
    tombol: "Ya, tambahkan ke saldo",
    memproses: "Menambahkan…",
  },
  "dana-dikembalikan": {
    kalimat: ({ email }: Bahan) =>
      `Tandai Top up ini Dana Dikembalikan? Saldo ${email} tidak bertambah, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan.`,
    Ikon: RotateCcw,
    tombol: "Ya, tandai Dana Dikembalikan",
    memproses: "Menandai…",
  },
} satisfies Record<CaraPenyelesaianTopUp, unknown>;

/**
 * Aksi menyelesaikan Top up Bermasalah di detail Top up (PRD §15.9), mengikuti pola penyelesaian Pesanan Bermasalah
 * (PRD §5.9, DESIGN.md Navigation): "Tambahkan ke saldo" sebagai tombol utama dan "Tandai Dana Dikembalikan" sebagai
 * tombol garis. Keduanya tidak bisa dibatalkan, jadi tombol yang ditekan diganti penegasan di tempat, tanpa dialog.
 * Penegasan itu menyebut akibat aksinya, lalu tombol "Ya, …" dan Batal. Selama aksi diproses, kedua tombol penegasan
 * nonaktif, supaya klik ganda tidak mengirim permintaan kedua. Bila berhasil, detail Top up dimuat ulang dengan status
 * barunya, dan panel ini hilang karena Top up tidak lagi Bermasalah. Halaman hanya memasangnya untuk Top up
 * Bermasalah; aksinya tetap diperiksa lagi di server.
 */
export function PenyelesaianTopUpBermasalah({
  topUpId,
  ...bahan
}: { topUpId: string } & Bahan) {
  // Cara penyelesaian yang sedang ditegaskan, atau null bila Admin belum menekan salah satu tombol.
  const [ditegaskan, setDitegaskan] = useState<CaraPenyelesaianTopUp | null>(
    null,
  );
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPenyelesaianTopUp,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiSelesaikanTopUpBermasalah(sebelumnya, formData);
    setDitegaskan(null);
    return hasil;
  }, {});

  const penegasan =
    ditegaskan === null ? null : { cara: ditegaskan, ...PENEGASAN[ditegaskan] };

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
        {penegasan ? (
          // Penegasan di tempat dibingkai tepi merah `aksi` 2 px, karena aksinya tidak bisa dibatalkan.
          <form
            action={aksi}
            className="flex flex-col gap-3 rounded-coret-md border-2 border-aksi bg-permukaan p-3"
          >
            <input type="hidden" name="topUpId" value={topUpId} />
            <input type="hidden" name="cara" value={penegasan.cara} />
            <p className="text-[17px] [overflow-wrap:anywhere]">
              {penegasan.kalimat(bahan)}
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
                  strokeWidth={2.5}
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
        )}
        <HasilAksi keadaan={sedangMemproses ? {} : keadaan} />
      </div>
    </section>
  );
}
