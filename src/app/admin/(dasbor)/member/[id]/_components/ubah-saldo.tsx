"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";

import type { AksiSaldoAdmin } from "@/domain/ubah-saldo-admin";

import { IsianTeks } from "../../../_components/isian-form";
import { aksiUbahSaldo, type KeadaanUbahSaldo } from "../aksi";

/** Tombol kecil 40 px untuk aksi di dasbor admin (DESIGN.md Buttons). */
const KELAS_TOMBOL_KECIL = "tombol tombol-kecil";
const KELAS_TOMBOL_KECIL_KEDUA = "tombol tombol-kecil tombol-kedua";

const LABEL: Record<
  AksiSaldoAdmin,
  { judul: string; ya: string; memproses: string }
> = {
  tambah: {
    judul: "Tambah saldo",
    ya: "Ya, tambah saldo",
    memproses: "Menambah…",
  },
  kurangi: {
    judul: "Kurangi saldo",
    ya: "Ya, kurangi saldo",
    memproses: "Mengurangi…",
  },
};

const KOSONG: KeadaanUbahSaldo = { isian: { nominal: "", keterangan: "" } };

/**
 * Form satu aksi saldo: isian nominal dan keterangan, lalu penegasan di tempat sebelum aksi dijalankan (PRD §15.6,
 * DESIGN.md Navigation). "Simpan" menilai isian di server tanpa mengubah saldo. Bila sah, form diganti kalimat
 * penegasan, misalnya "Tambah Rp 50.000 ke saldo budi@mail.com?", dengan tombol "Ya, …" dan Batal. Batal kembali ke
 * form dengan isian yang sama. Setelah disetujui dan berhasil, form tertutup dan halaman menampilkan saldo
 * barunya, tanpa pesan "tersimpan". Isian yang ditolak tampil lagi beserta pesannya.
 */
function FormUbahSaldo({
  idMember,
  aksi,
  tutup,
}: {
  idMember: string;
  aksi: AksiSaldoAdmin;
  tutup: () => void;
}) {
  // Penegasan yang sedang ditampilkan, atau null bila Admin masih mengisi form.
  const [penegasan, setPenegasan] = useState<string | null>(null);
  const [keadaan, kirim, sedangMengirim] = useActionState<
    KeadaanUbahSaldo,
    FormData
  >(async (sebelumnya, formData) => {
    const hasil = await aksiUbahSaldo(sebelumnya, formData);
    setPenegasan(hasil.penegasan ?? null);
    if (hasil.selesai) tutup();
    return hasil;
  }, KOSONG);
  const label = LABEL[aksi];

  return (
    <form
      action={kirim}
      aria-label={label.judul}
      className="flex flex-col gap-4 rounded-coret-md border-2 border-pensil bg-permukaan p-4"
    >
      <input type="hidden" name="idMember" value={idMember} />
      <input type="hidden" name="aksi" value={aksi} />
      {penegasan ? (
        <>
          <input type="hidden" name="tahap" value="jalankan" />
          <input type="hidden" name="nominal" value={keadaan.isian.nominal} />
          <input
            type="hidden"
            name="keterangan"
            value={keadaan.isian.keterangan}
          />
          <p className="text-[17px] [overflow-wrap:anywhere]">{penegasan}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={sedangMengirim}
              className={KELAS_TOMBOL_KECIL}
            >
              {sedangMengirim ? label.memproses : label.ya}
            </button>
            <button
              type="button"
              disabled={sedangMengirim}
              onClick={() => setPenegasan(null)}
              className={KELAS_TOMBOL_KECIL_KEDUA}
            >
              Batal
            </button>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="tahap" value="periksa" />
          <h3 className="text-[22px]">{label.judul}</h3>
          <IsianTeks
            nama="nominal"
            id={`nominal-${aksi}`}
            label="Nominal"
            nilaiAwal={keadaan.isian.nominal}
            galat={keadaan.galat?.nominal}
            bantuan="Rupiah bulat, minimal Rp 1, misalnya 50.000."
            inputMode="numeric"
            autoFocus
          />
          <IsianTeks
            nama="keterangan"
            id={`keterangan-${aksi}`}
            label="Keterangan"
            nilaiAwal={keadaan.isian.keterangan}
            galat={keadaan.galat?.keterangan}
            bantuan="Wajib, paling banyak 100 karakter. Member melihat keterangan ini di Riwayat saldo."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={sedangMengirim}
              className={KELAS_TOMBOL_KECIL}
            >
              {sedangMengirim ? "Memeriksa…" : "Simpan"}
            </button>
            <button
              type="button"
              disabled={sedangMengirim}
              onClick={tutup}
              className={KELAS_TOMBOL_KECIL_KEDUA}
            >
              Batal
            </button>
          </div>
        </>
      )}
    </form>
  );
}

/**
 * Tombol "Tambah saldo" dan "Kurangi saldo" di halaman Member (PRD §15.6), untuk Member aktif maupun nonaktif.
 * Tombol yang ditekan membuka form aksinya di bawah tombol; kewenangannya diperiksa lagi di Server Action.
 */
export function UbahSaldo({ idMember }: { idMember: string }) {
  const [terbuka, setTerbuka] = useState<AksiSaldoAdmin | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={terbuka === "tambah"}
          onClick={() => setTerbuka("tambah")}
          className={KELAS_TOMBOL_KECIL}
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
          Tambah saldo
        </button>
        <button
          type="button"
          aria-expanded={terbuka === "kurangi"}
          onClick={() => setTerbuka("kurangi")}
          className={KELAS_TOMBOL_KECIL_KEDUA}
        >
          <Minus aria-hidden="true" className="size-5" strokeWidth={2.5} />
          Kurangi saldo
        </button>
      </div>
      {terbuka && (
        // Form dipasang ulang setiap aksi berganti, supaya isian dan penegasannya tidak terbawa.
        <FormUbahSaldo
          key={terbuka}
          idMember={idMember}
          aksi={terbuka}
          tutup={() => setTerbuka(null)}
        />
      )}
    </div>
  );
}
