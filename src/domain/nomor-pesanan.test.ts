import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/nomor-pesanan.json";
import { nomorPesanan, nomorPesananSah } from "./nomor-pesanan";

// PRD §9.6: MIWE- diikuti 6 karakter huruf besar dan angka, tanpa O, 0, I, dan 1.
describe("nomorPesananSah", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(nomorPesananSah(input.nomor)).toBe(output.valid);
  });
});

// PRD §9.6: karakternya acak. Lapisan server memberi 6 byte acak; setiap nilai byte menghasilkan
// Nomor Pesanan yang lulus bentuk golden di atas.
describe("nomorPesanan", () => {
  it("setiap nilai byte menghasilkan Nomor Pesanan yang sah", () => {
    for (let nilai = 0; nilai < 256; nilai++) {
      const byte = Uint8Array.from({ length: 6 }, (_, i) => (nilai + i) % 256);
      expect(nomorPesananSah(nomorPesanan(byte))).toBe(true);
    }
  });

  it("memakai 32 karakter berbeda, jadi setiap karakter acak muncul sama sering", () => {
    const karakter = new Set<string>();
    for (let nilai = 0; nilai < 256; nilai++) {
      karakter.add(nomorPesanan(new Uint8Array(6).fill(nilai)).at(-1) ?? "");
    }
    // A–Z tanpa I dan O (24 huruf), ditambah 2–9 (8 angka).
    expect(karakter.size).toBe(32);
  });

  it("byte acak yang berbeda menghasilkan Nomor Pesanan yang berbeda", () => {
    expect(nomorPesanan(Uint8Array.of(0, 1, 2, 3, 4, 5))).not.toBe(
      nomorPesanan(Uint8Array.of(5, 4, 3, 2, 1, 0)),
    );
  });

  it("menolak byte acak yang kurang dari 6", () => {
    expect(() => nomorPesanan(Uint8Array.of(1, 2, 3))).toThrow(RangeError);
  });
});
