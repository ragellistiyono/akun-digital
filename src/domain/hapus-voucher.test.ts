import { describe, expect, it } from "vitest";

import { bolehHapusVoucher } from "./hapus-voucher";
import { STATUS_PESANAN } from "./status-pesanan";

// PRD §8.8: Voucher yang pernah tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan,
// tidak bisa dihapus, hanya dinonaktifkan.
describe("bolehHapusVoucher", () => {
  it("COBA yang Pesanannya Dibatalkan ditolak (UAT-H5 langkah 4)", () => {
    expect(
      bolehHapusVoucher({ jumlahPesananPerStatus: { Dibatalkan: 1 } }),
    ).toEqual({ boleh: false, jumlahPesanan: 1 });
  });

  it.each(STATUS_PESANAN)(
    "tercatat di satu Pesanan %s berarti pernah dipakai, jadi ditolak",
    (status) => {
      expect(
        bolehHapusVoucher({ jumlahPesananPerStatus: { [status]: 1 } }),
      ).toEqual({ boleh: false, jumlahPesanan: 1 });
    },
  );

  it("Pesanan Selesai, Kedaluwarsa, dan Dana Dikembalikan dihitung semuanya", () => {
    expect(
      bolehHapusVoucher({
        jumlahPesananPerStatus: {
          Selesai: 2,
          Kedaluwarsa: 1,
          "Dana Dikembalikan": 1,
        },
      }),
    ).toEqual({ boleh: false, jumlahPesanan: 4 });
  });

  it("HAPUS yang belum pernah tercatat di Pesanan boleh dihapus (UAT-H5 langkah 5)", () => {
    expect(bolehHapusVoucher({ jumlahPesananPerStatus: {} })).toEqual({
      boleh: true,
    });
  });
});
