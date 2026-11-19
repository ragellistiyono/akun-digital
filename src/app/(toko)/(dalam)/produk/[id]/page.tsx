import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";
import type { HalamanProduk as IsiHalamanProduk } from "@/server/katalog";
import { bacaHalamanProduk } from "@/server/katalog";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { alamatSaringanKategori } from "../../../_components/alamat-saringan-kategori";
import { FormBeli } from "../../../_components/form-beli";
import {
  HargaNormal,
  LabelHabis,
  LabelHemat,
} from "../../../_components/kartu-produk";
import { PilihanVarian } from "../../../_components/pilihan-varian";
import { TombolWhatsApp } from "../../../_components/tombol-whatsapp";

// Panel (DESIGN.md "Cards / Containers") dengan teks panjang (Typography): ukuran isi 18 px, tinggi baris
// 1,5, lebar maksimal 65ch. Baris baru yang ditulis Admin tetap tampil sebagai baris baru. Padding panel
// 16 px, dan 24 px di layar lebar yang kolomnya lebih lapang.
const PANEL = "kartu p-4 lebar:p-6";
const TEKS_PANJANG =
  "max-w-[65ch] leading-[1.5] whitespace-pre-line [overflow-wrap:anywhere]";

/**
 * Foto Produk menurut urutannya, paling banyak 5 (PRD §3.3): foto pertama besar bertepi coretan, sedikit
 * miring dan "ditempel" selotip, lalu foto lainnya berderet di bawahnya dengan miring bergantian. Produk
 * tanpa foto mendapat petak `kertas-lama` berisi huruf awal namanya (DESIGN.md "Foto Produk").
 *
 * Di layar lebar kolom foto lekat di bawah bilah atas (`top-24`), karena kolom isinya hampir selalu lebih
 * panjang: foto tetap terlihat di samping Varian, deskripsi, dan garansi selama halaman digulir, sehingga
 * tidak ada ruang kosong panjang di bawah foto.
 */
function FotoProduk({ nama, foto }: { nama: string; foto: string[] }) {
  const [pertama, ...lainnya] = foto;
  const alt = (i: number) => `${nama}, foto ${i + 1} dari ${foto.length}`;

  return (
    <div className="min-w-0 lebar:sticky lebar:top-24">
      {/* Selotip dilukis di atas foto (z-10), karena bingkai foto juga elemen berposisi. */}
      <div className="selotip relative -rotate-1 before:z-10">
        <div className="relative h-[220px] overflow-hidden rounded-coret-md border-2 border-pensil bg-kertas-lama shadow-coret lebar:h-[420px]">
          {pertama ? (
            <Image
              unoptimized
              loading="eager"
              src={pertama}
              alt={alt(0)}
              width={560}
              height={420}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center font-spidol text-[96px] leading-none font-bold text-pensil-redup"
            >
              {nama.slice(0, 1)}
            </span>
          )}
        </div>
      </div>
      {lainnya.length > 0 && (
        <ul className="mt-4 grid grid-cols-4 gap-3">
          {lainnya.map((alamat, i) => (
            <li
              key={alamat}
              className="relative aspect-square overflow-hidden rounded-coret-alt border-2 border-pensil bg-kertas-lama odd:rotate-1 even:-rotate-1"
            >
              <Image
                unoptimized
                src={alamat}
                alt={alt(i + 1)}
                width={140}
                height={140}
                className="absolute inset-0 size-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Harga Produk dengan satu Varian aktif, yang tidak menampilkan pilihan Varian (PRD §3.2, DESIGN.md
 * "Pilihan Varian"): Harga jual spidol tebal 28 px beserta Harga normal yang dicoret dan label Hemat, lalu
 * "Stok N" atau label Habis (PRD §3.4, §3.5).
 */
function HargaSatuVarian({
  varian,
}: {
  varian: IsiHalamanProduk["varian"][number];
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-spidol text-[28px] leading-[1.15] font-bold whitespace-nowrap">
          {rupiah(varian.hargaJual)}
        </p>
        {varian.hargaNormal !== null && (
          <HargaNormal nilai={varian.hargaNormal} />
        )}
        {varian.persenHemat !== null && (
          <LabelHemat persen={varian.persenHemat} />
        )}
      </div>
      <p className="mt-2 text-[15px] text-pensil-redup">
        {varian.habis ? <LabelHabis /> : `Stok ${varian.stokVarian}`}
      </p>
    </div>
  );
}

// Halaman Produk (PRD §3.3): nama dan Kategori, foto, Varian, deskripsi, lalu ketentuan garansi beserta
// tombol WhatsApp, dan tombol utama yang membuka form checkout untuk Varian terpilih. Di layar lebar foto
// dan isinya menjadi dua kolom sama lebar (DESIGN.md "Tata letak halaman", pola Dua kolom), dengan judul
// di kolom isi sejajar tepi atas foto. Produk yang tidak tampil di toko menampilkan halaman tidak
// ditemukan.
export default async function HalamanProduk({
  params,
}: PageProps<"/produk/[id]">) {
  // Stok Varian dan nomor WhatsApp dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [produk, { nomorWhatsapp }] = await Promise.all([
    bacaHalamanProduk(id.data),
    bacaPengaturanToko(),
  ]);
  if (!produk) notFound();
  // Varian ber-stok pertama sudah terpilih saat halaman dibuka.
  const terpilihAwal = produk.varian.find((v) => !v.habis)?.id ?? null;

  return (
    <div className="tata-dua-kolom mt-4">
      <FotoProduk nama={produk.nama} foto={produk.foto} />

      <div className="min-w-0">
        <h1 className="[overflow-wrap:anywhere]">{produk.nama}</h1>
        <p className="mt-3 flex">
          {/* Nama Kategori boleh patah baris, supaya chip tidak melebar melewati layar 360 px. */}
          <Link
            href={alamatSaringanKategori(produk.kategori.id)}
            className="chip min-w-0 py-1 whitespace-normal [overflow-wrap:anywhere]"
          >
            {produk.kategori.nama}
          </Link>
        </p>

        <FormBeli
          varian={produk.varian.map(({ id, hargaJual, habis }) => ({
            id,
            hargaJual,
            habis,
          }))}
          terpilihAwal={terpilihAwal}
        >
          {produk.pilihanVarian ? (
            <>
              <h2
                id="judul-pilih-varian"
                className="mt-6 mb-4 text-[26px] leading-[1.2]"
              >
                Pilih Varian
              </h2>
              <PilihanVarian
                varian={produk.varian}
                terpilihId={terpilihAwal}
                labelledBy="judul-pilih-varian"
              />
            </>
          ) : (
            <>
              <HargaSatuVarian varian={produk.varian[0]} />
              <input
                type="hidden"
                name="varianId"
                value={produk.varian[0].id}
              />
            </>
          )}

          <section aria-label="Deskripsi" className={`mt-6 ${PANEL}`}>
            <p className={TEKS_PANJANG}>{produk.deskripsi}</p>
          </section>
          <section
            aria-label="Ketentuan garansi"
            className={`mt-4 flex flex-col items-start gap-4 ${PANEL}`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-coret-bulat border-2 border-pensil"
              >
                <ShieldCheck
                  aria-hidden="true"
                  strokeWidth={2.5}
                  className="size-6 text-st-selesai"
                />
              </span>
              <p className={`min-w-0 ${TEKS_PANJANG}`}>
                {produk.ketentuanGaransi}
              </p>
            </div>
            <TombolWhatsApp nomor={nomorWhatsapp}>
              Tanya lewat WhatsApp
            </TombolWhatsApp>
          </section>
        </FormBeli>
      </div>
    </div>
  );
}
