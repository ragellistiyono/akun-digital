"use client";

import Form from "next/form";
import { useState, type ReactNode } from "react";

import { BilahLekat } from "./bilah-lekat";
import { teksHarga } from "./teks-harga";

/** Alamat form checkout. Varian terpilih dikirim sebagai `?varianId=…`. */
const ALAMAT_CHECKOUT = "/checkout";

type VarianBeli = { id: string; hargaJual: number; habis: boolean };

/**
 * Form Halaman Produk yang membuka form checkout untuk Varian terpilih. Isinya pilihan Varian (radio
 * `varianId`) atau, untuk Produk dengan satu Varian, isian tersembunyi `varianId`, beserta isi halaman
 * lainnya. Tombol utamanya (kelas `tombol`) ada di bilah lekat dan mengikuti Varian terpilih: "Beli · Rp X",
 * atau "Habis" dan tidak bisa ditekan bila Varian itu habis atau tidak ada Varian ber-stok. Tombol nonaktif
 * otomatis bergaris putus di atas `kertas-lama`. Untuk Produk gratis (`gratis`), tombolnya "Beli · Gratis" (PRD §16.3,
 * §16.4).
 */
export function FormBeli({
  varian,
  gratis,
  terpilihAwal,
  children,
}: {
  varian: VarianBeli[];
  gratis: boolean;
  /** id Varian yang sudah terpilih saat halaman dibuka, atau null bila tidak ada. */
  terpilihAwal: string | null;
  children: ReactNode;
}) {
  const [terpilihId, setTerpilihId] = useState(terpilihAwal);
  const terpilih = varian.find((v) => v.id === terpilihId && !v.habis);

  return (
    <Form
      action={ALAMAT_CHECKOUT}
      // Pilihan Varian tidak dipulihkan browser saat halaman dimuat ulang, supaya radio yang terpilih
      // selalu sama dengan label tombol.
      autoComplete="off"
      onChange={(event) => {
        const isian = event.target;
        if (isian instanceof HTMLInputElement && isian.name === "varianId") {
          setTerpilihId(isian.value);
        }
      }}
    >
      {children}
      <BilahLekat>
        <button type="submit" disabled={!terpilih} className="tombol min-w-0">
          {terpilih
            ? `Beli · ${teksHarga({ hargaJual: terpilih.hargaJual, gratis })}`
            : "Habis"}
        </button>
      </BilahLekat>
    </Form>
  );
}
