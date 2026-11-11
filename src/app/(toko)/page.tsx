import { connection } from "next/server";

import { daftarProdukBeranda } from "@/server/katalog";

import { KartuProduk, KartuProdukUnggulan } from "./_components/kartu-produk";
import { PemandanganSenja } from "./_components/pemandangan-senja";

// Judul bagian (DESIGN.md Typography, Title): 22 px, jarak 32 px di atas dan 16 px di bawah.
const JUDUL_BAGIAN =
  "mt-8 mb-4 text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]";

// Beranda (PRD §3.6): pita langit, bagian Produk Unggulan, lalu semua Produk aktif. Tidak ada banner
// promo. Kotak cari dan deret Kategori ditambahkan T12 di atas kedua bagian ini.
export default async function HalamanAwal() {
  // Katalog dibaca setiap kali Beranda dibuka, bukan sekali saat build.
  await connection();
  const { unggulan, semua } = await daftarProdukBeranda();

  return (
    <>
      {/* Pita langit Beranda (DESIGN.md): senja keemasan di mode terang, senja akhir berbintang di mode gelap. */}
      <div className="relative h-[236px] overflow-hidden bg-langit lebar:h-80">
        <PemandanganSenja jenis="pita" t={{ terang: 0.16, gelap: 0.82 }} />
      </div>
      <main className="mx-auto max-w-[1120px] px-4 pt-2 pb-28 lebar:pb-16">
        <h1 className="sr-only">MIWE Digital Store</h1>

        {unggulan.length > 0 && (
          <section aria-labelledby="judul-unggulan">
            <h2 id="judul-unggulan" className={JUDUL_BAGIAN}>
              Produk Unggulan
            </h2>
            <ul className="grid gap-4 lebar:gap-6">
              {unggulan.map((kartu) => (
                <li key={kartu.id}>
                  <KartuProdukUnggulan kartu={kartu} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="judul-semua">
          <h2 id="judul-semua" className={JUDUL_BAGIAN}>
            Semua Produk
          </h2>
          {semua.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 lebar:grid-cols-4 lebar:gap-6">
              {semua.map((kartu) => (
                <li key={kartu.id}>
                  <KartuProduk kartu={kartu} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[20px] bg-permukaan p-6 text-center text-tinta-redup shadow-bayang">
              Belum ada Produk yang dijual saat ini.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
