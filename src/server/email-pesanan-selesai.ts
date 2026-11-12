// Email "Pesanan selesai" (PRD §6.3, §10.2): Item stok, rincian nominal (PRD §5.5), dan Tautan Pesanan
// (PRD §6.2) sebuah Pesanan Selesai, dikirim lewat adaptor email dari pekerjaan latar di
// pekerjaan-latar.ts. Isinya dibaca seperti Halaman Pesanan, lewat bacaPesananLewatTautan.
import { eq } from "drizzle-orm";
import { z } from "zod";

import { rupiah } from "@/lib/rupiah";

import { db } from "./db";
import { pesanan } from "./db/schema";
import { pengirimEmailAktif, type Email, type PengirimEmail } from "./email";
import { bacaPengaturanToko } from "./pengaturan-toko";
import { bacaPesananLewatTautan } from "./pesanan";

type PesananSelesai = NonNullable<
  Awaited<ReturnType<typeof bacaPesananLewatTautan>>
>;

/** Bahan isi email "Pesanan selesai". */
type BahanEmailPesananSelesai = Pick<
  PesananSelesai,
  "nomorPesanan" | "namaProduk" | "namaVarian" | "rincian"
> & {
  dari: string;
  kepada: string;
  itemStok: NonNullable<PesananSelesai["itemStok"]>;
  /** Tautan Pesanan sebagai alamat lengkap. */
  alamatPesanan: string;
  /** Nomor WhatsApp dari Pengaturan toko (PRD §9.8), atau null bila belum diisi. */
  nomorWhatsapp: string | null;
};

/** Teks yang aman ditaruh di HTML. */
const aman = (teks: string) =>
  teks
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Baris rincian nominal (PRD §5.5), dengan tulisan yang sama seperti di Halaman Pesanan. */
function barisRincian({
  hargaJual,
  potonganVoucher,
  kodeUnik,
  totalBayar,
}: PesananSelesai["rincian"]) {
  return [
    { label: "Harga jual", nilai: rupiah(hargaJual) },
    {
      label: "Potongan voucher",
      nilai: potonganVoucher === 0 ? rupiah(0) : `− ${rupiah(potonganVoucher)}`,
    },
    { label: "Kode unik", nilai: rupiah(kodeUnik) },
    { label: "Total bayar", nilai: rupiah(totalBayar) },
  ];
}

/**
 * Isi email "Pesanan selesai" dalam bahasa Indonesia, sebagai teks biasa dan HTML. HTML-nya tanpa warna:
 * aplikasi email tidak bisa memakai token warna DESIGN.md, dan hex mentah hanya boleh ada di pelukis
 * pemandangan, jadi email memakai warna bawaan aplikasi email. Footer WhatsApp
 * (PRD §10.2) membuka https://wa.me/<nomor> seperti tombol WhatsApp di web, dan seperti tombol itu tidak
 * ada selama nomor WhatsApp belum diisi (PRD §9.8).
 */
function isiEmailPesananSelesai(bahan: BahanEmailPesananSelesai): Email {
  const pembuka = `Pembayaran Pesanan ${bahan.nomorPesanan} sudah kami terima. Berikut Item stok Anda.`;
  const produk = `${bahan.namaProduk} · ${bahan.namaVarian}`;
  const keteranganTautan =
    "Buka Pesanan ini kapan saja tanpa login lewat Tautan Pesanan berikut:";
  const rincian = barisRincian(bahan.rincian);
  const whatsapp = bahan.nomorWhatsapp && {
    label: `WhatsApp +${bahan.nomorWhatsapp}`,
    alamat: `https://wa.me/${bahan.nomorWhatsapp}`,
  };
  const bantuan = "Butuh bantuan? Hubungi kami di";

  const teks = [
    "Pesanan selesai",
    "",
    pembuka,
    "",
    produk,
    "",
    "Item stok Anda",
    ...bahan.itemStok.map(({ nama, nilai }) => `${nama}: ${nilai}`),
    "",
    "Rincian pembayaran",
    ...rincian.map(({ label, nilai }) => `${label}: ${nilai}`),
    "",
    keteranganTautan,
    bahan.alamatPesanan,
    ...(whatsapp
      ? ["", `${bantuan} ${whatsapp.label} (${whatsapp.alamat})`]
      : []),
  ].join("\n");

  const html = [
    `<div style="font-family:Manrope,system-ui,sans-serif;font-size:15px;line-height:1.5">`,
    `<h1 style="font-size:22px;margin:0 0 16px">Pesanan selesai</h1>`,
    `<p style="margin:0 0 16px">${aman(pembuka)}</p>`,
    `<p style="margin:0 0 16px;font-weight:bold">${aman(produk)}</p>`,
    `<h2 style="font-size:17px;margin:0 0 8px">Item stok Anda</h2>`,
    `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">`,
    ...bahan.itemStok.map(
      ({ nama, nilai }) =>
        `<tr><td style="padding:4px 16px 4px 0">${aman(nama)}</td><td style="padding:4px 0;font-family:'JetBrains Mono',ui-monospace,monospace">${aman(nilai)}</td></tr>`,
    ),
    `</table>`,
    `<h2 style="font-size:17px;margin:0 0 8px">Rincian pembayaran</h2>`,
    `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">`,
    ...rincian.map(
      ({ label, nilai }) =>
        `<tr><td style="padding:4px 16px 4px 0">${aman(label)}</td><td style="padding:4px 0;text-align:right">${aman(nilai)}</td></tr>`,
    ),
    `</table>`,
    `<p style="margin:0 0 4px">${aman(keteranganTautan)}</p>`,
    `<p style="margin:0 0 16px"><a href="${aman(bahan.alamatPesanan)}" style="word-break:break-all">${aman(bahan.alamatPesanan)}</a></p>`,
    ...(whatsapp
      ? [
          `<hr style="margin:24px 0 16px">`,
          `<p style="margin:0">${aman(bantuan)} <a href="${aman(whatsapp.alamat)}">${aman(whatsapp.label)}</a></p>`,
        ]
      : []),
    `</div>`,
  ].join("\n");

  return {
    dari: bahan.dari,
    kepada: bahan.kepada,
    subjek: `Pesanan selesai: ${bahan.nomorPesanan}`,
    teks,
    html,
  };
}

