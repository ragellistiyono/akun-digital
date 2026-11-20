import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { db, koneksi } from "@/server/db";
import { user } from "@/server/db/schema";
import { bacaSaldoMember, riwayatSaldoMember } from "@/server/saldo";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { sisipkanMember } from "@/server/uji-member";

import { aksiUbahSaldo } from "./aksi";

// Test integrasi Server Action "Tambah saldo" dan "Kurangi saldo" (issue T76, PRD §15.6, UAT-O1) dengan database
// app_test dari .env.ci. Header permintaan diganti cookie pengunjung di setiap test, dan revalidatePath() diganti
// tiruan karena hanya berjalan di dalam Next.js.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PASSWORD = "sandi-uji-member-123";

afterAll(async () => {
  await koneksi.end();
});

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

async function memberBaru() {
  const email = `budi-${randomUUID()}@mail.com`;
  await sisipkanMember({ email, password: PASSWORD });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

const AWAL = { isian: { nominal: "", keterangan: "" } };

/** Mengirim form ubah saldo pada tahap itu. */
function kirim(
  idMember: string,
  isian: {
    aksi: "tambah" | "kurangi";
    nominal: string;
    keterangan: string;
    tahap: "periksa" | "jalankan";
  },
) {
  return aksiUbahSaldo(AWAL, formulir({ idMember, ...isian }));
}

const saldo = async (id: string) => (await bacaSaldoMember(id))?.saldo;

describe("aksiUbahSaldo (PRD §15.6, UAT-O1)", () => {
  it("Tambah saldo tanpa keterangan ditolak dengan pesan di isian keterangan, dan saldo tetap", async () => {
    const { id } = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const hasil = await kirim(id, {
      aksi: "tambah",
      nominal: "5000",
      keterangan: "",
      tahap: "periksa",
    });

    expect(hasil.penegasan).toBeUndefined();
    expect(hasil.galat?.keterangan).toMatch(/^Keterangan belum diisi\./);
    expect(hasil.isian).toEqual({ nominal: "5000", keterangan: "" });
    expect(await saldo(id)).toBe(0);
  });

  it('isian yang sah meminta penegasan "Tambah Rp 5.000 ke saldo <email>?" tanpa mengubah saldo; penegasan yang disetujui menambah saldo', async () => {
    const { email, id } = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    const isian = {
      aksi: "tambah",
      nominal: "5000",
      keterangan: "Uji tambah saldo",
    } as const;

    const penegasan = await kirim(id, { ...isian, tahap: "periksa" });

    expect(penegasan.penegasan).toBe(`Tambah Rp 5.000 ke saldo ${email}?`);
    expect(await saldo(id)).toBe(0);

    vi.mocked(revalidatePath).mockClear();
    const selesai = await kirim(id, { ...isian, tahap: "jalankan" });

    expect(selesai).toEqual({ ...AWAL, selesai: true });
    expect(await saldo(id)).toBe(5000);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/member/${id}`);
  });

  it('penegasan Kurangi saldo berbunyi "Kurangi Rp 2.000 dari saldo <email>?"', async () => {
    const { email, id } = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await kirim(id, {
      aksi: "tambah",
      nominal: "5000",
      keterangan: "Uji tambah saldo",
      tahap: "jalankan",
    });

    const hasil = await kirim(id, {
      aksi: "kurangi",
      nominal: "2.000",
      keterangan: "Uji kurangi",
      tahap: "periksa",
    });

    expect(hasil.penegasan).toBe(`Kurangi Rp 2.000 dari saldo ${email}?`);
  });

  it("Kurangi saldo Rp 1 lebih besar dari saldo ditolak dengan pesan PRD, dan saldo tetap", async () => {
    const { email, id } = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await kirim(id, {
      aksi: "tambah",
      nominal: "5000",
      keterangan: "Uji tambah saldo",
      tahap: "jalankan",
    });

    for (const tahap of ["periksa", "jalankan"] as const) {
      const hasil = await kirim(id, {
        aksi: "kurangi",
        nominal: "5001",
        keterangan: "Uji kurangi",
        tahap,
      });

      expect(hasil.penegasan).toBeUndefined();
      expect(hasil.galat?.nominal).toBe(
        `Saldo tidak cukup untuk dikurangi Rp 5.001. Saldo ${email} sekarang Rp 5.000.`,
      );
    }
    expect(await saldo(id)).toBe(5000);
    expect(
      (await riwayatSaldoMember({ idMember: id, halaman: 1 })).jumlah,
    ).toBe(1);
  });

  it("nominal dan keterangan yang salah sekaligus ditolak dengan dua pesan", async () => {
    const { id } = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());

    const hasil = await kirim(id, {
      aksi: "kurangi",
      nominal: "abc",
      keterangan: "",
      tahap: "jalankan",
    });

    expect(hasil.galat?.nominal).toMatch(/^Nominal harus rupiah bulat/);
    expect(hasil.galat?.keterangan).toMatch(/^Keterangan belum diisi\./);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login /admin, dan saldo tidak berubah", async () => {
    const { id } = await memberBaru();
    sebagaiPengunjung(new Headers());

    await expect(
      kirim(id, {
        aksi: "tambah",
        nominal: "5000",
        keterangan: "Uji tambah saldo",
        tahap: "jalankan",
      }),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await saldo(id)).toBe(0);
  });

  it("Member yang sedang login diarahkan ke halaman login /admin dan tidak bisa menambah saldonya sendiri", async () => {
    const { email, id } = await memberBaru();
    const { headers: kepala } = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    });
    sebagaiPengunjung(
      new Headers({
        cookie: kepala
          .getSetCookie()
          .map((baris) => baris.split(";")[0])
          .join("; "),
      }),
    );

    await expect(
      kirim(id, {
        aksi: "tambah",
        nominal: "5000",
        keterangan: "Uji tambah saldo",
        tahap: "jalankan",
      }),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await saldo(id)).toBe(0);
  });

  it("Member yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      kirim(randomUUID(), {
        aksi: "tambah",
        nominal: "5000",
        keterangan: "Koreksi",
        tahap: "periksa",
      }),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});
