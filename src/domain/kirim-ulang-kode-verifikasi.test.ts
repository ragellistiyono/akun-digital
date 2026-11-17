import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kirim-ulang-kode-verifikasi.json";
import { periksaKirimUlangKodeVerifikasi } from "./kirim-ulang-kode-verifikasi";

// PRD §7.7 dan §7.2 (▶ Keputusan 2026-11-17): Kode verifikasi baru, termasuk lewat pendaftaran ulang,
// paling cepat dikirim 60 detik setelah kode sebelumnya.
describe("periksaKirimUlangKodeVerifikasi", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      periksaKirimUlangKodeVerifikasi({
        terakhirDikirimPada: new Date(input.terakhirDikirimPada),
        sekarang: new Date(input.sekarang),
      }),
    ).toEqual(output);
  });
});
