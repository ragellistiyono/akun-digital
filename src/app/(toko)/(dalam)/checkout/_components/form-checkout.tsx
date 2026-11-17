"use client";

import Link from "next/link";
import { useActionState } from "react";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { bacaCheckout } from "@/server/pesanan";

import {
  BilahLekat,
  KELAS_TOMBOL_UTAMA,
} from "../../../_components/bilah-lekat";
import { PesanGalat } from "../../../_components/pesan-galat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { aksiCheckout, type KeadaanFormCheckout } from "../aksi";

type IsiCheckout = NonNullable<Awaited<ReturnType<typeof bacaCheckout>>>;

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

/**
 * Isian 52 px (DESIGN.md Inputs / Fields): garis `garis`, fokus `aksi` dengan halo, galat `st-masalah`.
 * Isian yang tidak bisa diubah berlatar Permukaan Lembut (`permukaan-2`).
 */
const KELAS_ISIAN =
  "h-[52px] rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta placeholder:text-tinta-redup read-only:bg-permukaan-2 focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah";

/**
 * Form checkout satu Varian (PRD §5.2, UAT-E7): isian email dengan pengingatnya dan isian kode voucher yang
 * opsional, rincian perkiraan dengan Kode unik yang belum diketahui (DESIGN.md "Rincian Total bayar"), kalimat
 * Syarat & Ketentuan bertaut tanpa kotak centang, lalu tombol "Bayar dengan QRIS" di bilah lekat. Di layar
 * lebar, isian dan rinciannya menjadi dua kolom sama lebar.
 *
 * Kode voucher tampil dalam huruf kapital (DESIGN.md Inputs, isian gabung) dan diperiksa saat Pesanan dibuat.
 * Bila Voucher ditolak, pesan penolakannya menggantikan teks bantuan isian itu, dan kodenya tetap berisi
 * (PRD §8.7 ▶ Keputusan 2026-11-17).
 *
 * Bila Member sedang login (`emailMember`), isian email sudah berisi email Member dan tidak bisa diubah
 * (PRD §5.2). Server tetap memakai email dari sesi Member, bukan dari isian ini.
 */
export function FormCheckout({
  checkout,
  emailMember,
}: {
  checkout: IsiCheckout;
  emailMember: string | null;
}) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanFormCheckout,
    FormData
  >(aksiCheckout, { email: emailMember ?? "", kodeVoucher: "" });
  const galatEmail = keadaan.galat?.email;
  const galatKodeVoucher = keadaan.galat?.kodeVoucher;
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
            defaultValue={emailMember ?? keadaan.email}
            readOnly={emailMember !== null}
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

        <div className="flex flex-col gap-2">
          <label htmlFor="kodeVoucher" className="text-sm font-bold">
            Kode voucher (opsional)
          </label>
          <input
            id="kodeVoucher"
            name="kodeVoucher"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            defaultValue={keadaan.kodeVoucher}
            aria-invalid={galatKodeVoucher ? true : undefined}
            aria-describedby={
              galatKodeVoucher ? "kode-voucher-keterangan" : undefined
            }
            className={cn(KELAS_ISIAN, "uppercase")}
          />
          {galatKodeVoucher && (
            <PesanGalat id="kode-voucher-keterangan" pesan={galatKodeVoucher} />
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
