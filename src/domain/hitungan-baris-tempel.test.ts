import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/hitungan-baris-tempel.json";
import tempelGolden from "../../tests/golden/tempel-item-stok.json";
import { hitunganBarisTempel } from "./hitungan-baris-tempel";

// PRD §4.2 ▶ Keputusan 2026-11-20: "N baris akan diproses" adalah jumlah baris yang tidak kosong. Baris
// kosong dan baris yang hanya berisi spasi atau tab tidak dihitung, karena diabaikan saat disimpan.
describe("hitunganBarisTempel", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    expect(hitunganBarisTempel(input.teks)).toEqual(output);
  });

  // Fixture hitungan baris: N selalu sama dengan jumlah tersimpan ditambah ditolak di tempel-item-stok.json.
  it.each(tempelGolden.kasus)(
    "sama dengan tersimpan + ditolak: $nama",
    ({ input, output }) => {
      expect(hitunganBarisTempel(input.baris.join("\n")).jumlahBaris).toBe(
        output.tersimpan.length + output.ditolak.length,
      );
    },
  );
});
