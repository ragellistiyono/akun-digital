"use client";

import { useState } from "react";

import { FormKirimUlang } from "./form-kirim-ulang";
import { FormKodeVerifikasi } from "./form-kode-verifikasi";

/**
 * Isian Kode verifikasi beserta "Kirim ulang kode" (PRD §7.3, §7.7). Begitu kode baru berhasil dikirim,
 * isian kode dipasang ulang, sehingga pesan penolakan kode sebelumnya langsung hilang
 * (PRD §7.3 ▶ Keputusan 2026-11-17).
 */
export function VerifikasiKode() {
  const [kirimanKode, setKirimanKode] = useState(0);

  return (
    <>
      <FormKodeVerifikasi key={kirimanKode} />
      <FormKirimUlang onTerkirim={() => setKirimanKode((n) => n + 1)} />
    </>
  );
}
