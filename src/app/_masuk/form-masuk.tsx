"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TombolWhatsApp } from "../(toko)/_components/tombol-whatsapp";
import type { KeadaanFormMasuk } from "./pesan-masuk";

const KEADAAN_AWAL: KeadaanFormMasuk = { email: "" };

// Pesan galat (DESIGN.md Inputs / Fields): 16 px merah `aksi` dengan ikon TriangleAlert.
export function PesanGalat({
  id,
  peran,
  children,
}: {
  id: string;
  peran?: "alert";
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role={peran}
      className="flex items-start gap-2 text-[16px] leading-snug text-aksi"
    >
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={2.5}
        className="mt-px size-5 shrink-0"
      />
      {children}
    </p>
  );
}

/**
 * Isian berlabel (DESIGN.md Inputs / Fields), dipakai form login dan form Daftar: label 17 px di atas
 * isian bertepi coretan, lalu teks bantuan 15 px. Teks bantuan diganti pesan galat bila ada galat, dan
 * `aria-invalid` membuat tepi isian merah. `className` ditambahkan ke kelas `isian`.
 */
export function Isian({
  nama,
  label,
  galat,
  bantuan,
  className,
  ...atribut
}: {
  nama: string;
  label: string;
  galat?: string;
  bantuan?: string;
} & Omit<ComponentProps<"input">, "id" | "name">) {
  const idGalat = `${nama}-galat`;
  const idBantuan = `${nama}-bantuan`;
  const idKeterangan = galat ? idGalat : bantuan ? idBantuan : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={nama} className="text-[17px] leading-tight">
        {label}
      </label>
      <input
        id={nama}
        name={nama}
        required
        aria-invalid={galat ? true : undefined}
        aria-describedby={idKeterangan}
        className={cn("isian", className)}
        {...atribut}
      />
      {galat ? (
        <PesanGalat id={idGalat}>{galat}</PesanGalat>
      ) : (
        bantuan && (
          <p id={idBantuan} className="text-[15px] text-pensil-redup">
            {bantuan}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Form login dengan email dan password serta tombol "Masuk", dipakai login Admin (PRD §2.2) dan
 * login Member (PRD §7.5). Server Action-nya ditentukan halaman yang memasangnya. Bila Server Action
 * mengembalikan nomor WhatsApp (Member nonaktif), tombol WhatsApp tampil di bawah pesannya; tanpa nomor,
 * TombolWhatsApp tidak tampil. `children` adalah isian tersembunyi tambahan yang ikut dikirim, misalnya alamat
 * kembali login Member.
 */
export function FormMasuk({
  aksiMasuk,
  children,
}: {
  aksiMasuk: (
    sebelumnya: KeadaanFormMasuk,
    formData: FormData,
  ) => Promise<KeadaanFormMasuk>;
  children?: ReactNode;
}) {
  const [keadaan, aksi, sedangMengirim] = useActionState(
    aksiMasuk,
    KEADAAN_AWAL,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="kartu selotip relative mt-6 flex flex-col gap-4 p-5"
    >
      {children}
      <Isian
        nama="email"
        label="Email"
        type="email"
        autoComplete="username"
        defaultValue={keadaan.email}
        galat={keadaan.galat?.email}
      />
      <Isian
        nama="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        galat={keadaan.galat?.password}
      />
      {keadaan.galat?.umum && (
        <PesanGalat id="masuk-galat" peran="alert">
          {keadaan.galat.umum}
        </PesanGalat>
      )}
      <TombolWhatsApp nomor={keadaan.nomorWhatsapp ?? null}>
        Hubungi kami di WhatsApp
      </TombolWhatsApp>
      <button
        type="submit"
        disabled={sedangMengirim}
        className="tombol mt-2 w-full"
      >
        {sedangMengirim ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
