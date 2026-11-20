import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/teks-salin-semua.json";
import { kolomItemStokTerkirim } from "./item-stok-terkirim";
import { teksSalinSemua } from "./teks-salin-semua";

// PRD §6.1 ▶ Keputusan 2026-11-20: satu baris "Nama kolom: isi" untuk setiap kolom, menurut urutan
// kolom, dipisah \n tanpa baris baru di akhir. Item stok Terkirim memakai nama kolom saat terkirim (§4.1),
// jadi setiap kasus dibaca lewat kolomItemStokTerkirim dengan `kolom` sebagai nama kolom saat terkirim.
// Semua contoh diambil dari fixture golden.
describe("teksSalinSemua", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    const kolom = kolomItemStokTerkirim({
      formatSaatTerkirim: input.kolom,
      nilai: input.isi,
    });
    expect(teksSalinSemua(kolom)).toBe(output.teks);
  });
});
