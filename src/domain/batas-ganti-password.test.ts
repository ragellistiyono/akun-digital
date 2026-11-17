import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/batas-ganti-password.json";
import { percobaanGantiPassword } from "./batas-ganti-password";

type KeadaanGolden = { jumlahSalah: number; terkunciSampai: string | null };

function keKeadaan(keadaan: KeadaanGolden) {
  return {
    jumlahSalah: keadaan.jumlahSalah,
    terkunciSampai:
      keadaan.terkunciSampai === null ? null : new Date(keadaan.terkunciSampai),
  };
}

// PRD §7.6 ▶ Keputusan 2026-11-17: 5 kali salah password lama berturut-turut mengunci ganti
// password Member itu 15 menit sejak kesalahan kelima.
describe("percobaanGantiPassword", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      percobaanGantiPassword({
        keadaan: keKeadaan(input.keadaan),
        sekarang: new Date(input.sekarang),
        passwordLamaBenar: input.passwordLamaBenar,
      }),
    ).toEqual({
      hasil: output.hasil,
      keadaanBaru: keKeadaan(output.keadaanBaru),
    });
  });
});
