"use client";

import { Check } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { ModalPenegasan } from "../../_components/modal-penegasan";
import {
  aksiHapusSemuaItemStokTersedia,
  type KeadaanHapusSemuaItemStok,
} from "../aksi-item-stok";

/**
 * Tombol "Hapus semua Item stok Tersedia" di daftar Item stok halaman Varian (PRD §4.4 ▶ Keputusan 2026-11-22).
 * Tombolnya hanya tampil bila ada `teksPenegasan`, yaitu bila Varian itu punya Item stok Tersedia, dan membuka
 * Modal penegasan berisi teks itu (PRD §9.10). Setelah disetujui, "N Item stok terhapus." tampil di sini, dengan N
 * jumlah yang benar-benar terhapus. Pesan itu tetap tampil walau tombolnya hilang karena Item stok Tersedia sudah
 * habis.
 */
export function HapusSemuaItemStokTersedia({
  produkId,
  varianId,
  teksPenegasan,
}: {
  produkId: string;
  varianId: string;
  teksPenegasan: string | null;
}) {
  const [menegaskan, setMenegaskan] = useState(false);
  const pemicu = useRef<HTMLButtonElement>(null);
  const [keadaan, aksi, sedangMenghapus] = useActionState<
    KeadaanHapusSemuaItemStok,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiHapusSemuaItemStokTersedia(sebelumnya, formData);
    setMenegaskan(false);
    return hasil;
  }, {});

  if (teksPenegasan === null && !keadaan.pesan) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {teksPenegasan !== null && (
        <button
          ref={pemicu}
          type="button"
          onClick={() => setMenegaskan(true)}
          className="tombol tombol-kedua tombol-kecil"
        >
          Hapus semua Item stok Tersedia
        </button>
      )}
      {menegaskan && teksPenegasan !== null && (
        <ModalPenegasan
          pemicu={pemicu}
          judul="Hapus semua Item stok Tersedia?"
          rincian={teksPenegasan}
          labelYa="Ya, hapus semua Item stok Tersedia"
          labelProses="Menghapus…"
          aksi={aksi}
          isian={{ produkId, varianId }}
          sedangMemproses={sedangMenghapus}
          onBatal={() => setMenegaskan(false)}
        />
      )}
      {keadaan.pesan && (
        <p
          role="status"
          className="flex items-start gap-2 text-base text-st-selesai"
        >
          <Check
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
          {keadaan.pesan}
        </p>
      )}
    </div>
  );
}
