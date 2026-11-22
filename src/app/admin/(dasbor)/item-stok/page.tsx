import { headers } from "next/headers";
import type { ReactNode } from "react";
import { z } from "zod";

import { PEMISAH_KOLOM } from "@/domain/item-stok";
import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { daftarVarianItemStok } from "@/server/item-stok";

import { TempelItemStok } from "../produk/_components/item-stok-varian";
import { DaftarVarian } from "./_components/daftar-varian";
import { PilihanVarian } from "./_components/pilihan-varian";

// Varian terpilih dari alamat. Nilai yang tidak sah diabaikan, jadi belum ada Varian yang terpilih.
const PilihanAlamat = z.object({
  varian: z.uuid().optional().catch(undefined),
});

/** Panel `kartu` dengan judul bagian (DESIGN.md Cards / Containers). */
function Panel({
  id,
  judul,
  children,
}: {
  id: string;
  judul: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-judul`}
      className="kartu flex flex-col gap-4 p-4 sm:p-6"
    >
      <h2 id={`${id}-judul`} className="text-[26px]">
        {judul}
      </h2>
      {children}
    </section>
  );
}

// Menu Item stok di dasbor admin (PRD §4.2 ▶ Keputusan 2026-11-20): pilihan Varian, keterangan Varian terpilih,
// kotak tempel yang sama dengan halaman Varian, dan daftar semua Varian. Varian terpilih dibaca dari alamat
// (?varian=<id>), jadi pilihan Varian dan baris daftar sama-sama membuka alamat itu. Form satu Item stok tetap
// hanya ada di halaman Varian.
//
// Tata letak (DESIGN.md Tata letak halaman, dasbor admin), sama seperti halaman Varian: di bawah 1200 px semua
// panel satu kolom 720 px di tengah. Mulai 1200 px pilihan, keterangan, dan kotak tempel di kolom kiri, daftar
// Varian di kolom kanan.
export default async function HalamanItemStok({
  searchParams,
}: PageProps<"/admin/item-stok">) {
  await wajibSesiAdmin(await headers());

  const { varian: varianId } = PilihanAlamat.parse(await searchParams);
  const semuaVarian = await daftarVarianItemStok();
  const terpilih = semuaVarian.find((v) => v.varianId === varianId);

  const semuaProduk = new Map<
    string,
    Parameters<typeof PilihanVarian>[0]["semuaProduk"][number]
  >();
  for (const v of semuaVarian) {
    const produk = semuaProduk.get(v.produkId) ?? {
      id: v.produkId,
      nama: v.namaProduk,
      aktif: v.produkAktif,
      varian: [],
    };
    produk.varian.push({
      id: v.varianId,
      nama: v.namaVarian,
      aktif: v.varianAktif,
    });
    semuaProduk.set(v.produkId, produk);
  }

  return (
    <div className="tata-baca min-[1200px]:max-w-none">
      <h1 className="mb-6">Item stok</h1>

      <div className="flex flex-col gap-6 min-[1200px]:grid min-[1200px]:grid-cols-2 min-[1200px]:items-start min-[1200px]:gap-8">
        <div className="min-w-0 space-y-6">
          <Panel id="pilih-varian" judul="Pilih Varian">
            <PilihanVarian
              key={terpilih?.varianId}
              semuaProduk={[...semuaProduk.values()]}
              produkId={terpilih?.produkId}
              varianId={terpilih?.varianId}
            />
            {!terpilih && (
              <p className="text-base text-pensil-redup">
                Pilih Produk lalu Variannya, atau ketuk sebuah baris di daftar
                Varian, untuk mengisi Item stok Varian itu.
              </p>
            )}
          </Panel>

          {terpilih && (
            <>
              <Panel id="varian-terpilih" judul="Varian terpilih">
                <p className="break-words">
                  {terpilih.namaProduk}
                  <span className="block text-[15px] text-pensil-redup">
                    {terpilih.namaVarian}
                  </span>
                </p>
                <dl className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <dt className="text-base text-pensil-redup">
                      Format Item stok
                    </dt>
                    <dd>
                      <ol
                        aria-label="Format Item stok"
                        className="flex flex-wrap gap-2"
                      >
                        {terpilih.formatItemStok.map((kolom, i) => (
                          <li
                            key={`${i}-${kolom}`}
                            className="rounded-coret border-2 border-dashed border-pensil px-2 py-0.5"
                          >
                            {kolom}
                          </li>
                        ))}
                      </ol>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-base text-pensil-redup">
                      Contoh satu baris tempelan
                    </dt>
                    <dd className="font-mono text-[15px] font-medium [overflow-wrap:anywhere]">
                      {terpilih.formatItemStok.join(PEMISAH_KOLOM)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-base text-pensil-redup">Stok Varian</dt>
                    <dd className="flex flex-col gap-1">
                      <span className="font-spidol text-[40px] leading-none font-bold">
                        {terpilih.stok.stokVarian}
                      </span>
                      <span className="text-base text-pensil-redup">
                        Jumlah Item stok yang Tersedia. Item stok Ditahan (
                        {terpilih.stok.jumlahPerStatus.Ditahan}) dan Terkirim (
                        {terpilih.stok.jumlahPerStatus.Terkirim}) tidak
                        dihitung.
                      </span>
                    </dd>
                  </div>
                </dl>
              </Panel>

              <TempelItemStok
                key={terpilih.varianId}
                produkId={terpilih.produkId}
                varianId={terpilih.varianId}
                kolom={terpilih.formatItemStok}
              />
            </>
          )}
        </div>

        <div className="min-w-0">
          <Panel id="daftar-varian" judul="Daftar Varian">
            <DaftarVarian
              varianTerpilih={terpilih?.varianId}
              varian={semuaVarian.map((v) => ({
                produkId: v.produkId,
                varianId: v.varianId,
                namaVarian: v.namaVarian,
                namaProduk: v.namaProduk,
                varianAktif: v.varianAktif,
                produkAktif: v.produkAktif,
                jumlahPerStatus: v.stok.jumlahPerStatus,
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
