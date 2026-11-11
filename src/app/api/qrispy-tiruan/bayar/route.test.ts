import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { qrispyTiruan } from "@/server/qrispy-tiruan";

import { POST } from "./route";

function minta(isi: string) {
  return POST(
    new Request("http://localhost/api/qrispy-tiruan/bayar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: isi,
    }),
  );
}

// Issue T16 dan ADR-0004: Qrispy tiruan menyediakan pemicu pembayaran dengan nominal yang bisa diatur,
// yang hanya aktif bila QRISPY_MODE=tiruan.
describe("pemicu pembayaran Qrispy tiruan POST /api/qrispy-tiruan/bayar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("membayar QRIS itu dengan nominal yang diatur, termasuk nominal kurang dari Total bayar", async () => {
    vi.stubEnv("QRISPY_MODE", "tiruan");
    const qrisId = randomUUID();

    const respons = await minta(JSON.stringify({ qrisId, amount: 45000 }));

    expect(respons.status).toBe(200);
    expect(await qrispyTiruan.cekStatusQris(qrisId)).toMatchObject({
      paymentStatus: "paid",
      amount: 45000,
    });
  });

  for (const mode of ["sungguhan", ""]) {
    it(`menolak dipakai bila QRISPY_MODE bernilai "${mode}", dan QRIS tetap belum dibayar`, async () => {
      vi.stubEnv("QRISPY_MODE", mode);
      const qrisId = randomUUID();

      const respons = await minta(JSON.stringify({ qrisId, amount: 50123 }));

      expect(respons.status).toBe(404);
      expect(await respons.text()).toMatch(/QRISPY_MODE=tiruan/);
      expect(await qrispyTiruan.cekStatusQris(qrisId)).toEqual({
        paymentStatus: "pending",
      });
    });
  }

  for (const [kasus, isi] of [
    ["tanpa qrisId", JSON.stringify({ amount: 50123 })],
    ["nominal bukan angka bulat", JSON.stringify({ qrisId: "q", amount: 1.5 })],
    ["nominal 0", JSON.stringify({ qrisId: "q", amount: 0 })],
    ["bukan JSON", "qrisId=q&amount=50123"],
  ] as const) {
    it(`isi ${kasus} ditolak dengan pesan yang menyebut bentuk isi yang benar`, async () => {
      vi.stubEnv("QRISPY_MODE", "tiruan");

      const respons = await minta(isi);

      expect(respons.status).toBe(400);
      expect(await respons.text()).toContain(
        '{"qrisId": "<qris_id>", "amount": <nominal>}',
      );
    });
  }
});
