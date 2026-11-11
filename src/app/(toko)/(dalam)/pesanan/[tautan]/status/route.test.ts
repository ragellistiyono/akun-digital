import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "@/server/db";
import { pesanan, varian } from "@/server/db/schema";
import { buatPesanan } from "@/server/pesanan";
import { bayarQrisTiruan, qrispyTiruan } from "@/server/qrispy-tiruan";
import { sisipkanProduk } from "@/server/uji-katalog";

import { GET } from "./route";

// Test integrasi dengan database app_test dari .env.ci (QRISPY_MODE=tiruan), yang dipakai bersama test
// lain. Setiap test membuat Pesanannya sendiri lewat checkout dengan Qrispy tiruan; data Produknya
// bertanda [CONTOH].
afterAll(async () => {
  await koneksi.end();
});

/** Checkout Canva Pro 1 Bulan Rp 50.000 [CONTOH] lewat Qrispy tiruan, sampai Pesanan Menunggu Pembayaran. */
async function checkout() {
  const produkId = await sisipkanProduk({
    nama: `Canva Pro ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const hasil = await buatPesanan(
    { varianId, email: `budi-${randomUUID()}@example.test` },
    { qrispy: qrispyTiruan },
  );
  if (hasil.hasil !== "dibuat") throw new Error(hasil.hasil);
  const [dibuat] = await db
    .select({
      tautan: pesanan.tautan,
      qrisId: pesanan.qrisId,
      totalBayar: pesanan.totalBayar,
    })
    .from(pesanan)
    .where(eq(pesanan.tautan, hasil.tautan));
  return dibuat;
}

function tanyaStatus(tautan: string) {
  return GET(new Request(`http://localhost/pesanan/${tautan}/status`), {
    params: Promise.resolve({ tautan }),
  });
}

// Issue T18 dan ADR-0004: Halaman bayar menanyakan status Pesanan ke server toko secara berkala, bukan ke
// Qrispy.
describe("status Pesanan GET /pesanan/[tautan]/status", () => {
  it("menjawab status terkini Pesanan di Tautan Pesanan itu, tanpa disimpan di cache", async () => {
    const { tautan } = await checkout();

    const respons = await tanyaStatus(tautan);

    expect(respons.status).toBe(200);
    expect(respons.headers.get("Cache-Control")).toBe("no-store");
    expect(await respons.json()).toEqual({ status: "Menunggu Pembayaran" });
  });

  // Jalur cek status (ADR-0004): pembayaran yang dipicu lewat Qrispy tiruan terbaca tanpa memuat ulang
  // Halaman bayar.
  it("memproses pembayaran yang sudah masuk di Qrispy, lalu menjawab status barunya", async () => {
    const { tautan, qrisId, totalBayar } = await checkout();
    bayarQrisTiruan({ qrisId, amount: totalBayar });

    const respons = await tanyaStatus(tautan);

    expect(await respons.json()).toEqual({ status: "Selesai" });
  });

  for (const [kasus, tautan] of [
    [
      "Tautan Pesanan yang tidak dikenal",
      randomBytes(32).toString("base64url"),
    ],
    ["alamat yang bukan Tautan Pesanan", "bukan-tautan"],
  ] as const) {
    it(`${kasus} dijawab 404 dengan pesan`, async () => {
      const respons = await tanyaStatus(tautan);

      expect(respons.status).toBe(404);
      expect(await respons.text()).toMatch(/Tautan Pesanan/);
    });
  }
});
