import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaCheckout } from "@/server/pesanan";

import { FormAmbilGratis } from "./_components/form-ambil-gratis";
import { FormCheckout } from "./_components/form-checkout";

// Form checkout (PRD §5.2) untuk Varian yang dipilih di Halaman Produk (`/checkout?varianId=…`). Varian
// yang tidak bisa dibeli (PRD §3.7) menampilkan halaman tidak ditemukan. Bila Member sedang login,
// isian emailnya sudah terisi email Member dan tidak bisa diubah, dan ia bisa memilih membayar dengan saldonya
// (PRD §15.7). Tamu melihat pilihan Saldo yang tidak bisa dipilih beserta ajakan Masuk atau Daftar, dan membayar
// dengan QRIS (PRD §15.7 ▶ Keputusan 2026-11-22).
//
// Alamat kembali dari tautan Masuk di pesan Voucher khusus Member membawa kode voucher yang tadi diketik
// (`&kodeVoucher=…`), supaya isian kode sudah berisi kode itu setelah login (PRD §8.7 ▶ Keputusan 2026-11-17).
// Kodenya hanya mengisi isian. Voucher baru diperiksa saat "Pakai" ditekan atau saat Pesanan dibuat.
//
// Member yang membuka Checkout Produk gratis melihat Checkout Produk gratis dengan Sisa jatah-nya, tanpa isian kode
// voucher dan pilihan Metode (PRD §16.3). Checkout Produk gratis untuk Tamu belum dibuat di sini (T87), jadi Tamu
// masih melihat form checkout biasa; Admin belum bisa menjadikan Produk gratis sampai saat itu (PRD §13 ▶ Keputusan
// 2026-11-22).
export default async function HalamanCheckout({
  searchParams,
}: PageProps<"/checkout">) {
  // Harga jual dan status aktif dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const parameter = await searchParams;
  const varianId = z.uuid().safeParse(parameter.varianId);
  if (!varianId.success) notFound();
  const kodeVoucher = z.string().catch("").parse(parameter.kodeVoucher);

  const sesiMember = await bacaSesiMember(await headers());
  const checkout = await bacaCheckout(varianId.data, {
    idMember: sesiMember?.user.id ?? null,
  });
  if (!checkout) notFound();

  return (
    <>
      <h1 className="mt-4">Checkout</h1>
      {checkout.jatah && sesiMember ? (
        <FormAmbilGratis
          checkout={checkout}
          jatah={checkout.jatah}
          emailMember={sesiMember.user.email}
        />
      ) : (
        <FormCheckout
          checkout={checkout}
          emailMember={sesiMember?.user.email ?? null}
          kodeVoucher={kodeVoucher}
        />
      )}
    </>
  );
}
