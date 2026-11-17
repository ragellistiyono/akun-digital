"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { bacaCheckout } from "@/server/pesanan";

import {
  BilahLekat,
  KELAS_TOMBOL_UTAMA,
} from "../../../_components/bilah-lekat";
import { PesanGalat } from "../../../_components/pesan-galat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";
import {
  aksiCheckout,
  aksiPakaiVoucher,
  type HasilPakaiVoucher,
  type KeadaanFormCheckout,
} from "../aksi";

type IsiCheckout = NonNullable<Awaited<ReturnType<typeof bacaCheckout>>>;

const PANEL = "rounded-[20px] bg-permukaan p-4 shadow-bayang";

/**
 * Isian 52 px (DESIGN.md Inputs / Fields): garis `garis`, fokus `aksi` dengan halo, galat `st-masalah`.
 * Isian yang tidak bisa diubah berlatar Permukaan Lembut (`permukaan-2`).
 */
const KELAS_ISIAN =
  "h-[52px] rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base text-tinta placeholder:text-tinta-redup read-only:bg-permukaan-2 focus-visible:border-aksi focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--monogram)_30%,transparent)] focus-visible:outline-none aria-invalid:border-st-masalah";

/** Tombol garis 52 px (DESIGN.md Buttons) untuk aksi kedua, di sini "Pakai" di isian gabung kode voucher. */
const KELAS_TOMBOL_GARIS =
  "inline-flex h-[52px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram disabled:cursor-wait disabled:text-tinta-redup";

const KELAS_TAUTAN =
  "text-aksi-teks underline decoration-[1.5px] underline-offset-[3px]";

/**
 * Hasil tombol "Pakai" beserta keadaan form saat tombol itu ditekan. Keadaan itu menentukan mana yang lebih baru:
 * hasil "Pakai", atau hasil "Bayar dengan QRIS" sesudahnya.
 */
type PakaiVoucher = { hasil: HasilPakaiVoucher; keadaan: KeadaanFormCheckout };

