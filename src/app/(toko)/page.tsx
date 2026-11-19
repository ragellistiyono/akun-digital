import { connection } from "next/server";
import { z } from "zod";

import { daftarProdukBeranda } from "@/server/katalog";

import { DeretKategori } from "./_components/deret-kategori";
import { KartuProduk, KartuProdukUnggulan } from "./_components/kartu-produk";
import { KotakCari } from "./_components/kotak-cari";
import { PemandanganSenja } from "./_components/pemandangan-senja";

// Judul bagian (DESIGN.md Typography): spidol 28 px dengan garis bawah bergelombang merah, jarak 32 px di
// atas (antarbagian) dan 16 px di bawah.
const JUDUL_BAGIAN = "garis-gelombang mt-8 mb-4 text-[28px] leading-[1.2]";

const PESAN_KOSONG = "kartu p-6 text-center";

// Kata cari (`?q=`) dan saringan Kategori (`?kategori=`) dari alamat. Nilai yang tidak sah diabaikan.
const saringanAlamat = z.object({
  q: z.string().trim().catch(""),
  kategori: z.uuid().nullable().catch(null),
});

// Beranda (PRD §3.6), dari atas: kotak cari di pita, deret Kategori, bagian Produk Unggulan, lalu
// semua Produk aktif yang bisa disaring per Kategori. Tidak ada banner promo. Selama Pembeli mencari
// atau menyaring, bagian Produk Unggulan disembunyikan dan judul bagian semua Produk berganti, supaya
// yang tampil hanya hasilnya.
export default async function HalamanAwal({ searchParams }: PageProps<"/">) {
  // Katalog dibaca setiap kali Beranda dibuka, bukan sekali saat build.
  await connection();
  const saringan = saringanAlamat.parse(await searchParams);
  const { kategori, kategoriTerpilih, unggulan, semua } =
    await daftarProdukBeranda({
      kataCari: saringan.q,
      kategoriId: saringan.kategori,
    });
  const menyaring = saringan.q !== "" || kategoriTerpilih !== null;

  return (
    <>
      {/* Pita pemandangan Beranda (DESIGN.md), dilukis di atas kertas halaman tanpa latar sendiri. */}
      <div className="relative h-[236px] overflow-hidden lebar:h-80">
        <PemandanganSenja jenis="pita" t={{ terang: 0.16, gelap: 0.82 }} />
        <div className="relative mx-auto max-w-[1184px] px-4 lebar:px-8">
          <KotakCari kataCari={saringan.q} />
        </div>
      </div>
      {/* Wadah isi yang sama dengan halaman dalam: maksimal 1120 px di tengah, padding samping 16/32 px.
          Chip Kategori mulai 24 px di bawah pita (32 px mulai 900 px), termasuk ruang 8 px di atas deret
          chip. Jarak ke footer diatur footer. */}
      <main className="mx-auto max-w-[1184px] px-4 pt-4 lebar:px-8 lebar:pt-6">
        <h1 className="sr-only">MIWE Digital Store</h1>

        <DeretKategori
          kategori={kategori}
          terpilihId={kategoriTerpilih?.id ?? null}
        />

        {!menyaring && unggulan.length > 0 && (
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
            {kategoriTerpilih?.nama ??
              (saringan.q !== "" ? "Hasil pencarian" : "Semua Produk")}
          </h2>
          {semua.length > 0 ? (
            // Grid dua kolom dengan celah 16 px di ponsel, empat kolom dengan celah 24 px mulai 900 px
            // (DESIGN.md Layout). Kartu dimiringkan 1° bergantian seperti kertas yang ditempel tangan.
            <ul className="grid grid-cols-2 gap-4 lebar:grid-cols-4 lebar:gap-6">
              {semua.map((kartu) => (
                <li key={kartu.id} className="odd:-rotate-1 even:rotate-1">
                  <KartuProduk kartu={kartu} />
                </li>
              ))}
            </ul>
          ) : saringan.q !== "" ? (
            <div className={PESAN_KOSONG}>
              <p className="font-spidol text-[22px] leading-[1.2] font-bold [overflow-wrap:anywhere]">
                Produk &quot;{saringan.q}&quot; belum ada
              </p>
              <p className="mt-2 text-pensil-redup">
                Coba nama lain, atau lihat semua Kategori.
              </p>
            </div>
          ) : (
            <p className={`${PESAN_KOSONG} text-pensil-redup`}>
              Belum ada Produk yang dijual saat ini.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
