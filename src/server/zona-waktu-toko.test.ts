import { describe, expect, it } from "vitest";

import {
  jamWibDibulatkanKeAtas,
  rentangTanggalWib,
  waktuWib,
} from "./zona-waktu-toko";

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

// PRD §9.1: tanggal dibaca dalam WIB, dari pukul 00.00.00 sampai 23.59.59. Contoh dari issue T24.
describe("rentangTanggalWib", () => {
  it("memuat pukul 23.30 WIB (16.30 UTC) dan tidak memuat pukul 00.30 WIB keesokan harinya", () => {
    const { mulai, sebelum } = rentangTanggalWib({
      dari: "2026-11-11",
      sampai: "2026-11-11",
    });
    const dimuat = (instan: Date) => instan >= mulai! && instan < sebelum!;

    expect(dimuat(new Date("2026-11-11T16:30:00Z"))).toBe(true);
    expect(dimuat(new Date("2026-11-12T00:30:00+07:00"))).toBe(false);
  });

  it("mulai pukul 00.00.00 WIB tanggal dari, dan berakhir sebelum 00.00.00 WIB sesudah tanggal sampai", () => {
    expect(
      rentangTanggalWib({ dari: "2026-11-10", sampai: "2026-11-11" }),
    ).toEqual({
      mulai: new Date("2026-11-10T00:00:00+07:00"),
      sebelum: new Date("2026-11-12T00:00:00+07:00"),
    });
  });

  it("tanpa tanggal dari atau sampai, sisi itu tidak dibatasi", () => {
    expect(rentangTanggalWib({ dari: "2026-11-30" })).toEqual({
      mulai: new Date("2026-11-30T00:00:00+07:00"),
      sebelum: undefined,
    });
    expect(rentangTanggalWib({ sampai: "2026-11-30" })).toEqual({
      mulai: undefined,
      sebelum: new Date("2026-12-01T00:00:00+07:00"),
    });
  });
});

// PRD §9.1, §9.5: waktu dibuat Pesanan ditulis dalam WIB, dengan jam "HH.MM" seperti di PRD §5.4.
describe("waktuWib", () => {
  it("menulis tanggal dan jam WIB dari instan UTC", () => {
    expect(waktuWib(new Date("2026-11-11T16:30:00Z"))).toBe(
      "11 Nov 2026 23.30",
    );
  });

  it("memakai tanggal WIB walaupun tanggal UTC-nya masih kemarin", () => {
    expect(waktuWib(new Date("2026-11-30T17:05:00Z"))).toBe("1 Des 2026 00.05");
  });

  it("tidak membulatkan detik, supaya Pesanan pukul 23.59.59 tetap tertulis di tanggalnya", () => {
    expect(waktuWib(new Date("2026-11-11T23:59:59+07:00"))).toBe(
      "11 Nov 2026 23.59",
    );
  });
});
