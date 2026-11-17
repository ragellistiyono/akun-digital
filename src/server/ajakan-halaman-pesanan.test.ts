import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bacaAjakanHalamanPesanan } from "./ajakan-halaman-pesanan";
import { buatAdmin } from "./auth/buat-admin";
import { db, koneksi } from "./db";
import { pendaftar, user, varian } from "./db/schema";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci. Ajakan di bawah Item stok Halaman Pesanan Selesai
// (PRD §7.1 ▶ Keputusan 2026-11-17): siapa pemilik email Pesanan dibaca dari database, lalu diputuskan
// ajakanHalamanPesanan di domain. Data Produk dan Member sintetis.
const PASSWORD = "sandi-uji-ajakan-1";
let varianId = "";

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Ajakan ${randomUUID().slice(0, 8)}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
});

afterAll(async () => {
  await koneksi.end();
});

const emailBaru = (awalan: string) => `${awalan}-${randomUUID()}@example.test`;

/** Tautan Pesanan Selesai dengan email itu. */
async function pesananSelesai(email: string) {
  const { tautan } = await sisipkanPesanan({
    varianId,
    status: "Selesai",
    email,
  });
  return tautan;
}

describe("bacaAjakanHalamanPesanan", () => {
  it("tanpa Member yang login, email yang belum pernah mendaftar mendapat ajakan buat akun beserta email Pesanan-nya", async () => {
    const email = emailBaru("tamu");
    const tautan = await pesananSelesai(email);

    expect(
      await bacaAjakanHalamanPesanan({ tautan, emailMemberLogin: null }),
    ).toEqual({ ajakan: "buat-akun", emailPesanan: email });
  });

  it("email Pendaftar yang belum memasukkan Kode verifikasi tetap mendapat ajakan buat akun", async () => {
    const email = emailBaru("pendaftar");
    await db.insert(pendaftar).values({
      email,
      password: "hash-uji",
      kodeVerifikasi: "123456",
      kodeDikirimPada: new Date(),
    });
    const tautan = await pesananSelesai(email);

    expect(
      await bacaAjakanHalamanPesanan({ tautan, emailMemberLogin: null }),
    ).toMatchObject({ ajakan: "buat-akun" });
  });

  it("email Admin dianggap belum milik Member, jadi tetap mendapat ajakan buat akun", async () => {
    const email = emailBaru("admin");
    await buatAdmin({ email, password: PASSWORD });
    const tautan = await pesananSelesai(email);

    expect(
      await bacaAjakanHalamanPesanan({ tautan, emailMemberLogin: null }),
    ).toMatchObject({ ajakan: "buat-akun" });
  });

  it("email Member yang ditulis dengan huruf besar di Pesanan mendapat ajakan login", async () => {
    const email = emailBaru("member");
    await sisipkanMember({ email, password: PASSWORD });
    const tautan = await pesananSelesai(email.toUpperCase());

    expect(
      await bacaAjakanHalamanPesanan({ tautan, emailMemberLogin: null }),
    ).toMatchObject({ ajakan: "login" });
  });

  it("email Member nonaktif juga mendapat ajakan login", async () => {
    const email = emailBaru("nonaktif");
    await sisipkanMember({ email, password: PASSWORD });
    await db.update(user).set({ nonaktif: true }).where(eq(user.email, email));
    const tautan = await pesananSelesai(email);

    expect(
      await bacaAjakanHalamanPesanan({ tautan, emailMemberLogin: null }),
    ).toMatchObject({ ajakan: "login" });
  });

  it("Member yang login mendapat tautan Riwayat untuk Pesanan miliknya, dan tidak ada ajakan untuk Pesanan email lain", async () => {
    const email = emailBaru("member");
    await sisipkanMember({ email, password: PASSWORD });

    expect(
      await bacaAjakanHalamanPesanan({
        tautan: await pesananSelesai(email),
        emailMemberLogin: email,
      }),
    ).toMatchObject({ ajakan: "lihat-riwayat" });
    expect(
      await bacaAjakanHalamanPesanan({
        tautan: await pesananSelesai(emailBaru("lain")),
        emailMemberLogin: email,
      }),
    ).toMatchObject({ ajakan: "tidak-ada" });
  });

  it("Tautan Pesanan yang tidak dikenal menghasilkan null", async () => {
    expect(
      await bacaAjakanHalamanPesanan({
        tautan: randomBytes(32).toString("base64url"),
        emailMemberLogin: null,
      }),
    ).toBeNull();
  });
});