/**
 * Form checkout satu Varian (PRD §5.2, UAT-E7): isian email dengan pengingatnya dan isian kode voucher yang
 * opsional, rincian perkiraan dengan Kode unik yang belum diketahui (DESIGN.md "Rincian Total bayar"), kalimat
 * Syarat & Ketentuan bertaut tanpa kotak centang, lalu tombol "Bayar dengan QRIS" di bilah lekat. Di layar
 * lebar, isian dan rinciannya menjadi dua kolom sama lebar.
 *
 * Kode voucher tampil dalam huruf kapital dengan tombol garis "Pakai" di sebelahnya (DESIGN.md Inputs, isian
 * gabung). "Pakai" langsung memeriksa kode itu (PRD §8.7 ▶ Keputusan 2026-11-17): bila diterima, tampil
 * "<KODE> dipakai: potongan Rp X" berwarna `st-selesai`, dan rincian menampilkan "Potongan voucher (KODE)" beserta
 * Perkiraan bayar yang baru; bila ditolak, tampil pesan penolakannya. Kode diperiksa sekali lagi saat Pesanan
 * dibuat. Bila Voucher ditolak saat itu, pesan penolakannya tampil di isian kode, dan kodenya tetap berisi. Pesan
 * Voucher khusus Member diberi tautan Masuk yang membawa Member kembali ke Checkout Varian ini setelah login.
 *
 * Penolakan checkout karena email milik Member nonaktif diberi tombol WhatsApp di bawah pesannya, sama seperti login
 * Member nonaktif (PRD §5.2 ▶ Keputusan 2026-11-17). Tanpa nomor WhatsApp toko, hanya pesannya yang tampil.
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
  const galatCheckout = keadaan.galat?.checkout;

  const isianEmail = useRef<HTMLInputElement>(null);
  const isianKode = useRef<HTMLInputElement>(null);
  const [pakai, setPakai] = useState<PakaiVoucher | null>(null);
  const [sedangMemeriksa, mulaiMemeriksa] = useTransition();

  // Penolakan Voucher dari "Bayar dengan QRIS" yang datang setelah "Pakai" menggantikan hasil "Pakai" itu.
  // Galat checkout lain tidak, karena kode voucher-nya tidak berubah.
  const pakaiLebihBaru = pakai !== null && pakai.keadaan === keadaan;
  const hasilPakai =
    pakai && (pakaiLebihBaru || !keadaan.galat?.kodeVoucher)
      ? pakai.hasil
      : null;
  const voucherDipakai = hasilPakai?.diterima ? hasilPakai : null;
  const penolakanVoucher =
    !pakaiLebihBaru && keadaan.galat?.kodeVoucher
      ? {
          pesan: keadaan.galat.kodeVoucher,
          khususMember: keadaan.voucherKhususMember === true,
        }
      : hasilPakai && !hasilPakai.diterima
        ? hasilPakai
        : null;
  const alamatMasuk = `/masuk?kembali=${encodeURIComponent(`/checkout?varianId=${checkout.varianId}`)}`;

  /**
   * Tombol "Pakai" memeriksa kode di isian dengan email yang sedang diisi (PRD §8.7 ▶ Keputusan 2026-11-17). Isian
   * kode yang kosong menghapus hasil "Pakai" sebelumnya tanpa pemeriksaan.
   */
  function pakaiVoucher() {
    const kode = isianKode.current?.value.trim() ?? "";
    if (kode === "") {
      setPakai(null);
      return;
    }
    const email = isianEmail.current?.value ?? "";
    const keadaanSaatDitekan = keadaan;
    mulaiMemeriksa(async () => {
      const hasil = await aksiPakaiVoucher({
        varianId: checkout.varianId,
        kode,
        email,
      });
      setPakai({ hasil, keadaan: keadaanSaatDitekan });
    });
  }

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
            ref={isianEmail}
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
          <div className="flex gap-2">
            <input
              ref={isianKode}
              id="kodeVoucher"
              name="kodeVoucher"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              defaultValue={keadaan.kodeVoucher}
              // Hasil "Pakai" hanya berlaku untuk kode yang diperiksa, jadi hilang begitu kodenya diubah.
              onChange={() => setPakai(null)}
              aria-invalid={penolakanVoucher ? true : undefined}
              aria-describedby={
                penolakanVoucher || voucherDipakai
                  ? "kode-voucher-keterangan"
                  : undefined
              }
              className={cn(KELAS_ISIAN, "min-w-0 flex-1 uppercase")}
            />
            <button
              type="button"
              onClick={pakaiVoucher}
              disabled={sedangMemeriksa}
              className={KELAS_TOMBOL_GARIS}
            >
              Pakai
            </button>
          </div>
          {penolakanVoucher && (
            <PesanGalat
              id="kode-voucher-keterangan"
              pesan={
                penolakanVoucher.khususMember ? (
                  <>
                    {penolakanVoucher.pesan}{" "}
                    <Link href={alamatMasuk} className={KELAS_TAUTAN}>
                      Masuk
                    </Link>
                  </>
                ) : (
                  penolakanVoucher.pesan
                )
              }
            />
          )}
          <div aria-live="polite">
            {voucherDipakai && (
              <p
                id="kode-voucher-keterangan"
                className="text-[13px] font-bold text-st-selesai"
              >
                {voucherDipakai.kodeVoucher} dipakai: potongan{" "}
                {rupiah(voucherDipakai.potonganVoucher)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <section aria-label="Rincian pembayaran" className={PANEL}>
          <RincianNominal
            baris={[
              {
                label: "Harga jual",
                nilai: rupiah(voucherDipakai?.hargaJual ?? checkout.hargaJual),
              },
              voucherDipakai
                ? {
                    label: `Potongan voucher (${voucherDipakai.kodeVoucher})`,
                    nilai: `− ${rupiah(voucherDipakai.potonganVoucher)}`,
                  }
                : { label: "Potongan voucher", nilai: rupiah(0) },
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
                    {rupiah(
                      voucherDipakai?.perkiraanBayar ?? checkout.perkiraanBayar,
                    )}
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
        {keadaan.nomorWhatsapp && (
          <div className="mt-4 flex flex-col">
            <TombolWhatsApp nomor={keadaan.nomorWhatsapp}>
              Hubungi kami di WhatsApp
            </TombolWhatsApp>
          </div>
        )}
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
