import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { StatusPesanan } from "@/domain/status-pesanan";

import kesamaanEmail from "../../tests/golden/kesamaan-email.json";
import pendapatanGolden from "../../tests/golden/pendapatan.json";

import { buatAdmin } from "./auth/buat-admin";
import { daftarMember } from "./daftar-member";
import { db, koneksi } from "./db";
import { pendaftar, user, varian } from "./db/schema";
import { ubahStatusMember } from "./status-member";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanMember } from "./uji-member";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test dari .env.ci. Database itu dipakai bersama test lain yang berjalan
// bersamaan, jadi setiap test memakai email dengan akhiran unik dan mencari Member-nya lewat akhiran itu.

const PASSWORD = "sandi-uji-member-123";
let varianId = "";

beforeAll(async () => {
  const produkId = await sisipkanProduk({
    nama: `Daftar Member ${randomUUID().slice(0, 8)}`,
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

/** Email itu dengan akhiran unik tepat sebelum "@", misalnya "budi@mail.com" menjadi "budi+3f9a…@mail.com". */
const denganAkhiran = (email: string, akhiran: string) =>
  email.replace("@", `+${akhiran}@`);

/** Pesanan dengan Total bayar dan waktu bayar itu. Kode unik sudah termasuk Total bayar (PRD §5.5). */
const sisipkanPesananDibayar = ({
  email,
  status,
  totalBayar,
  waktuBayar,
}: {
  email: string;
  status: StatusPesanan;
  totalBayar: number;
  waktuBayar: Date | null;
}) =>
  sisipkanPesanan({
    varianId,
    status,
    email,
    waktuBayar,
    rincian: {
      hargaJual: totalBayar,
      potonganVoucher: 0,
      kodeUnik: 0,
      totalBayar,
    },
  });

/** Baris daftar Member dengan email itu. */
async function barisMember(email: string) {
  const daftar = await daftarMember({ cari: email });
  const baris = daftar.filter((m) => m.email === email);
  expect(baris).toHaveLength(1);
  return baris[0];
}

/**
 * Kasus pendapatan.json yang semua Pesanannya dibayar di dalam rentangnya, sehingga Pendapatan di fixture juga
 * total belanja Member yang memegang semua Pesanan itu (tests/golden/NOTES.md).
 */
const kasusTanpaPengaruhRentang = pendapatanGolden.kasus.filter(
  ({ input: { rentang, pesanan } }) =>
    pesanan.every(
      (p) =>
        new Date(p.dibayarPada) >= new Date(rentang.mulai) &&
        new Date(p.dibayarPada) < new Date(rentang.sebelum),
    ),
);

describe("daftarMember: total belanja (PRD §2.3, tests/golden/pendapatan.json)", () => {
  it.each(kasusTanpaPengaruhRentang)(
    "$nama: total belanja Member sama dengan Pendapatan di fixture",
    async ({ input, output }) => {
      const email = `budi-${randomUUID()}@mail.com`;
      await sisipkanMember({ email, password: PASSWORD });
      for (const p of input.pesanan) {
        await sisipkanPesananDibayar({
          email,
          status: p.status as StatusPesanan,
          totalBayar: p.totalBayar,
          waktuBayar: new Date(p.dibayarPada),
        });
      }

      const baris = await barisMember(email);

      expect(baris.belanja.totalBelanja).toBe(output.pendapatan);
    },
  );

  it("Contoh PRD §9.3 tanpa batas waktu: Kode unik ikut, Pesanan Bermasalah, Dana Dikembalikan, dan Pesanan email lain tidak", async () => {
    const email = `budi-${randomUUID()}@mail.com`;
    await sisipkanMember({ email, password: PASSWORD });
    const pesananPada = (
      status: StatusPesanan,
      totalBayar: number,
      waktuBayar: string | null,
      emailPesanan = email,
    ) =>
      sisipkanPesananDibayar({
        email: emailPesanan,
        status,
        totalBayar,
        waktuBayar: waktuBayar === null ? null : new Date(waktuBayar),
      });
    // Total bayar Rp 45.123 = Harga jual Rp 50.000 - potongan voucher Rp 5.000 + Kode unik Rp 123 (PRD §5.5).
    await sisipkanPesanan({
      varianId,
      status: "Selesai",
      email,
      waktuBayar: new Date("2024-01-05T10:00:00+07:00"),
    });
    await pesananPada("Selesai", 50010, "2026-11-11T13:30:00+07:00");
    await pesananPada("Selesai", 135499, "2026-11-17T20:45:00+07:00");
    await pesananPada("Bermasalah", 50200, "2026-11-11T21:00:00+07:00");
    await pesananPada("Dana Dikembalikan", 40000, "2026-11-11T08:00:00+07:00");
    await pesananPada("Menunggu Pembayaran", 45123, null);
    await pesananPada(
      "Selesai",
      99999,
      "2026-11-11T09:00:00+07:00",
      `x${email}`,
    );

    const baris = await barisMember(email);

    expect(baris.belanja.totalBelanja).toBe(230632);
    expect(baris.belanja.jumlahPesananSelesai).toBe(3);
  });

  it.each(kesamaanEmail.kasus)(
    "kesamaan email, $nama: Pesanan beremail $input.a ikut dihitung untuk Member $input.b bila emailnya sama",
    async ({ input, output }) => {
      const akhiran = randomUUID();
      const emailMember = denganAkhiran(input.b, akhiran);
      await sisipkanMember({ email: emailMember, password: PASSWORD });
      await sisipkanPesananDibayar({
        email: denganAkhiran(input.a, akhiran),
        status: "Selesai",
        totalBayar: 45123,
        waktuBayar: new Date("2026-11-11T09:00:00+07:00"),
      });

      const baris = await barisMember(emailMember);

      expect(baris.belanja.jumlahPesananSelesai).toBe(output.sama ? 1 : 0);
      expect(baris.belanja.totalBelanja).toBe(output.sama ? 45123 : 0);
    },
  );
});

describe("daftarMember: isi dan urutan (PRD §2.3 ▶ Keputusan 2026-11-17)", () => {
  it("memuat Member terverifikasi, terbaru di atas, dengan email dan tanggal daftarnya, tanpa Pendaftar dan Admin", async () => {
    const akhiran = randomUUID();
    const lama = denganAkhiran("sinta@mail.com", akhiran);
    const baru = denganAkhiran("budi@mail.com", akhiran);
    await sisipkanMember({
      email: lama,
      password: PASSWORD,
      terdaftarPada: new Date("2026-11-02T21:10:00+07:00"),
    });
    await sisipkanMember({
      email: baru,
      password: PASSWORD,
      terdaftarPada: new Date("2026-11-15T08:00:00+07:00"),
    });
    await db.insert(pendaftar).values({
      email: denganAkhiran("pendaftar@mail.com", akhiran),
      password: "hash-uji",
      kodeVerifikasi: "123456",
      kodeDikirimPada: new Date(),
    });
    await buatAdmin({
      email: denganAkhiran("admin@mail.com", akhiran),
      password: PASSWORD,
    });

    const daftar = await daftarMember({ cari: akhiran });

    expect(daftar.map((m) => m.email)).toEqual([baru, lama]);
    expect(daftar.map((m) => m.terdaftarPada)).toEqual([
      new Date("2026-11-15T08:00:00+07:00"),
      new Date("2026-11-02T21:10:00+07:00"),
    ]);
  });

  // PRD §2.3 ▶ Keputusan 2026-11-17: setiap baris menampilkan status Aktif atau Nonaktif.
  it("membawa status setiap Member: Member yang dinonaktifkan Admin nonaktif, yang lain aktif", async () => {
    const akhiran = randomUUID();
    const aktif = denganAkhiran("sinta@mail.com", akhiran);
    const nonaktif = denganAkhiran("budi@mail.com", akhiran);
    await sisipkanMember({ email: aktif, password: PASSWORD });
    await sisipkanMember({ email: nonaktif, password: PASSWORD });
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, nonaktif));
    await ubahStatusMember({ idMember: id, nonaktif: true });

    const daftar = await daftarMember({ cari: akhiran });

    expect(
      daftar.map((m) => ({ email: m.email, nonaktif: m.nonaktif })),
    ).toEqual(
      expect.arrayContaining([
        { email: aktif, nonaktif: false },
        { email: nonaktif, nonaktif: true },
      ]),
    );
  });

  it("tidak membawa password Member", async () => {
    const email = `budi-${randomUUID()}@mail.com`;
    await sisipkanMember({ email, password: PASSWORD });

    const baris = await barisMember(email);

    expect(Object.keys(baris).sort()).toEqual(
      ["belanja", "email", "id", "nonaktif", "terdaftarPada"].sort(),
    );
    expect(JSON.stringify(baris)).not.toContain(PASSWORD);
  });
});

describe("daftarMember: pencarian (PRD §2.3 ▶ Keputusan 2026-11-17)", () => {
  it('"MEMBER" menemukan member@miwe.example dan tidak menemukan Member lain yang emailnya tidak memuat "member"', async () => {
    const akhiran = randomUUID();
    const lain = [
      denganAkhiran("budi@miwe.example", akhiran),
      denganAkhiran("sinta@mail.com", akhiran),
    ];
    await sisipkanMember({
      email: "member@miwe.example",
      password: PASSWORD,
    });
    for (const email of lain)
      await sisipkanMember({ email, password: PASSWORD });

    const daftar = await daftarMember({ cari: "MEMBER" });
    const email = daftar.map((m) => m.email);

    expect(email).toContain("member@miwe.example");
    for (const e of lain) expect(email).not.toContain(e);
    for (const e of email) expect(e.toLowerCase()).toContain("member");
  });

  it('"budi" dan "BUDI" menemukan Member budi@mail.com, dan spasi di ujung kata cari diabaikan', async () => {
    const akhiran = randomUUID();
    const email = denganAkhiran("budi@mail.com", akhiran);
    await sisipkanMember({ email, password: PASSWORD });

    for (const cari of [
      `budi+${akhiran}`,
      `  BUDI+${akhiran.toUpperCase()} `,
    ]) {
      const daftar = await daftarMember({ cari });
      expect(daftar.map((m) => m.email)).toEqual([email]);
    }
  });

  it("kata cari berisi % dan _ dicocokkan sebagai huruf biasa", async () => {
    const akhiran = randomUUID();
    await sisipkanMember({
      email: denganAkhiran("budi@mail.com", akhiran),
      password: PASSWORD,
    });

    expect(await daftarMember({ cari: `%${akhiran}` })).toEqual([]);
    expect(await daftarMember({ cari: `b_di+${akhiran}` })).toEqual([]);
  });
});
