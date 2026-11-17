import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/masa-berlaku-kode-verifikasi.json";
import { kodeVerifikasiBerlaku } from "./masa-berlaku-kode-verifikasi";

// PRD §7.3: Kode verifikasi berlaku 10 menit sejak dikirim; tepat 10 menit sesudahnya sudah tidak berlaku.
describe("kodeVerifikasiBerlaku", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      kodeVerifikasiBerlaku({
        dikirimPada: new Date(input.dikirimPada),
        sekarang: new Date(input.sekarang),
      }),
    ).toEqual(output);
  });
});
