import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { bacaSesiMember } from "@/server/auth/sesi-member";
import { bacaCheckout } from "@/server/pesanan";

import { FormCheckout } from "./_components/form-checkout";

// Form checkout (PRD §5.2) untuk Varian yang dipilih di Halaman Produk (`/checkout?varianId=…`). Varian
// yang tidak bisa dibeli (PRD §3.7) menampilkan halaman tidak ditemukan. Bila Member sedang login,
// isian emailnya sudah terisi email Member dan tidak bisa diubah.
export default async function HalamanCheckout({
  searchParams,
}: PageProps<"/checkout">) {
  // Harga jual dan status aktif dibaca setiap kali halaman dibuka, bukan sekali saat build.
  await connection();
  const varianId = z.uuid().safeParse((await searchParams).varianId);
  if (!varianId.success) notFound();

  const [checkout, sesiMember] = await Promise.all([
    bacaCheckout(varianId.data),
    bacaSesiMember(await headers()),
  ]);
  if (!checkout) notFound();

  return (
    <>
      <h1 className="mt-4">Checkout</h1>
      <FormCheckout
        checkout={checkout}
        emailMember={sesiMember?.user.email ?? null}
      />
    </>
  );
}
