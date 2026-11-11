import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/nomor-whatsapp.json";
import { rapikanNomorWhatsapp } from "./nomor-whatsapp";

// PRD §9.8 ▶ Keputusan 2026-11-11 (#53): spasi, tanda hubung, dan tanda + dibuang, lalu satu angka 0
// di depan diganti 62. Hasilnya angka saja, diawali 62, paling banyak 15 angka. Isian kosong berarti
// nomor belum diisi.
describe("rapikanNomorWhatsapp", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(rapikanNomorWhatsapp(input)).toEqual(output);
  });
});
