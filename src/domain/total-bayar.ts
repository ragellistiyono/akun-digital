// Total bayar dan Kode unik sebuah Pesanan (PRD §5.5, ADR-0004).

/**
 * Total bayar sebuah Pesanan: Harga jual − potongan voucher + Kode unik (PRD §5.5). Hasilnya membawa
 * Harga jual, potongan voucher, dan Kode unik sebagai bahan hitungnya, karena ketiganya tampil terpisah
 * di rincian.
 */
export function totalBayar({
  hargaJual,
  potonganVoucher,
  kodeUnik,
}: {
  hargaJual: number;
  potonganVoucher: number;
  kodeUnik: number;
}) {
  return {
    totalBayar: hargaJual - potonganVoucher + kodeUnik,
    hargaJual,
    potonganVoucher,
    kodeUnik,
  };
}

/**
 * Nominal yang dikirim toko ke Qrispy sebagai `amount` saat membuat QRIS: Harga jual − potongan voucher
 * (ADR-0004). Qrispy lalu menambahkan Kode unik. Hasilnya membawa Harga jual dan potongan voucher sebagai
 * bahan hitungnya.
 */
export function nominalTagihanQris({
  hargaJual,
  potonganVoucher,
}: {
  hargaJual: number;
  potonganVoucher: number;
}) {
  return { nominal: hargaJual - potonganVoucher, hargaJual, potonganVoucher };
}

type HasilPeriksaTagihanQris =
  | { cocok: true; rincian: ReturnType<typeof totalBayar> }
  | {
      cocok: false;
      alasan: "requested-amount-tidak-cocok" | "amount-tidak-cocok";
    };

/**
 * Memeriksa nominal QRIS yang diterbitkan Qrispy (ADR-0004). Kode unik adalah `uniqueId`, dan Total bayar
 * adalah `amount`. QRIS ditolak bila `requestedAmount` tidak sama dengan nominal yang dikirim toko
 * (nominalTagihanQris), atau `amount` tidak sama dengan Total bayar menurut PRD §5.5 dengan Kode unik itu.
 * Bila cocok, hasilnya membawa rincian Total bayar.
 */
export function periksaTagihanQris({
  hargaJual,
  potonganVoucher,
  requestedAmount,
  uniqueId,
  amount,
}: {
  hargaJual: number;
  potonganVoucher: number;
  requestedAmount: number;
  uniqueId: number;
  amount: number;
}): HasilPeriksaTagihanQris {
  const { nominal } = nominalTagihanQris({ hargaJual, potonganVoucher });
  if (requestedAmount !== nominal) {
    return { cocok: false, alasan: "requested-amount-tidak-cocok" };
  }
  const rincian = totalBayar({
    hargaJual,
    potonganVoucher,
    kodeUnik: uniqueId,
  });
  if (amount !== rincian.totalBayar) {
    return { cocok: false, alasan: "amount-tidak-cocok" };
  }
  return { cocok: true, rincian };
}
