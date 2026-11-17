import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db, koneksi } from "@/server/db";
import { user } from "@/server/db/schema";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { ubahStatusMember } from "@/server/status-member";
import { sisipkanMember } from "@/server/uji-member";

import { aksiMasukMember } from "./aksi";

// Test integrasi Server Action login Member dengan database app_test dari .env.ci. Header permintaan yang
// dibaca aksi lewat next/headers diganti header kosong (Tamu). Baris Pengaturan toko dipakai bersama test lain
// yang berjalan bersamaan (pengaturan/aksi.test.ts menimpanya), jadi nomor WhatsApp diatur lewat
// bacaPengaturanToko tiruan. PRD §7.5 ▶ Keputusan 2026-11-17, UAT-B3 langkah 4.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("@/server/pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

const PASSWORD = "sandi-uji-member-123";
const NOMOR_WHATSAPP = "6281234567890";

afterAll(async () => {
  await koneksi.end();
});

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers());
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp: NOMOR_WHATSAPP,
    syaratKetentuan: "",
    kebijakanPrivasi: "",
    ambangStokMenipis: 5,
  });
});

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

async function memberNonaktifBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  await ubahStatusMember({ idMember: id, nonaktif: true });
  return email;
}

describe("aksiMasukMember untuk Member nonaktif", () => {
  it("password benar menampilkan pesan nonaktif beserta nomor WhatsApp untuk tombolnya", async () => {
    const email = await memberNonaktifBaru();

    expect(
      await aksiMasukMember(
        { email: "" },
        formulir({ email, password: PASSWORD }),
      ),
    ).toEqual({
      email,
      galat: {
        umum: "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp.",
      },
      nomorWhatsapp: NOMOR_WHATSAPP,
    });
  });

  it("password salah menampilkan pesan password salah biasa, tanpa tombol WhatsApp", async () => {
    const email = await memberNonaktifBaru();

    expect(
      await aksiMasukMember(
        { email: "" },
        formulir({ email, password: "password-yang-salah" }),
      ),
    ).toEqual({
      email,
      galat: {
        umum: "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.",
      },
    });
  });
});

/** Alamat tujuan bila galat yang dilempar Server Action adalah pengalihan Next.js. */
function alamatPengalihan(galat: unknown) {
  if (
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    typeof galat.digest === "string" &&
    galat.digest.startsWith("NEXT_REDIRECT")
  ) {
    return galat.digest.split(";")[2];
  }
  throw galat;
}

/** Login Member aktif baru dengan alamat kembali itu. Hasilnya alamat tujuan pengalihan setelah login. */
async function masukDenganAlamatKembali(kembali: string) {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  return aksiMasukMember(
    { email: "" },
    formulir({ email, password: PASSWORD, kembali }),
  ).then(
    () => null,
    (galat: unknown) => alamatPengalihan(galat),
  );
}

// Tautan Masuk dari pesan Voucher khusus Member di Checkout (PRD §7.5 dan §8.7 ▶ Keputusan 2026-11-17, UAT-H3).
describe("aksiMasukMember dengan alamat kembali", () => {
  it("Member yang login lewat tautan Masuk di Checkout kembali ke Checkout Varian yang sama", async () => {
    const checkout = `/checkout?varianId=${randomUUID()}`;

    expect(await masukDenganAlamatKembali(checkout)).toBe(checkout);
  });

  it("alamat kembali ke Checkout yang membawa kode voucher yang diketik tetap utuh setelah login", async () => {
    const checkout = `/checkout?varianId=${randomUUID()}&kodeVoucher=MEMBER20`;

    expect(await masukDenganAlamatKembali(checkout)).toBe(checkout);
  });

  for (const kembali of [
    "https://jahat.example/checkout",
    "https://jahat.example/checkout?varianId=1&kodeVoucher=MEMBER20",
    "//jahat.example/checkout",
    "/\\jahat.example/checkout",
    "javascript:alert(1)",
    "checkout?varianId=1",
  ]) {
    it(`alamat kembali ke luar toko (${kembali}) diabaikan, dan Member dibawa ke Riwayat Pesanan`, async () => {
      expect(await masukDenganAlamatKembali(kembali)).toBe("/riwayat");
    });
  }

  it("tanpa alamat kembali, Member dibawa ke Riwayat Pesanan", async () => {
    expect(await masukDenganAlamatKembali("")).toBe("/riwayat");
  });
});
