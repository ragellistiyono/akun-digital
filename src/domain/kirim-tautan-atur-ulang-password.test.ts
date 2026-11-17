import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/kirim-tautan-atur-ulang-password.json";
import { periksaKirimTautanAturUlangPassword } from "./kirim-tautan-atur-ulang-password";

// PRD §7.5 (▶ Keputusan 2026-11-17) dan §7.7: Tautan atur ulang password baru untuk email yang sama paling
// cepat dikirim 60 detik setelah tautan sebelumnya.
describe("periksaKirimTautanAturUlangPassword", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(
      periksaKirimTautanAturUlangPassword({
        terakhirDikirimPada:
          input.terakhirDikirimPada === null
            ? null
            : new Date(input.terakhirDikirimPada),
        sekarang: new Date(input.sekarang),
      }),
    ).toEqual(output);
  });
});
