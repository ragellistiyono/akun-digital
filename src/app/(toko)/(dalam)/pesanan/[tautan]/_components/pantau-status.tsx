"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import * as z from "zod/mini";

/** Jeda antara dua pertanyaan status ke server toko. Tiga pertanyaan muat dalam satu giliran cek 15 detik. */
const JEDA_TANYA_STATUS_MS = 5_000;

const JawabanStatus = z.object({ status: z.string() });

/**
 * Pemantau status di Halaman bayar Pesanan dan Halaman bayar Top up (PRD §5.6, §15.3, ADR-0004): menanyakan status ke
 * server toko di `alamatStatus` setiap 5 detik. Begitu statusnya berbeda dari status yang sedang ditampilkan, halaman
 * dibuat ulang di server tanpa dimuat ulang, sehingga tampilan berpindah sendiri. Pertanyaan yang gagal diabaikan dan
 * diulang di giliran berikutnya. Tidak menampilkan apa pun.
 */
export function PantauStatus({
  alamatStatus,
  status,
}: {
  alamatStatus: string;
  status: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const tanya = async () => {
      try {
        const respons = await fetch(alamatStatus, { cache: "no-store" });
        if (!respons.ok) return;
        const jawaban = JawabanStatus.safeParse(await respons.json());
        if (jawaban.success && jawaban.data.status !== status) {
          router.refresh();
        }
      } catch {
        // Jaringan terputus atau jawabannya bukan JSON: status ditanyakan lagi di giliran berikutnya.
      }
    };
    const jam = setInterval(tanya, JEDA_TANYA_STATUS_MS);
    return () => clearInterval(jam);
  }, [alamatStatus, status, router]);

  return null;
}
