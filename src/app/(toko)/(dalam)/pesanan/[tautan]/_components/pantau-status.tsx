"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import * as z from "zod/mini";

import { STATUS_PESANAN, type StatusPesanan } from "@/domain/status-pesanan";

/** Jeda antara dua pertanyaan status ke server toko. Tiga pertanyaan muat dalam satu giliran cek 15 detik. */
const JEDA_TANYA_STATUS_MS = 5_000;

const JawabanStatus = z.object({ status: z.enum(STATUS_PESANAN) });

/**
 * Pemantau status Pesanan di Halaman bayar (PRD §5.6, ADR-0004): menanyakan status ke server toko setiap
 * 5 detik. Begitu statusnya berbeda dari status yang sedang ditampilkan, halaman dibuat ulang di server
 * tanpa dimuat ulang, sehingga tampilan berpindah ke Halaman Pesanan. Pertanyaan yang gagal diabaikan dan
 * diulang di giliran berikutnya. Tidak menampilkan apa pun.
 */
export function PantauStatusPesanan({
  tautan,
  status,
}: {
  tautan: string;
  status: StatusPesanan;
}) {
  const router = useRouter();

  useEffect(() => {
    const tanya = async () => {
      try {
        const respons = await fetch(`/pesanan/${tautan}/status`, {
          cache: "no-store",
        });
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
  }, [tautan, status, router]);

  return null;
}
