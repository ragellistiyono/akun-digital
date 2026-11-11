"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { IsianTeks } from "../../_components/isian-form";
import { aksiSimpanPengaturanToko, type KeadaanFormPengaturan } from "../aksi";

const bantuanTeksHalaman = (halaman: string) =>
  `Teks tampil apa adanya di halaman ${halaman}. Setiap baris baru menjadi paragraf.`;

export function FormPengaturan({ awal }: { awal: KeadaanFormPengaturan }) {
  const [keadaan, aksi, sedangMenyimpan] = useActionState(
    aksiSimpanPengaturanToko,
    awal,
  );

  return (
    <form
      action={aksi}
      noValidate
      className="mt-6 flex max-w-[720px] flex-col gap-6 rounded-[20px] bg-permukaan p-4 shadow-bayang"
    >
      <IsianTeks
        nama="nomorWhatsapp"
        label="Nomor WhatsApp"
        nilaiAwal={keadaan.nilai.nomorWhatsapp}
        galat={keadaan.galat?.nomorWhatsapp}
        bantuan="Boleh ditulis 0812-3456-7890 atau +62 812 3456 7890; toko menyimpannya sebagai 6281234567890. Kosongkan bila tombol WhatsApp belum ingin ditampilkan."
      />
      <IsianTeks
        nama="syaratKetentuan"
        label="Syarat & Ketentuan"
        nilaiAwal={keadaan.nilai.syaratKetentuan}
        bantuan={bantuanTeksHalaman("Syarat & Ketentuan")}
        banyakBaris
      />
      <IsianTeks
        nama="kebijakanPrivasi"
        label="Kebijakan Privasi"
        nilaiAwal={keadaan.nilai.kebijakanPrivasi}
        bantuan={bantuanTeksHalaman("Kebijakan Privasi")}
        banyakBaris
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={sedangMenyimpan}
          className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98] disabled:bg-permukaan-2 disabled:text-tinta-redup"
        >
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        {/* Wadah status selalu ada supaya pembaca layar mengumumkan isinya saat berubah. */}
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-bold text-st-selesai"
        >
          {keadaan.tersimpan && !sedangMenyimpan && (
            <>
              <Check aria-hidden="true" className="size-6 shrink-0" />
              Pengaturan toko tersimpan.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
