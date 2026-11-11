import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/batas-login.json";
import { percobaanLogin } from "./batas-login";

type KeadaanGolden = { jumlahSalah: number; terkunciSampai: string | null };

function keKeadaan(keadaan: KeadaanGolden) {
  return {
    jumlahSalah: keadaan.jumlahSalah,
    terkunciSampai:
      keadaan.terkunciSampai === null ? null : new Date(keadaan.terkunciSampai),
  };
}

// PRD §7.7: 5 kali salah berturut-turut mengunci email itu 15 menit sejak kesalahan kelima.
describe("percobaanLogin", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      percobaanLogin({
        keadaan: keKeadaan(input.keadaan),
        sekarang: new Date(input.sekarang),
        passwordBenar: input.passwordBenar,
      }),
    ).toEqual({
      hasil: output.hasil,
      keadaanBaru: keKeadaan(output.keadaanBaru),
    });
  });
});
