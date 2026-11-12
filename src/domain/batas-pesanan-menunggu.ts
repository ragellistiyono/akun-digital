// Batas Pesanan menunggu (PRD §5.4). Kesamaan email ditentukan emailBaku di kesamaan-email.ts (§7.4).
import { emailBaku } from "./kesamaan-email";
import type { StatusPesanan } from "./status-pesanan";

type PesananLain = { email: string; status: StatusPesanan };

export type HasilBatasPesananMenunggu<P> =
  { boleh: true } | { boleh: false; pesananMenunggu: P };

/**
 * Apakah email itu boleh membuat Pesanan baru (PRD §5.4): satu email hanya boleh punya 1 Pesanan Menunggu
 * Pembayaran. Pesanan lain dengan email yang sama menurut §7.4 dan berstatus Menunggu Pembayaran membuat
 * checkout tidak boleh; Pesanan yang sudah Kedaluwarsa, Dibatalkan, atau Selesai tidak menghalangi. Bila
 * tidak boleh, hasilnya membawa Pesanan yang menghalangi itu.
 */
export function batasPesananMenunggu<P extends PesananLain>({
  email,
  pesananLain,
}: {
  email: string;
  pesananLain: readonly P[];
}): HasilBatasPesananMenunggu<P> {
  const dicari = emailBaku(email);
  const pesananMenunggu = pesananLain.find(
    (p) => p.status === "Menunggu Pembayaran" && emailBaku(p.email) === dicari,
  );
  return pesananMenunggu ? { boleh: false, pesananMenunggu } : { boleh: true };
}
