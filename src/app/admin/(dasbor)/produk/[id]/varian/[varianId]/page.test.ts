import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "@/server/db";
import { varian } from "@/server/db/schema";
import { arahKe } from "@/server/uji-admin";
import { sisipkanProduk } from "@/server/uji-katalog";

import HalamanVarian from "./page";

// Test integrasi halaman Varian dengan database app_test dari .env.ci. Header permintaan yang dibaca halaman
// lewat next/headers diganti dengan header tanpa cookie sesi, seperti permintaan dari Tamu.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

afterAll(async () => {
  await koneksi.end();
});

// Issue T27: Tamu tidak bisa melihat Item stok.
describe("kewenangan melihat daftar Item stok (PRD §2.1, §9.7)", () => {
  it("Tamu tanpa sesi Admin yang membuka halaman Varian diarahkan ke halaman login, tanpa melihat Item stok", async () => {
    const produkId = await sisipkanProduk({
      nama: `Halaman Varian ${randomUUID().slice(0, 8)}`,
      varian: [{ nama: "1 Bulan", hargaJual: 50000, Tersedia: 2 }],
    });
    const [{ id: varianId }] = await db
      .select({ id: varian.id })
      .from(varian)
      .where(eq(varian.produkId, produkId));
    vi.mocked(headers).mockResolvedValue(new Headers());

    await expect(
      HalamanVarian({
        params: Promise.resolve({ id: produkId, varianId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toSatisfy(arahKe("/admin"));
  });
});
