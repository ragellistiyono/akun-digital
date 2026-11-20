// Total Harga modal, Laba kotor, dan Laba bersih dalam suatu rentang (PRD §9.2, §14.2, §14.5).
import { labaKotor } from "./harga-modal";
import { jumlahPesananSelesai } from "./jumlah-pesanan-selesai";
import { pendapatan } from "./pendapatan";
import {
  awalTanggalToko,
  dalamRentang,
  type RentangWaktu,
} from "./rentang-waktu-toko";
import type { StatusPesanan } from "./status-pesanan";

type PesananLaba = {
  status: StatusPesanan;
  dibayarPada: Date | null;
  hargaJual: number;
  potonganVoucher: number;
  kodeUnik: number;
  totalBayar: number;
  hargaModal: number | null;
  biayaTransaksi: number | null;
};

type BiayaOperasionalLaba = { tanggal: string; nominal: number };

const jumlahkan = <T>(daftar: readonly T[], nilai: (t: T) => number) =>
  daftar.reduce((jumlah, t) => jumlah + nilai(t), 0);

/**
 * Angka keuangan dalam rentang itu (PRD §14.2, §14.5, tests/golden/laba.json). Rentang null berarti sepanjang
 * waktu, tanpa batas tanggal.
 *
 * - Pendapatan dan jumlah Pesanan Selesai menghitung semua Pesanan Selesai yang dibayar dalam rentang itu (§9.3).
 * - Total Harga modal, Laba kotor, potongan voucher, Kode unik, dan Biaya transaksi hanya dari Pesanan Selesai
 *   yang punya Harga modal (§14.2). Pesanan Selesai tanpa Harga modal dihitung di `pesananTanpaHargaModal`.
 * - Biaya operasional adalah jumlah biaya yang tanggalnya (00.00 WIB) berada dalam rentang itu. Bila
 *   `denganBiayaOperasional` false, yaitu saat saringan Produk atau Kategori aktif, nilainya null dan tidak
 *   dikurangkan (§14.5).
 * - Laba bersih = Laba kotor − potongan voucher + Kode unik − Biaya transaksi − Biaya operasional (§14.5).
 *
 * Biaya transaksi Pesanan yang sudah dibayar selalu tercatat (§14.3), jadi null pada Pesanan Selesai hanya
 * mungkin di data uji dan dihitung Rp 0. Hasilnya membawa Pesanan yang dihitung, Pesanan tanpa Harga modal,
 * dan Biaya operasional yang dihitung sebagai bahan hitungnya.
 */
export function laba<P extends PesananLaba, B extends BiayaOperasionalLaba>({
  rentang,
  denganBiayaOperasional,
  pesanan,
  biayaOperasional,
}: {
  rentang: RentangWaktu | null;
  denganBiayaOperasional: boolean;
  pesanan: readonly P[];
  biayaOperasional: readonly B[];
}) {
  const selesai = pendapatan({ rentang, pesanan });
  const dihitung = selesai.dihitung.filter(
    (p): p is P & { hargaModal: number } => p.hargaModal !== null,
  );
  const tanpaHargaModal = selesai.dihitung.filter((p) => p.hargaModal === null);

  const biayaOperasionalDihitung = denganBiayaOperasional
    ? biayaOperasional.filter(
        (b) =>
          rentang === null || dalamRentang(awalTanggalToko(b.tanggal), rentang),
      )
    : [];
  const totalBiayaOperasional = denganBiayaOperasional
    ? jumlahkan(biayaOperasionalDihitung, (b) => b.nominal)
    : null;

  const totalLabaKotor = jumlahkan(dihitung, (p) => labaKotor(p).labaKotor);
  const potonganVoucher = jumlahkan(dihitung, (p) => p.potonganVoucher);
  const kodeUnik = jumlahkan(dihitung, (p) => p.kodeUnik);
  const biayaTransaksi = jumlahkan(dihitung, (p) => p.biayaTransaksi ?? 0);

  return {
    pendapatan: selesai.pendapatan,
    pesananSelesai: jumlahPesananSelesai({ rentang, pesanan }).jumlah,
    totalHargaModal: jumlahkan(dihitung, (p) => p.hargaModal),
    labaKotor: totalLabaKotor,
    potonganVoucher,
    kodeUnik,
    biayaTransaksi,
    biayaOperasional: totalBiayaOperasional,
    labaBersih:
      totalLabaKotor -
      potonganVoucher +
      kodeUnik -
      biayaTransaksi -
      (totalBiayaOperasional ?? 0),
    pesananTanpaHargaModal: tanpaHargaModal.length,
    rentang,
    dihitung,
    tanpaHargaModal,
    biayaOperasionalDihitung,
  };
}
