import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/hapus-semua-item-stok.json";
import {
  penegasanHapusSemuaItemStokTersedia,
  pesanItemStokTerhapus,
} from "./hapus-semua-item-stok";

// PRD §4.4 ▶ Keputusan 2026-11-22 dan §9.10: tombol "Hapus semua Item stok Tersedia" hanya tampil bila ada Item
// stok Tersedia. Teks penegasannya memakai jumlah saat modal dibuka, dan pesan sesudahnya memakai jumlah yang
// benar-benar terhapus saat penegasan disetujui.
describe("hapus semua Item stok Tersedia", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const penegasan = penegasanHapusSemuaItemStokTersedia({
      produk: input.produk,
      varian: input.varian,
      jumlahPerStatus: {
        Tersedia: input.tersediaSaatModalDibuka,
        Ditahan: input.ditahan,
        Terkirim: input.terkirim,
      },
    });

    expect(penegasan.tombolTampil).toBe(output.tombolTampil);
    expect(penegasan.tombolTampil ? penegasan.teksPenegasan : null).toBe(
      output.teksPenegasan,
    );
    expect(
      penegasan.tombolTampil
        ? pesanItemStokTerhapus(input.tersediaSaatDisetujui)
        : null,
    ).toBe(output.pesanSesudah);
  });
});
