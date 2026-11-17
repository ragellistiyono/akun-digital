import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DaftarStokMenipis } from "./daftar-stok-menipis";

// PRD §9.4 ▶ Keputusan 2026-11-17. Database test dipakai bersama oleh semua test dan hampir selalu
// berisi Varian dengan Stok Varian 0, jadi daftar kosong diuji langsung di komponen ini.
describe("DaftarStokMenipis", () => {
  it('daftar kosong berbunyi "Tidak ada Varian yang stoknya menipis."', () => {
    const html = renderToStaticMarkup(<DaftarStokMenipis varian={[]} />);

    expect(html).toContain("Tidak ada Varian yang stoknya menipis.");
    expect(html).not.toContain("<a");
  });

  it("setiap baris berisi nama Produk, nama Varian, dan Stok Varian, dan membuka halaman Varian-nya", () => {
    const html = renderToStaticMarkup(
      <DaftarStokMenipis
        varian={[
          {
            varianId: "v-1",
            namaVarian: "1 Bulan",
            produkId: "p-1",
            namaProduk: "YouTube Premium",
            stokVarian: 0,
          },
        ]}
      />,
    );

    expect(html).toContain('href="/admin/produk/p-1/varian/v-1"');
    expect(html).toContain("YouTube Premium");
    expect(html).toContain("1 Bulan");
    expect(html).toContain("Stok 0");
    expect(html).not.toContain("Tidak ada Varian yang stoknya menipis.");
  });
});
