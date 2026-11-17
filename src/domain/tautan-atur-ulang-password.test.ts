import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/tautan-atur-ulang-password.json";
import { tautanAturUlangPasswordBerlaku } from "./tautan-atur-ulang-password";

// PRD §7.5 (▶ Keputusan 2026-11-17): Tautan atur ulang password berlaku 30 menit sejak dikirim, hanya
// sekali pakai, dan tidak berlaku lagi setelah diganti tautan baru.
describe("tautanAturUlangPasswordBerlaku", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      tautanAturUlangPasswordBerlaku({
        dikirimPada: new Date(input.dikirimPada),
        sekarang: new Date(input.sekarang),
        sudahDipakai: input.sudahDipakai,
        diganti: input.diganti,
      }),
    ).toEqual(output);
  });
});
