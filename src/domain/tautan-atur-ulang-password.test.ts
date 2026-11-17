import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/tautan-atur-ulang-password.json";
import { tautanAturUlangPasswordBerlaku } from "./tautan-atur-ulang-password";

// PRD §7.5 (▶ Keputusan 2026-11-17): Tautan atur ulang password berlaku 30 menit sejak dikirim, hanya
// sekali pakai, dan tidak berlaku lagi setelah diganti tautan baru. Kasus golden semuanya milik Member aktif.
describe("tautanAturUlangPasswordBerlaku", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      tautanAturUlangPasswordBerlaku({
        dikirimPada: new Date(input.dikirimPada),
        sekarang: new Date(input.sekarang),
        sudahDipakai: input.sudahDipakai,
        diganti: input.diganti,
        memberNonaktif: false,
      }),
    ).toEqual(output);
  });

  // PRD §7.5 ▶ Keputusan 2026-11-17: tautan dikirim ke Budi pukul 10.00, pukul 10.05 Admin
  // menonaktifkan Budi, pukul 10.10 Budi membuka tautan itu dan melihat pesan nonaktif.
  it("tautan milik Member nonaktif tidak bisa dipakai walaupun 30 menitnya belum habis", () => {
    expect(
      tautanAturUlangPasswordBerlaku({
        dikirimPada: new Date("2026-11-17T10:00:00+07:00"),
        sekarang: new Date("2026-11-17T10:10:00+07:00"),
        sudahDipakai: false,
        diganti: false,
        memberNonaktif: true,
      }),
    ).toEqual({ berlaku: false, alasan: "member-nonaktif" });
  });

  it("selama Member nonaktif, alasan nonaktif didahulukan daripada sudah dipakai, diganti, dan kedaluwarsa", () => {
    expect(
      tautanAturUlangPasswordBerlaku({
        dikirimPada: new Date("2026-11-17T10:00:00+07:00"),
        sekarang: new Date("2026-11-17T10:40:00+07:00"),
        sudahDipakai: true,
        diganti: true,
        memberNonaktif: true,
      }),
    ).toEqual({ berlaku: false, alasan: "member-nonaktif" });
  });
});
