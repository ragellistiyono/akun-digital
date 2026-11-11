"use client";

import Form from "next/form";
import { useState, type ReactNode } from "react";

import { rupiah } from "@/lib/rupiah";

import { BilahLekat, KELAS_TOMBOL_UTAMA } from "./bilah-lekat";

/** Alamat form checkout. Varian terpilih dikirim sebagai `?varianId=…`. */
const ALAMAT_CHECKOUT = "/checkout";

type VarianBeli = { id: string; hargaJual: number; habis: boolean };

/**
 * Form Halaman Produk yang membuka form checkout untuk Varian terpilih. Isinya pilihan Varian (radio
 * `varianId`) atau, untuk Produk dengan satu Varian, isian tersembunyi `varianId`, beserta isi halaman
 * lainnya. Tombol utamanya ada di bilah lekat dan mengikuti Varian terpilih: "Beli · Rp X", atau "Habis"
 * dan tidak bisa ditekan bila Varian itu habis atau tidak ada Varian ber-stok.
 */
export function FormBeli({
  varian,
  terpilihAwal,
  children,
}: {
  varian: VarianBeli[];
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
        <button
          type="submit"
          disabled={!terpilih}
          className={KELAS_TOMBOL_UTAMA}
        >
          {terpilih ? `Beli · ${rupiah(terpilih.hargaJual)}` : "Habis"}
        </button>
      </BilahLekat>
    </Form>
  );
}
