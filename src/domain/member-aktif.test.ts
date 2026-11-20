import { describe, expect, it } from "vitest";

import { jumlahMemberAktif, jumlahMemberTerdaftar } from "./member-aktif";

// PRD §2.3 ▶ Keputusan 2026-11-17 dan §9.2: Member aktif adalah Member yang sudah diverifikasi dan tidak
// nonaktif. Pendaftar belum menjadi Member, jadi tidak pernah masuk `semuaMember`. Data Member sintetis.
describe("jumlahMemberAktif", () => {
  it("dua Member aktif dan satu Member nonaktif: Member aktif berjumlah 2, tanpa Member nonaktif", () => {
    const budi = { email: "budi@mail.com", nonaktif: false };
    const andi = { email: "andi@mail.com", nonaktif: true };
    const sari = { email: "sari@mail.com", nonaktif: false };

    const hasil = jumlahMemberAktif({ semuaMember: [budi, andi, sari] });

    expect(hasil.jumlah).toBe(2);
    expect(hasil.dihitung).toEqual([budi, sari]);
  });

  it("tanpa Member, Member aktif berjumlah 0", () => {
    expect(jumlahMemberAktif({ semuaMember: [] })).toEqual({
      jumlah: 0,
      dihitung: [],
    });
  });

  it("semua Member nonaktif: Member aktif berjumlah 0", () => {
    expect(
      jumlahMemberAktif({
        semuaMember: [{ email: "budi@mail.com", nonaktif: true }],
      }).jumlah,
    ).toBe(0);
  });
});

// PRD §9.2 ▶ Keputusan 2026-11-20: Member terdaftar adalah semua Member, aktif maupun nonaktif, tanpa Pendaftar.
describe("jumlahMemberTerdaftar", () => {
  it("dua Member aktif dan satu Member nonaktif: Member terdaftar berjumlah 3", () => {
    const budi = { email: "budi@mail.com", nonaktif: false };
    const andi = { email: "andi@mail.com", nonaktif: true };
    const sari = { email: "sari@mail.com", nonaktif: false };

    const hasil = jumlahMemberTerdaftar({ semuaMember: [budi, andi, sari] });

    expect(hasil.jumlah).toBe(3);
    expect(hasil.dihitung).toEqual([budi, andi, sari]);
  });
});
