import { describe, expect, it } from "vitest";

import { namaKategoriDipakai } from "./nama-kategori";

// PRD §3.1 (▶ Keputusan 2026-11-11, #53): nama Kategori harus unik. Nama dibandingkan tanpa
// membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir. Tidak ada golden untuk aturan
// ini, jadi contohnya diambil dari PRD, UAT-C7, dan issue T06-b (#55).
describe("namaKategoriDipakai", () => {
  it('"streaming" sudah dipakai bila Kategori "Streaming" ada (PRD §3.1)', () => {
    expect(namaKategoriDipakai("streaming", ["Musik", "Streaming"])).toBe(true);
  });

  it('"Streaming" sudah dipakai bila Kategori "Streaming" ada (UAT-C7)', () => {
    expect(namaKategoriDipakai("Streaming", ["Streaming"])).toBe(true);
  });

  it("spasi di awal atau akhir tidak membuat nama berbeda", () => {
    expect(namaKategoriDipakai("  Streaming ", ["Streaming"])).toBe(true);
    expect(namaKategoriDipakai("Streaming", [" streaming  "])).toBe(true);
  });

  it("nama yang hanya mirip tidak dihitung dipakai", () => {
    expect(
      namaKategoriDipakai("Streaming", ["Streaming dan Film", "Stream ing"]),
    ).toBe(false);
  });

  it("tanpa Kategori lain, nama apa pun belum dipakai", () => {
    expect(namaKategoriDipakai("Streaming", [])).toBe(false);
  });
});
