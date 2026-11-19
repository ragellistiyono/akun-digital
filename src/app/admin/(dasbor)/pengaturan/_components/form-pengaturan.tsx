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
      className="kartu flex flex-col gap-6 p-4 sm:p-6"
    >
      {/* Dua isian pendek berdampingan di layar lebar, dengan urutan tetap. */}
      <div className="grid items-start gap-6 sm:grid-cols-2">
        <IsianTeks
          nama="nomorWhatsapp"
          label="Nomor WhatsApp"
          nilaiAwal={keadaan.nilai.nomorWhatsapp}
          galat={keadaan.galat?.nomorWhatsapp}
          bantuan="Boleh ditulis 0812-3456-7890 atau +62 812 3456 7890; toko menyimpannya sebagai 6281234567890. Kosongkan bila tombol WhatsApp belum ingin ditampilkan."
        />
        <IsianTeks
          nama="ambangStokMenipis"
          label="Ambang stok menipis"
          nilaiAwal={keadaan.nilai.ambangStokMenipis}
          galat={keadaan.galat?.ambangStokMenipis}
          bantuan="Varian aktif dengan Stok Varian sama dengan atau kurang dari angka ini masuk daftar Stok menipis di Ringkasan. Isi bilangan bulat 0 sampai 999."
          inputMode="numeric"
        />
      </div>
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
        <button type="submit" disabled={sedangMenyimpan} className="tombol">
          {sedangMenyimpan ? "Menyimpan…" : "Simpan"}
        </button>
        {/* Wadah status selalu ada supaya pembaca layar mengumumkan isinya saat berubah. */}
        <p
          role="status"
          className="flex items-center gap-2 text-[17px] text-st-selesai"
        >
          {keadaan.tersimpan && !sedangMenyimpan && (
            <>
              <Check
                aria-hidden="true"
                className="size-6 shrink-0"
                strokeWidth={2.5}
              />
              Pengaturan toko tersimpan.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