/** Variabel lingkungan wajib yang dibaca saat dipakai, bukan saat modul dimuat, supaya `next build` tidak membutuhkannya. */
function bacaWajib(nama: "EMAIL_FROM" | "APP_URL", contoh: string) {
  const nilai = process.env[nama]?.trim() ?? "";
  if (nilai === "") {
    throw new Error(
      `${nama} kosong, jadi email "Pesanan selesai" tidak bisa dikirim. Isi ${nama} di berkas .env, misalnya ${contoh}, lalu jalankan ulang aplikasinya.`,
    );
  }
  return nilai;
}

const AlamatToko = z.url({ protocol: /^https?$/ });

/** Tautan Pesanan sebagai alamat lengkap di APP_URL, yaitu alamat Halaman Pesanan-nya. */
function alamatTautanPesanan(tautan: string) {
  const alamatToko = bacaWajib("APP_URL", "https://miwe.example");
  if (!AlamatToko.safeParse(alamatToko).success) {
    throw new Error(
      `APP_URL bernilai "${alamatToko}", padahal harus alamat http atau https, jadi Tautan Pesanan tidak bisa dibuat. Perbaiki APP_URL di berkas .env, misalnya https://miwe.example, lalu jalankan ulang aplikasinya.`,
    );
  }
  return `${alamatToko.replace(/\/+$/, "")}/pesanan/${tautan}`;
}

/**
 * Mengirim email "Pesanan selesai" untuk Pesanan itu ke email Pesanan-nya, lewat adaptor email. Pengirimnya
 * EMAIL_FROM, Tautan Pesanan-nya berada di APP_URL, dan nomor WhatsApp di footer dibaca dari Pengaturan
 * toko saat email dikirim. Setelah email terkirim, tanda "Email gagal" Pesanan itu dihapus (PRD §6.4).
 * Setiap kegagalan, termasuk adaptor email yang gagal, dilempar.
 *
 * Adaptor email bisa diganti untuk test.
 */
export async function kirimEmailPesananSelesai(
  pesananId: string,
  { pengirim = pengirimEmailAktif() }: { pengirim?: PengirimEmail } = {},
) {
  const dari = bacaWajib(
    "EMAIL_FROM",
    "MIWE Digital Store <no-reply@miwe.example>",
  );
  const [baris] = await db
    .select({ email: pesanan.email, tautan: pesanan.tautan })
    .from(pesanan)
    .where(eq(pesanan.id, pesananId));
  const dibaca = baris && (await bacaPesananLewatTautan(baris.tautan));
  if (!dibaca?.itemStok) {
    throw new Error(
      `Email "Pesanan selesai" untuk Pesanan ${pesananId} tidak dikirim, karena Pesanan itu tidak ada atau tidak Selesai, padahal email ini hanya dijadwalkan saat Pesanan menjadi Selesai. Periksa status Pesanan itu di database.`,
    );
  }
  const { nomorWhatsapp } = await bacaPengaturanToko();

  await pengirim.kirim(
    isiEmailPesananSelesai({
      ...dibaca,
      itemStok: dibaca.itemStok,
      dari,
      kepada: baris.email,
      alamatPesanan: alamatTautanPesanan(baris.tautan),
      nomorWhatsapp,
    }),
  );
  await db
    .update(pesanan)
    .set({ emailGagal: false })
    .where(eq(pesanan.id, pesananId));
}

/**
 * Memasang tanda "Email gagal" pada Pesanan itu (PRD §6.4), setelah semua percobaan kirim email "Pesanan
 * selesai"-nya gagal. Status Pesanan tidak berubah.
 */
export async function tandaiEmailGagal(pesananId: string) {
  await db
    .update(pesanan)
    .set({ emailGagal: true })
    .where(eq(pesanan.id, pesananId));
}
