import { describe, expect, it } from "vitest";

import { pesanGantiPasswordTerkunci } from "./pesan-akun";

// PRD §7.6 ▶ Keputusan 2026-11-17: jam coba lagi dibulatkan ke atas ke menit berikutnya, seperti
// pesan kunci login (PRD §7.7 ▶ Keputusan 2026-11-11).
describe("pesanGantiPasswordTerkunci", () => {
  it("kunci yang berakhir pukul 10.15 tepat menulis 10.15", () => {
    expect(
      pesanGantiPasswordTerkunci(new Date("2026-11-17T10:15:00+07:00")),
    ).toBe(
      "Password lama salah 5 kali berturut-turut, jadi ganti password dikunci 15 menit. Coba lagi mulai pukul 10.15 WIB.",
    );
  });

  it("kunci yang berakhir pukul 10.15.30 menulis 10.16", () => {
    expect(
      pesanGantiPasswordTerkunci(new Date("2026-11-17T10:15:30+07:00")),
    ).toBe(
      "Password lama salah 5 kali berturut-turut, jadi ganti password dikunci 15 menit. Coba lagi mulai pukul 10.16 WIB.",
    );
  });
});
