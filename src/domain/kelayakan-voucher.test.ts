import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kelayakan-voucher.json";
import type { CakupanVoucher } from "./isian-voucher";
import { kelayakanVoucher } from "./kelayakan-voucher";

type KasusGolden = (typeof golden.kasus)[number];
type VoucherGolden = NonNullable<KasusGolden["input"]["voucher"]>;

const waktuAtauNull = (teks: string | null) =>
  teks === null ? null : new Date(teks);

/** Voucher golden dengan waktu sebagai Date dan cakupan sebagai CakupanVoucher. */
const voucherGolden = ({ mulai, berakhir, cakupan, ...v }: VoucherGolden) => ({
  ...v,
  mulai: waktuAtauNull(mulai),
  berakhir: waktuAtauNull(berakhir),
  cakupan: cakupan as CakupanVoucher,
});

const inputGolden = ({
  voucher,
  checkout,
  pemakaian,
}: KasusGolden["input"]) => ({
  voucher: voucher === null ? null : voucherGolden(voucher),
  checkout: { ...checkout, waktu: new Date(checkout.waktu) },
  pemakaian,
});

// PRD §8.1, §8.4, §8.5, §8.7: syarat Voucher diperiksa saat checkout. Bila beberapa syarat gagal, pesan yang
// tampil adalah yang paling atas di §8.7.
describe("kelayakanVoucher", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const hasil = kelayakanVoucher(inputGolden(input));

    expect({ diterima: hasil.diterima, pesan: hasil.pesan }).toEqual(output);
  });

  it("tanpa email, Batas per email tidak diperiksa walaupun sudah terpakai (PRD §8.7 ▶ Keputusan 2026-11-17)", () => {
    const kasus = golden.kasus.find(
      (k) => k.nama === "Sudah dipakai email ini",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");
    const input = inputGolden(kasus.input);

    const hasil = kelayakanVoucher({
      ...input,
      pemakaian: { total: input.pemakaian.total, olehEmail: null },
    });

    expect({ diterima: hasil.diterima, pesan: hasil.pesan }).toEqual({
      diterima: true,
      pesan: null,
    });
  });

  it("menyebut alasan penolakan beserta minimal Harga jual sebagai bahan pesannya", () => {
    const kasus = golden.kasus.find(
      (k) => k.nama === "Di bawah minimal Harga jual",
    );
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    expect(kelayakanVoucher(inputGolden(kasus.input))).toEqual({
      diterima: false,
      alasan: "di-bawah-minimal-harga-jual",
      minimalHargaJual: 50000,
      pesan: "Minimal pembelian Rp 50.000",
    });
  });

  it("Voucher khusus Member yang ditolak bisa dikenali, supaya tautan Masuk bisa tampil (PRD §8.7)", () => {
    const kasus = golden.kasus.find((k) => k.nama === "Khusus Member, Tamu");
    if (!kasus) throw new Error("Kasus golden tidak ditemukan.");

    expect(kelayakanVoucher(inputGolden(kasus.input))).toMatchObject({
      diterima: false,
      alasan: "khusus-member",
    });
  });
});
