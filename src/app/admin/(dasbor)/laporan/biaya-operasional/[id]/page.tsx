import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { angkaRupiah } from "@/lib/rupiah";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaBiayaOperasional } from "@/server/biaya-operasional";
import { tanggalIsianWib } from "@/server/zona-waktu-toko";

import { PanelHapus } from "../../../_components/penegasan-hapus";
import { FormBiayaOperasional } from "../_components/form-biaya-operasional";
import { aksiHapusBiayaOperasional } from "../aksi";

// Mengubah tanggal, keterangan, atau nominal sebuah Biaya operasional, dengan panel Hapus Biaya operasional di
// bawahnya (PRD §14.4). Penghapusan ditegaskan di tempat, seperti panel hapus Voucher (PRD §8.8).
export default async function HalamanUbahBiayaOperasional({
  params,
}: PageProps<"/admin/laporan/biaya-operasional/[id]">) {
  await wajibSesiAdmin(await headers());

  const id = z.uuid().safeParse((await params).id);
  const biaya = id.success ? await bacaBiayaOperasional(id.data) : null;
  if (!biaya) notFound();

  return (
    // Satu form di kolom 720 px di tengah, dengan panel Hapus di akhir kolom (DESIGN.md Tata letak halaman).
    <div className="tata-baca space-y-6">
      <h1>Ubah Biaya operasional</h1>
      <FormBiayaOperasional
        idBiaya={biaya.id}
        awal={{
          isian: {
            tanggal: biaya.tanggal,
            keterangan: biaya.keterangan,
            nominal: angkaRupiah(biaya.nominal),
          },
        }}
        hariIni={tanggalIsianWib(new Date())}
        bulanBatal={biaya.tanggal.slice(0, 7)}
      />
      <PanelHapus
        judul="Hapus Biaya operasional"
        keterangan="Hapus biaya yang tidak jadi dikeluarkan atau tercatat dua kali. Biaya yang salah tanggal atau nominalnya cukup diubah di form di atas."
        aksi={aksiHapusBiayaOperasional}
        isian={{ id: biaya.id }}
        nama={`Biaya operasional "${biaya.keterangan}"`}
        akibat="Biaya ini terhapus dan tidak bisa dikembalikan."
      />
    </div>
  );
}
