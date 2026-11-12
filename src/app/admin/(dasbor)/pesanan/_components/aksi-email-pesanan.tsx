"use client";

import { Check, Send, TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import { IsianTeks } from "../../_components/isian-form";
import {
  aksiKirimUlangEmail,
  aksiKoreksiEmail,
  type KeadaanKirimUlangEmail,
} from "../aksi";

/** Tombol 40 px dengan kepadatan Operate dasbor admin (DESIGN.md Navigation). */
const KELAS_TOMBOL =
  "inline-flex h-10 w-fit items-center gap-2 rounded-[12px] px-4 text-sm font-bold disabled:bg-permukaan-2 disabled:text-tinta-redup";

const KELAS_TOMBOL_UTAMA = `${KELAS_TOMBOL} bg-aksi text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]`;

const KELAS_TOMBOL_GARIS = `${KELAS_TOMBOL} border-[1.5px] border-garis bg-permukaan text-tinta hover:border-monogram`;

/**
 * Hasil aksi: pesan berhasil berwarna `st-selesai` dengan ikon `Check`, atau pesan galat berwarna
 * `st-masalah` dengan ikon `TriangleAlert`. Wadahnya selalu ada supaya pembaca layar mengumumkan isinya
 * saat berubah.
 */
function HasilAksi({ keadaan }: { keadaan: KeadaanKirimUlangEmail }) {
  return (
    <p role="status" className="text-[13px] font-bold">
      {keadaan.galat ? (
        <span className="flex items-start gap-2 text-st-masalah">
          <TriangleAlert aria-hidden="true" className="size-6 shrink-0" />
          {keadaan.galat}
        </span>
      ) : (
        keadaan.pesan && (
          <span className="flex items-start gap-2 text-st-selesai">
            <Check aria-hidden="true" className="size-6 shrink-0" />
            {keadaan.pesan}
          </span>
        )
      )}
    </p>
  );
}

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
 * Admin, lalu email "Pesanan selesai" dikirim ulang ke email baru. Galat isian tampil di bawah isian.
 */
function FormKoreksiEmail({
  pesananId,
  email,
}: {
  pesananId: string;
  email: string;
}) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState(aksiKoreksiEmail, {
    email,
  });
  return (
    <form
      action={aksi}
      noValidate
      aria-label="Koreksi email"
      className="flex flex-col gap-4 border-t border-garis pt-4"
    >
      <input type="hidden" name="pesananId" value={pesananId} />
      <IsianTeks
        nama="email"
        id="email-baru"
        label="Email baru"
        nilaiAwal={keadaan.email}
        galat={sedangMenyimpan ? undefined : keadaan.galat}
        bantuan='Ganti email yang salah ketik, misalnya atas permintaan Pembeli lewat WhatsApp. Pesanan ini pindah ke email baru, lalu email "Pesanan selesai" dikirim ulang ke sana.'
        inputMode="email"
      />
      <button
        type="submit"
        disabled={sedangMenyimpan}
        className={KELAS_TOMBOL_GARIS}
      >
        {sedangMenyimpan ? "Menyimpan…" : "Simpan dan kirim ulang"}
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
      <FormKoreksiEmail pesananId={pesananId} email={email} />
    </section>
  );
}
