"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { bacaCheckout } from "@/server/pesanan";

import {
  BilahLekat,
  KELAS_TOMBOL_UTAMA,
} from "../../../_components/bilah-lekat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { aksiCheckout, type KeadaanFormCheckout } from "../aksi";

type IsiCheckout = NonNullable<Awaited<ReturnType<typeof bacaCheckout>>>;

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

/** Isian 52 px (DESIGN.md Inputs / Fields): garis `garis`, fokus `aksi` dengan halo, galat `st-masalah`. */
const KELAS_ISIAN =
  "h-[52px] rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta placeholder:text-tinta-redup focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah";

/** Pesan galat 13 px tebal berwarna `st-masalah` dengan ikon TriangleAlert (DESIGN.md Inputs / Fields). */
function PesanGalat({
  id,
  pesan,
  className,
}: {
  id?: string;
  pesan: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-2 text-[13px] font-bold text-st-masalah",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
      {pesan}
    </p>
  );
}

/**
 * Form checkout satu Varian (PRD §5.2, UAT-E7): hanya isian email dengan pengingatnya, rincian perkiraan
 * dengan Kode unik yang belum diketahui (DESIGN.md "Rincian Total bayar"), kalimat Syarat & Ketentuan
 * bertaut tanpa kotak centang, lalu tombol "Bayar dengan QRIS" di bilah lekat. Isian voucher baru ada di
 * M2. Di layar lebar, isian dan rinciannya menjadi dua kolom sama lebar.
 */
export function FormCheckout({ checkout }: { checkout: IsiCheckout }) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanFormCheckout,
    FormData
  >(aksiCheckout, { email: "" });
  const galatEmail = keadaan.galat?.email;
  const galatCheckout = keadaan.galat?.checkout;

  return (
    <form
      action={aksi}
      noValidate
      className="mt-6 grid gap-6 lebar:grid-cols-2 lebar:items-start lebar:gap-8"
    >
      <input type="hidden" name="varianId" value={checkout.varianId} />

      <div className="flex min-w-0 flex-col gap-6">
        <p className={cn(PANEL, "[overflow-wrap:anywhere]")}>
          <span className="font-extrabold">{checkout.namaProduk}</span>{" "}
          <span className="text-tinta-redup">· {checkout.namaVarian}</span>
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-bold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            defaultValue={keadaan.email}
            aria-invalid={galatEmail ? true : undefined}
            aria-describedby="email-keterangan"
            className={KELAS_ISIAN}
          />
          {galatEmail ? (
            <PesanGalat id="email-keterangan" pesan={galatEmail} />
          ) : (
            <p id="email-keterangan" className="text-[13px] text-tinta-redup">
              Pastikan email benar, detail pesanan dikirim ke sini.
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <section aria-label="Rincian pembayaran" className={PANEL}>
          <RincianNominal
            baris={[
              { label: "Harga jual", nilai: rupiah(checkout.hargaJual) },
              {
                label: "Kode unik",
                nilai: "Rp 1–499, dari Qrispy",
                redup: true,
              },
            ]}
            total={{
              label: "Perkiraan bayar",
              nilai: (
                <>
                  <span className="whitespace-nowrap">
                    {rupiah(checkout.perkiraanBayar)}
                  </span>{" "}
                  <span className="whitespace-nowrap">+ Kode unik</span>
                </>
              ),
            }}
          />
        </section>
        <p className="mt-4 text-[13px] text-tinta-redup">
          Dengan membayar, Anda menyetujui{" "}
          <Link
            href="/syarat-ketentuan"
            className="font-bold text-aksi-teks underline decoration-[1.5px] underline-offset-[3px]"
          >
            Syarat &amp; Ketentuan
          </Link>
          .
        </p>
        {galatCheckout && <PesanGalat pesan={galatCheckout} className="mt-4" />}
        <BilahLekat>
          <button
            type="submit"
            disabled={sedangMemproses}
            className={KELAS_TOMBOL_UTAMA}
          >
            {sedangMemproses ? "Membuat QRIS…" : "Bayar dengan QRIS"}
          </button>
        </BilahLekat>
      </div>
    </form>
  );
}
