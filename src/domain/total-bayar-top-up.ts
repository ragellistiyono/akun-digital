// Total bayar dan Kode unik sebuah Top up (PRD §15.3, ADR-0004).

type HasilPeriksaTagihanQrisTopUp =
  | {
      cocok: true;
      rincian: { nominalTopUp: number; kodeUnik: number; totalBayar: number };
    }
  | {
      cocok: false;
      alasan: "requested-amount-tidak-cocok" | "amount-tidak-cocok";
    };

/**
 * Memeriksa nominal QRIS Top up yang diterbitkan Qrispy (PRD §15.3, ADR-0004). Toko mengirim Nominal top up, dan
 * Qrispy menambahkan Kode unik (`uniqueId`). Total bayar Top up = Nominal top up + Kode unik, dan harus sama dengan
 * `amount`. QRIS ditolak bila `requestedAmount` bukan Nominal top up, atau `amount` bukan Total bayar itu. Bila
 * cocok, hasilnya membawa rincian Nominal top up, Kode unik, dan Total bayar.
 */
export function periksaTagihanQrisTopUp({
  nominalTopUp,
  requestedAmount,
  uniqueId,
  amount,
}: {
  nominalTopUp: number;
  requestedAmount: number;
  uniqueId: number;
  amount: number;
}): HasilPeriksaTagihanQrisTopUp {
  if (requestedAmount !== nominalTopUp) {
    return { cocok: false, alasan: "requested-amount-tidak-cocok" };
  }
  const totalBayar = nominalTopUp + uniqueId;
  if (amount !== totalBayar) {
    return { cocok: false, alasan: "amount-tidak-cocok" };
  }
  return {
    cocok: true,
    rincian: { nominalTopUp, kodeUnik: uniqueId, totalBayar },
  };
}
