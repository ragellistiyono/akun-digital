import { describe, expect, it } from "vitest";

import golden from "../../../../../../../tests/golden/kedaluwarsa-pesanan.json";
import { hitungMundur } from "./hitung-mundur";

// Contoh PRD §5.8: QRIS terbit pukul 10.00.00 dengan waktu kedaluwarsa 10.15.00.
const KEDALUWARSA = Date.parse("2026-11-11T10:15:00+07:00");
const pukul = (jam: string) => Date.parse(`2026-11-11T${jam}+07:00`);

describe("hitungMundur", () => {
  // Issue T18 dan DESIGN.md "Pemandangan senja": t bergerak dari 0 saat sisa waktu 15:00 sampai 1 saat
  // sisa waktu 00:00, dan matahari menyentuh punggung gunung (t = 0,5) sekitar 07:30.
  it("saat QRIS terbit, sisa waktunya 15:00 dan waktu senjanya 0", () => {
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("10:00:00"),
      }),
    ).toEqual({ teks: "15:00", sisaMenit: 15, habis: false, t: 0 });
  });

  it("di tengah masa berlaku, sisa waktunya 07:30 dan waktu senjanya 0,5", () => {
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("10:07:30"),
      }),
    ).toMatchObject({ teks: "07:30", t: 0.5 });
  });

  it("saat waktu kedaluwarsa tercapai, sisa waktunya 00:00, waktu senjanya 1, dan hitung mundurnya habis", () => {
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("10:15:00"),
      }),
    ).toEqual({ teks: "00:00", sisaMenit: 0, habis: true, t: 1 });
  });

  it("sisa detik yang tidak bulat dibulatkan ke atas, jadi 00:00 hanya tampil saat QRIS sudah kedaluwarsa", () => {
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("10:14:59.400"),
      }),
    ).toMatchObject({ teks: "00:01", habis: false });
  });

  // Pembaca layar mendapat sisa menit sekali per menit (DESIGN.md), jadi sisa menit hanya berganti saat
  // hitung mundur melewati menit bulat.
  it("sisa menit berganti tepat saat hitung mundur melewati menit bulat", () => {
    const sisaMenit = (jam: string) =>
      hitungMundur({ kedaluwarsaPada: KEDALUWARSA, sekarang: pukul(jam) })
        .sisaMenit;

    expect(sisaMenit("10:02:55")).toBe(13);
    expect(sisaMenit("10:02:59")).toBe(13);
    expect(sisaMenit("10:03:00")).toBe(12);
    expect(sisaMenit("10:14:59")).toBe(1);
  });

  it("waktu senja tidak keluar dari rentang 0–1 bila sisa waktunya lebih dari 15 menit atau sudah lewat", () => {
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("09:59:30"),
      }),
    ).toMatchObject({ teks: "15:30", t: 0 });
    expect(
      hitungMundur({
        kedaluwarsaPada: KEDALUWARSA,
        sekarang: pukul("10:20:00"),
      }),
    ).toEqual({ teks: "00:00", sisaMenit: 0, habis: true, t: 1 });
  });

  // §5.6 hitung mundur hanya tampilan; aturan waktunya ada di tests/golden/kedaluwarsa-pesanan.json
  // (tests/golden/NOTES.md). Hitung mundur habis tepat saat Pesanan menjadi Kedaluwarsa.
  it.each(golden.kasus)(
    "hitung mundur habis sesuai aturan Kedaluwarsa: $nama",
    ({ input, output }) => {
      expect(
        hitungMundur({
          kedaluwarsaPada: Date.parse(input.kedaluwarsaPada),
          sekarang: Date.parse(input.sekarang),
        }).habis,
      ).toBe(output.kedaluwarsa);
    },
  );
});
