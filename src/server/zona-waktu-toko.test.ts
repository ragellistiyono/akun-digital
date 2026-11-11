import { describe, expect, it } from "vitest";

import { jamWibDibulatkanKeAtas } from "./zona-waktu-toko";

// PRD §9.1: Zona waktu toko adalah WIB (UTC+7). Jam ditulis "HH.MM", seperti di PRD §5.4.
describe("jamWibDibulatkanKeAtas", () => {
  it("menulis jam WIB dari instan UTC", () => {
    expect(jamWibDibulatkanKeAtas(new Date("2026-11-11T03:15:00Z"))).toBe(
      "10.15",
    );
  });

  it("menulis jam sebelum pukul 10 dengan dua digit", () => {
    expect(jamWibDibulatkanKeAtas(new Date("2026-11-11T09:05:00+07:00"))).toBe(
      "09.05",
    );
  });

  it("memakai jam WIB walaupun tanggal UTC-nya masih kemarin", () => {
    expect(jamWibDibulatkanKeAtas(new Date("2026-11-11T17:05:00Z"))).toBe(
      "00.05",
    );
  });

  it("membulatkan detik ke menit berikutnya, supaya jam yang tertulis tidak mendahului instannya", () => {
    expect(jamWibDibulatkanKeAtas(new Date("2026-11-11T10:15:01+07:00"))).toBe(
      "10.16",
    );
    expect(jamWibDibulatkanKeAtas(new Date("2026-11-11T23:59:30+07:00"))).toBe(
      "00.00",
    );
  });
});
