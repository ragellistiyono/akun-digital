"use client";

import { useState } from "react";

import { FormKirimUlang } from "./form-kirim-ulang";
import { FormKodeVerifikasi } from "./form-kode-verifikasi";

/**
 * Isian Kode verifikasi beserta "Kirim ulang kode" (PRD §7.3, §7.7). Begitu kode baru berhasil dikirim,
 * isian kode dipasang ulang, sehingga pesan penolakan kode sebelumnya langsung hilang
 * (PRD §7.3 ▶ Keputusan 2026-11-17). Keduanya membawa `tujuan` setelah verifikasi, atau null
 * (PRD §7.3 ▶ Keputusan 2026-11-22).
 */
export function VerifikasiKode({ tujuan }: { tujuan: string | null }) {
  const [kirimanKode, setKirimanKode] = useState(0);

  return (
    <>
      <FormKodeVerifikasi key={kirimanKode} tujuan={tujuan} />
      <FormKirimUlang
        tujuan={tujuan}
        onTerkirim={() => setKirimanKode((n) => n + 1)}
      />
    </>
  );
}
