"use client";

import { useActionState } from "react";

import { NOMINAL_PESANAN_GRATIS } from "@/domain/produk-gratis";
import { rincianNominal } from "@/domain/rincian-nominal";
import { rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { bacaCheckout } from "@/server/pesanan";

import { BilahLekat } from "../../../_components/bilah-lekat";
import { PesanGalat } from "../../../_components/pesan-galat";
import { RincianNominal } from "../../../_components/rincian-nominal";
import { aksiAmbilGratis, type KeadaanFormAmbilGratis } from "../aksi";

type IsiCheckout = NonNullable<Awaited<ReturnType<typeof bacaCheckout>>>;

/** Panel (DESIGN.md "Cards / Containers"): padding 16 px, dan 24 px di layar lebar yang kolomnya lebih lapang. */
const PANEL = "kartu p-4 lebar:p-6";

/** Label 17 px di atas isian (DESIGN.md Inputs / Fields). */
const KELAS_LABEL = "text-[17px] leading-tight";

/** Tulisan di bawah rincian Pesanan gratis, "Gratis" (PRD §16.4). */
const { keterangan: KETERANGAN_GRATIS } = rincianNominal("Gratis");

/**
 * Checkout Produk gratis untuk Member yang sedang login (PRD §16.3, UAT-P3), berurutan: email Member yang tidak bisa
 * diubah (PRD §5.2), rincian Pesanan gratis berisi "Total bayar Rp 0" lalu tulisan "Gratis" (PRD §16.4), baris "Jatah
 * Anda: sisa N dari M", lalu tombol "Ambil gratis" di bilah lekat. Tidak ada isian kode voucher dan tidak ada pilihan
 * Metode. Tata letaknya sama dengan form checkout biasa (DESIGN.md "Tata letak halaman", pola Dua kolom): Produk dan
 * email di kolom kiri, rincian, jatah, dan tombol di kolom kanan.
 *
 * Bila Sisa jatah sudah 0 saat Checkout dibuka, pesan jatah habis tampil sebagai pengganti tombol "Ambil gratis".
 * "Ambil gratis" langsung berjalan tanpa dialog penegasan, dan selama diproses tombolnya bertuliskan "Mengambil…".
 * Penolakannya tampil sebagai pesan galat di atas tombol. Sisa jatah dan pesannya datang dari server (sisaJatah).
 */
export function FormAmbilGratis({
  checkout,
  jatah,
  emailMember,
}: {
  checkout: IsiCheckout;
  jatah: NonNullable<IsiCheckout["jatah"]>;
  emailMember: string;
}) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanFormAmbilGratis,
    FormData
  >(aksiAmbilGratis, {});

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
            id="email"
            type="email"
            value={emailMember}
            readOnly
            aria-describedby="email-keterangan"
            className="isian"
          />
          <p id="email-keterangan" className="text-[15px] text-pensil-redup">
            Pastikan email benar, detail pesanan dikirim ke sini.
          </p>
        </div>
      </div>

      <div className="min-w-0 lebar:sticky lebar:top-24">
        <section aria-label="Rincian pembayaran" className={PANEL}>
          <RincianNominal
            baris={[]}
            total={{
              label: "Total bayar",
              nilai: rupiah(NOMINAL_PESANAN_GRATIS.totalBayar),
            }}
          />
          <p className="mt-3 text-[16px] text-pensil-redup">
            {KETERANGAN_GRATIS}
          </p>
        </section>
        <p className="mt-4 text-[18px]">{jatah.teksJatah}</p>
        {keadaan.galat && <PesanGalat pesan={keadaan.galat} className="mt-4" />}
        {jatah.pesanJatahHabis ? (
          <p role="status" className={cn(PANEL, "mt-6")}>
            {jatah.pesanJatahHabis}
          </p>
        ) : (
          <BilahLekat>
            <button type="submit" disabled={sedangMemproses} className="tombol">
              {sedangMemproses ? "Mengambil…" : "Ambil gratis"}
            </button>
          </BilahLekat>
        )}
      </div>
    </form>
  );
}
