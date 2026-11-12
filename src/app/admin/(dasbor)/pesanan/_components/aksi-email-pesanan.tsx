"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { cn } from "@/lib/utils";

import { IsianTeks } from "../../_components/isian-form";
import {
  aksiKirimUlangEmail,
  aksiKoreksiEmail,
  aksiKoreksiEmailBermasalah,
  type KeadaanKoreksiEmail,
} from "../aksi";
import {
  HasilAksi,
  KELAS_TOMBOL_GARIS,
  KELAS_TOMBOL_UTAMA,
} from "./hasil-aksi";

/** Kirim ulang email "Pesanan selesai" ke email Pesanan (PRD §6.4). */
function FormKirimUlang({ pesananId }: { pesananId: string }) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiKirimUlangEmail,
    {},
  );
  return (
    <form
      action={aksi}
      aria-label="Kirim ulang email"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="pesananId" value={pesananId} />
      <button
        type="submit"
        disabled={sedangMengirim}
        className={KELAS_TOMBOL_UTAMA}
      >
        <Send aria-hidden="true" className="size-6 shrink-0" />
        {sedangMengirim ? "Mengirim…" : "Kirim ulang email"}
      </button>
      <HasilAksi keadaan={sedangMengirim ? {} : keadaan} />
    </form>
  );
}

/**
 * Koreksi email Pesanan yang salah ketik (PRD §6.4): isian berisi email Pesanan sekarang, yang diganti
 * Admin lewat `aksi` dengan tombol bernama `tombol`. Galat isian tampil di bawah isian.
 */
function FormKoreksiEmail({
  pesananId,
  email,
  aksi: aksiKoreksi,
  tombol,
  bantuan,
  className,
}: {
  pesananId: string;
  email: string;
  aksi: (
    sebelumnya: KeadaanKoreksiEmail,
    formData: FormData,
  ) => Promise<KeadaanKoreksiEmail>;
  tombol: string;
  bantuan: string;
  className?: string;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState(aksiKoreksi, {
    email,
  });
  return (
    <form
      action={aksi}
      noValidate
      aria-label="Koreksi email"
      className={cn("flex flex-col gap-4", className)}
    >
      <input type="hidden" name="pesananId" value={pesananId} />
      <IsianTeks
        nama="email"
        id="email-baru"
        label="Email baru"
        nilaiAwal={keadaan.email}
        galat={sedangMenyimpan ? undefined : keadaan.galat}
        bantuan={bantuan}
        inputMode="email"
      />
      <button
        type="submit"
        disabled={sedangMenyimpan}
        className={KELAS_TOMBOL_GARIS}
      >
        {sedangMenyimpan ? "Menyimpan…" : tombol}
      </button>
      <HasilAksi keadaan={sedangMenyimpan ? {} : { pesan: keadaan.pesan }} />
    </form>
  );
}

/**
 * Aksi email di detail Pesanan Selesai (PRD §6.4, §9.5): kirim ulang email "Pesanan selesai" dan koreksi
 * email Pesanan. Halaman hanya memasangnya untuk Pesanan yang kirim ulangnya tersedia; aksinya tetap
 * diperiksa lagi di server.
 */
export function AksiEmailPesanan({
  pesananId,
  email,
}: {
  pesananId: string;
  email: string;
}) {
  return (
    <section
      aria-labelledby="judul-email-pesanan"
      className="flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <h2
        id="judul-email-pesanan"
        className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Email &quot;Pesanan selesai&quot;
      </h2>
      {/* Dipasang ulang setelah email dikoreksi, supaya pesan kirim ulang ke email lama tidak tertinggal. */}
      <FormKirimUlang key={email} pesananId={pesananId} />
      <FormKoreksiEmail
        pesananId={pesananId}
        email={email}
        aksi={aksiKoreksiEmail}
        tombol="Simpan dan kirim ulang"
        bantuan='Ganti email yang salah ketik, misalnya atas permintaan Pembeli lewat WhatsApp. Pesanan ini pindah ke email baru, lalu email "Pesanan selesai" dikirim ulang ke sana.'
        className="border-t border-garis pt-4"
      />
    </section>
  );
}

/**
 * Koreksi email di detail Pesanan Bermasalah (PRD §6.4, ▶ Keputusan 2026-11-12), supaya alamatnya benar
 * sebelum Admin menekan "Kirim Item stok". Koreksi ini hanya menyimpan email baru; email "Pesanan selesai"
 * dikirim ke sana begitu Pesanan menjadi Selesai. Halaman hanya memasangnya untuk Pesanan Bermasalah;
 * aksinya tetap diperiksa lagi di server.
 */
export function KoreksiEmailBermasalah({
  pesananId,
  email,
}: {
  pesananId: string;
  email: string;
}) {
  return (
    <section
      aria-labelledby="judul-koreksi-email"
      className="flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <h2
        id="judul-koreksi-email"
        className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]"
      >
        Koreksi email
      </h2>
      <FormKoreksiEmail
        pesananId={pesananId}
        email={email}
        aksi={aksiKoreksiEmailBermasalah}
        tombol="Simpan email"
        bantuan='Ganti email yang salah ketik, misalnya atas permintaan Pembeli lewat WhatsApp. Pesanan ini pindah ke email baru tanpa mengirim email. Email "Pesanan selesai" dikirim ke sana setelah Anda menekan "Kirim Item stok".'
      />
    </section>
  );
}
