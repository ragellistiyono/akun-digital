import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { bacaSesiMember } from "@/server/auth/sesi-member";

import { PARAMETER_ALAMAT_KEMBALI } from "../../masuk/alamat-kembali";
import { FormTopUp } from "./_components/form-top-up";

const ALAMAT = "/akun/top-up";

// Halaman Top up (PRD §15.3): isian Nominal top up, tombol cepat, dan "Bayar dengan QRIS". Hanya untuk Member yang
// login: Tamu diarahkan ke halaman Masuk, lalu kembali ke sini setelah login. Halaman ini dibuka dari tombol "Top up"
// di tab Akun (PRD §15.10). Tata letaknya pola Fokus, seperti tab Akun (DESIGN.md Tata letak halaman).
export default async function HalamanTopUp() {
  const sesiMember = await bacaSesiMember(await headers());
  if (!sesiMember) {
    redirect(
      `/masuk?${new URLSearchParams({ [PARAMETER_ALAMAT_KEMBALI]: ALAMAT })}`,
    );
  }

  return (
    <div className="tata-fokus">
      <Link
        href="/akun"
        className="mt-4 inline-flex h-10 items-center gap-1 pr-3 text-[17px] text-pulpen decoration-2 underline-offset-4 hover:underline"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-6 shrink-0"
          strokeWidth={2.5}
        />
        Akun
      </Link>
      <h1 className="mt-2">Top up</h1>
      <div className="mt-6">
        <FormTopUp />
      </div>
    </div>
  );
}
