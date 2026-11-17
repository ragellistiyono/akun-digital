import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/percobaan-kode-verifikasi.json";
import { percobaanKodeVerifikasi } from "./percobaan-kode-verifikasi";

// PRD §7.3 dan §7.7: Kode verifikasi hangus setelah 5 kali salah, dan kode yang hangus menolak semua
// percobaan berikutnya, termasuk kode yang benar.
describe("percobaanKodeVerifikasi", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(percobaanKodeVerifikasi(input)).toEqual(output);
  });
});
