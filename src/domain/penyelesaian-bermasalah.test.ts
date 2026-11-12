import { describe, expect, it } from "vitest";

import golden from "../../tests/golden/transisi-status-pesanan.json";
import {
  hasilPenyelesaianBermasalah,
  penyelesaianBermasalahTersedia,
} from "./penyelesaian-bermasalah";

/** Status selain Bermasalah, yang kedua aksinya tidak tersedia menurut issue T26. */
const BUKAN_BERMASALAH = [
  "Menunggu Pembayaran",
  "Selesai",
  "Kedaluwarsa",
  "Dibatalkan",
  "Dana Dikembalikan",
] as const;

/** Kasus golden perpindahan dari Bermasalah ke status itu (PRD §5.7). */
function kasusDariBermasalah(ke: string) {
  const kasus = golden.kasus.find(
    ({ input }) => input.dari === "Bermasalah" && input.ke === ke,
  );
  if (!kasus) throw new Error(`Fixture tidak memuat Bermasalah → ${ke}.`);
  return kasus;
}

// PRD §5.7 dan §5.9, issue T26. Status tujuannya mengikuti tests/golden/transisi-status-pesanan.json, yaitu
// Bermasalah → Selesai dan Bermasalah → Dana Dikembalikan boleh terjadi oleh Admin.
describe("penyelesaianBermasalahTersedia", () => {
  it("Admin bisa menyelesaikan Pesanan Bermasalah", () => {
    expect(penyelesaianBermasalahTersedia("Bermasalah")).toBe(true);
  });

  it.each(BUKAN_BERMASALAH)(
    "kedua aksi tidak tersedia untuk Pesanan %s",
    (status) => {
      expect(penyelesaianBermasalahTersedia(status)).toBe(false);
    },
  );
});

describe("hasilPenyelesaianBermasalah", () => {
  it(`Kirim Item stok: ${kasusDariBermasalah("Selesai").nama} dengan satu Item stok baru dari Varian yang sama`, () => {
    expect(kasusDariBermasalah("Selesai").output.boleh).toBe(true);
    expect(
      hasilPenyelesaianBermasalah({
        statusPesanan: "Bermasalah",
        cara: "kirim-item-stok",
        stokVarian: 1,
      }),
    ).toEqual({
      hasil: "diselesaikan",
      statusBaru: "Selesai",
      kirimItemStok: true,
    });
  });

  it("Kirim Item stok ditolak bila Stok Varian 0, dan Pesanan tetap Bermasalah", () => {
    expect(
      hasilPenyelesaianBermasalah({
        statusPesanan: "Bermasalah",
        cara: "kirim-item-stok",
        stokVarian: 0,
      }),
    ).toEqual({ hasil: "stok-habis" });
  });

  it(`Tandai Dana Dikembalikan: ${kasusDariBermasalah("Dana Dikembalikan").nama} tanpa Item stok`, () => {
    expect(kasusDariBermasalah("Dana Dikembalikan").output.boleh).toBe(true);
    expect(
      hasilPenyelesaianBermasalah({
        statusPesanan: "Bermasalah",
        cara: "dana-dikembalikan",
      }),
    ).toEqual({
      hasil: "diselesaikan",
      statusBaru: "Dana Dikembalikan",
      kirimItemStok: false,
    });
  });

  it.each(BUKAN_BERMASALAH)(
    "Kirim Item stok tidak tersedia untuk Pesanan %s, walaupun Stok Varian masih ada",
    (status) => {
      expect(
        hasilPenyelesaianBermasalah({
          statusPesanan: status,
          cara: "kirim-item-stok",
          stokVarian: 5,
        }),
      ).toEqual({ hasil: "tidak-tersedia" });
    },
  );

  it.each(BUKAN_BERMASALAH)(
    "Tandai Dana Dikembalikan tidak tersedia untuk Pesanan %s",
    (status) => {
      expect(
        hasilPenyelesaianBermasalah({
          statusPesanan: status,
          cara: "dana-dikembalikan",
        }),
      ).toEqual({ hasil: "tidak-tersedia" });
    },
  );
});
