"use client";

import { Check } from "lucide-react";
import { useActionState, type ReactNode } from "react";

import { PEMISAH_KOLOM } from "@/domain/item-stok";

import { IsianTeks } from "../../_components/isian-form";
import { Keterangan } from "../../_components/keterangan-isian";
import {
  aksiTambahItemStok,
  aksiTempelItemStok,
  type KeadaanFormItemStok,
  type KeadaanTempelItemStok,
} from "../aksi-item-stok";

type VarianDipilih = { produkId: string; varianId: string };

/** Panel `kartu` dengan judul bagian (DESIGN.md Cards / Containers). */
function Panel({
  id,
  judul,
  children,
}: {
  id: string;
  judul: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-judul`}
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      <h2 id={`${id}-judul`} className="text-[26px]">
        {judul}
      </h2>
      {children}
    </section>
  );
}

function IdVarian({ produkId, varianId }: VarianDipilih) {
  return (
    <>
      <input type="hidden" name="produkId" value={produkId} />
      <input type="hidden" name="varianId" value={varianId} />
    </>
  );
}

/**
 * Form satu Item stok (PRD §4.2), dengan satu isian untuk setiap kolom Format Item stok menurut
 * urutannya. Setelah Item stok tersimpan, isiannya dikosongkan untuk Item stok berikutnya.
 */
export function FormItemStok({
  kolom,
  ...varianDipilih
}: VarianDipilih & { kolom: string[] }) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanFormItemStok,
    FormData
  >(aksiTambahItemStok, { nilai: kolom.map(() => "") });
  const galat = keadaan.galat;

  return (
    <Panel id="item-stok-satu" judul="Tambah satu Item stok">
      <form action={aksi} noValidate className="flex flex-col gap-6">
        <IdVarian {...varianDipilih} />
        {kolom.map((nama, i) => (
          <IsianTeks
            key={`${i}-${nama}`}
            nama="nilai"
            id={`item-stok-kolom-${i + 1}`}
            label={nama}
            nilaiAwal={keadaan.nilai[i] ?? ""}
            galat={galat?.kolom?.[i] ?? undefined}
            mono
          />
        ))}
        {galat?.umum && (
          <div role="alert">
            <Keterangan id="item-stok-satu-galat" galat={galat.umum} />
          </div>
        )}
        {keadaan.tersimpan && (
          <p
            role="status"
            className="flex items-start gap-2 text-base text-st-selesai"
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
              strokeWidth={2.5}
            />
            Item stok tersimpan dengan status Tersedia.
          </p>
        )}
        <div>
          <button type="submit" disabled={sedangMenyimpan} className="tombol">
            {sedangMenyimpan ? "Menyimpan…" : "Simpan Item stok"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Menempel banyak Item stok sekaligus (PRD §4.2): satu baris untuk satu Item stok, dengan kolom dipisah
 * |. Setelah disimpan, ringkasan dan baris yang ditolak beserta alasannya tampil di bawah form.
 */
export function TempelItemStok({
  kolom,
  ...varianDipilih
}: VarianDipilih & { kolom: string[] }) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState<
    KeadaanTempelItemStok,
    FormData
  >(aksiTempelItemStok, { teks: "" });
  const hasil = keadaan.hasil;

  return (
    <Panel id="item-stok-tempel" judul="Tempel banyak Item stok">
      <form action={aksi} noValidate className="flex flex-col gap-6">
        <IdVarian {...varianDipilih} />
        <IsianTeks
          nama="teks"
          id="item-stok-tempel-teks"
          label="Tempelan Item stok"
          nilaiAwal={keadaan.teks}
          galat={keadaan.galat}
          bantuan={`Satu baris untuk satu Item stok, dengan kolom dipisah garis tegak (${PEMISAH_KOLOM}) menurut urutan Format Item stok: ${kolom.join(", ")}. Baris kosong diabaikan.`}
          banyakBaris
          mono
        />
        <div>
          <button type="submit" disabled={sedangMenyimpan} className="tombol">
            {sedangMenyimpan ? "Menyimpan…" : "Simpan tempelan"}
          </button>
        </div>
      </form>

      {hasil && (
        <div className="flex flex-col gap-4">
          <p role="status" className="font-spidol text-xl font-bold">
            {hasil.ringkasan}
          </p>
          {hasil.ditolak.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 id="baris-ditolak-judul" className="text-[22px]">
                Baris yang ditolak
              </h3>
              <p className="text-base text-pensil-redup">
                Baris ini tidak disimpan. Perbaiki, lalu tempel lagi. Baris yang
                tersimpan tidak perlu ditempel ulang.
              </p>
              <ul
                aria-labelledby="baris-ditolak-judul"
                className="flex flex-col divide-y-2 divide-dashed divide-pensil"
              >
                {hasil.ditolak.map((satu) => (
                  <li key={satu.baris} className="flex flex-col gap-1 py-2">
                    <span className="font-spidol font-bold">
                      Baris {satu.baris}
                    </span>
                    <span className="font-mono text-[15px] font-medium [overflow-wrap:anywhere]">
                      {satu.teks}
                    </span>
                    <span className="text-base text-aksi">
                      {satu.keterangan}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
