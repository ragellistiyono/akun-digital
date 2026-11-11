import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/format-item-stok.json";
import { periksaFormatItemStok } from "./format-item-stok";

// PRD §4.1 (▶ Keputusan 2026-11-11, #53): Format Item stok minimal satu kolom, dan nama kolom tidak
// boleh kosong atau kembar. Nama kolom dianggap kembar tanpa membedakan huruf besar dan kecil, dan
// tanpa spasi di awal atau akhir. Semua contoh diambil dari fixture golden.
describe("periksaFormatItemStok", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(periksaFormatItemStok(input.kolom)).toEqual(output);
  });
});
