import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { daftarStokMenipis } from "@/server/stok-menipis";

import { DaftarStokMenipis } from "./_components/daftar-stok-menipis";

const KELAS_JUDUL_PANEL =
  "text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]";

// Halaman depan dasbor admin (PRD §9.2): kartu angka, lalu daftar Stok menipis di bawahnya (PRD §9.4). Kartu
// angka yang lain ditambahkan oleh tiketnya sendiri.
export default async function HalamanRingkasan() {
  await wajibSesiAdmin(await headers());
  const { ambangStokMenipis } = await bacaPengaturanToko();
  const stokMenipis = await daftarStokMenipis({ ambang: ambangStokMenipis });

  return (
    <>
      <h1>Ringkasan</h1>

      <div className="mt-6 grid max-w-[1120px] gap-4 sm:grid-cols-2 lebar:grid-cols-3">
        <article
          aria-labelledby="kartu-stok-menipis"
          className="flex flex-col gap-2 rounded-[20px] bg-permukaan p-4 shadow-bayang"
        >
          <h2 id="kartu-stok-menipis" className="text-sm font-bold">
            Varian stok menipis
          </h2>
          <p className="text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
            {stokMenipis.varian.length}
          </p>
          <p className="text-[13px] text-tinta-redup">
            Varian aktif dengan Stok Varian {stokMenipis.ambang} atau kurang,
            sesuai Ambang stok menipis di Pengaturan toko.
          </p>
        </article>
      </div>

      <section
        aria-labelledby="judul-stok-menipis"
        className="mt-8 max-w-[720px]"
      >
        <h2 id="judul-stok-menipis" className={KELAS_JUDUL_PANEL}>
          Stok menipis
        </h2>
        <DaftarStokMenipis varian={stokMenipis.varian} />
      </section>
    </>
  );
}
