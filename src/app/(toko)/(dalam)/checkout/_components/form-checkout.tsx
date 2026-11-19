"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { kodeBaku } from "@/domain/kode-voucher";
import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { bacaCheckout } from "@/server/pesanan";

import { BilahLekat } from "../../../_components/bilah-lekat";
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

/** Panel (DESIGN.md "Cards / Containers"): padding 16 px, dan 24 px di layar lebar yang kolomnya lebih lapang. */
const PANEL = "kartu p-4 lebar:p-6";

/** Label 17 px di atas isian (DESIGN.md Inputs / Fields). */
const KELAS_LABEL = "text-[17px] leading-tight";

/**
 * Tautan di dalam teks: pulpen biru yang digarisbawahi. Tautan ini hanya dipasang di atas `kertas` atau
 * `permukaan`, supaya kontrasnya cukup.
 */
const KELAS_TAUTAN = "text-pulpen underline decoration-2 underline-offset-4";

/**
 * Hasil tombol "Pakai" beserta keadaan form saat tombol itu ditekan. Keadaan itu menentukan mana yang lebih baru:
 * hasil "Pakai", atau hasil "Bayar dengan QRIS" sesudahnya.
 */
type PakaiVoucher = {
  /** Kode di isian saat "Pakai" ditekan, belum dibakukan. */
  kode: string;
  hasil: HasilPakaiVoucher;
  keadaan: KeadaanFormCheckout;
};

/**
 * Form checkout satu Varian (PRD §5.2, UAT-E7): isian email dengan pengingatnya dan isian kode voucher yang
 * opsional, rincian perkiraan dengan Kode unik yang belum diketahui (DESIGN.md "Rincian Total bayar"), kalimat
 * Syarat & Ketentuan bertaut tanpa kotak centang, lalu tombol "Bayar dengan QRIS" di bilah lekat. Di layar
 * lebar, isian dan rinciannya menjadi dua kolom sama lebar (DESIGN.md "Tata letak halaman", pola Dua kolom),
 * dan kolom rincian lekat di bawah bilah atas.
 *
 * Kode voucher tampil dalam huruf kapital dengan tombol kedua "Pakai" di sebelahnya (DESIGN.md Inputs, isian
 * gabung). "Pakai" langsung memeriksa kode itu (PRD §8.7 ▶ Keputusan 2026-11-17): bila diterima, tampil
 * "<KODE> dipakai: potongan Rp X" berwarna `st-selesai`, dan rincian menampilkan "Potongan voucher (KODE)" beserta
 * Perkiraan bayar yang baru; bila ditolak, tampil pesan penolakannya. Kode diperiksa sekali lagi saat Pesanan
 * dibuat. Bila Voucher ditolak saat itu, pesan penolakannya tampil di isian kode, dan kodenya tetap berisi. Pesan
 * Voucher khusus Member diberi tautan Masuk yang membawa Member kembali ke Checkout Varian ini setelah login, dengan
 * isian kode berisi kode yang ditolak itu (`kodeVoucher`). "Pakai" tidak ditekan otomatis (PRD §8.7 ▶ Keputusan
 * 2026-11-17).
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
  kodeVoucher,
}: {
  checkout: IsiCheckout;
  emailMember: string | null;
  kodeVoucher: string;
}) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanFormCheckout,
    FormData
  >(aksiCheckout, { email: emailMember ?? "", kodeVoucher });
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
          kode: keadaan.kodeVoucher,
          pesan: keadaan.galat.kodeVoucher,
          khususMember: keadaan.voucherKhususMember === true,
        }
      : pakai && hasilPakai && !hasilPakai.diterima
        ? { kode: pakai.kode, ...hasilPakai }
        : null;
  // Kode voucher dibawa dalam bentuk bakunya (PRD §8.1), seperti yang tampil di isiannya.
  const alamatKembali = `/checkout?${new URLSearchParams({
    varianId: checkout.varianId,
    ...(penolakanVoucher && {
      kodeVoucher: kodeBaku(penolakanVoucher.kode),
    }),
  })}`;
  const alamatMasuk = `/masuk?${new URLSearchParams({ kembali: alamatKembali })}`;

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
      setPakai({ kode, hasil, keadaan: keadaanSaatDitekan });
    });
  }

  return (
    <form action={aksi} noValidate className="tata-dua-kolom mt-6">
      <input type="hidden" name="varianId" value={checkout.varianId} />

      <div className="flex min-w-0 flex-col gap-6">
        <p className={cn(PANEL, "-rotate-[0.6deg] [overflow-wrap:anywhere]")}>
          <span className="font-spidol text-[20px] font-bold">
            {checkout.namaProduk}
          </span>{" "}
          <span className="text-pensil-redup">· {checkout.namaVarian}</span>
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={KELAS_LABEL}>
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
            className="isian"
          />
          {galatEmail ? (
            <PesanGalat id="email-keterangan" pesan={galatEmail} />
          ) : (
            <p id="email-keterangan" className="text-[15px] text-pensil-redup">
              Pastikan email benar, detail pesanan dikirim ke sini.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="kodeVoucher" className={KELAS_LABEL}>
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
              className="isian min-w-0 flex-1 uppercase"
            />
            <button
              type="button"
              onClick={pakaiVoucher}
              disabled={sedangMemeriksa}
              // Setinggi isian di sebelahnya (52 px), dengan bingkai 2 px yang sama tebalnya.
              className="tombol tombol-kedua tombol-kecil min-h-[52px] shrink-0 px-5 disabled:cursor-wait"
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
                className="flex items-start gap-2 text-[16px] leading-snug text-st-selesai"
              >
                <Check
                  aria-hidden="true"
                  strokeWidth={2.5}
                  className="mt-px size-5 shrink-0"
                />
                {voucherDipakai.kodeVoucher} dipakai: potongan{" "}
                {rupiah(voucherDipakai.potonganVoucher)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 lebar:sticky lebar:top-24">
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
              // Nilai ini boleh patah baris di antara kedua bagiannya di layar sempit.
              nilai: (
                <span className="whitespace-normal">
                  <span className="whitespace-nowrap">
                    {rupiah(
                      voucherDipakai?.perkiraanBayar ?? checkout.perkiraanBayar,
                    )}
                  </span>{" "}
                  <span className="whitespace-nowrap">+ Kode unik</span>
                </span>
              ),
            }}
          />
        </section>
        <p className="mt-4 text-[15px] text-pensil-redup">
          Dengan membayar, Anda menyetujui{" "}
          <Link href="/syarat-ketentuan" className={KELAS_TAUTAN}>
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
          <button type="submit" disabled={sedangMemproses} className="tombol">
            {sedangMemproses ? "Membuat QRIS…" : "Bayar dengan QRIS"}
          </button>
        </BilahLekat>
      </div>
    </form>
  );
}
