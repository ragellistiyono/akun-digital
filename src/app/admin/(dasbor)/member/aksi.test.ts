import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { bacaSesiMember } from "@/server/auth/sesi-member";
import { db, koneksi } from "@/server/db";
import { user } from "@/server/db/schema";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { sisipkanMember } from "@/server/uji-member";

import { aksiUbahStatusMember } from "./aksi";

// Test integrasi Server Action dengan database app_test dari .env.ci. Header permintaan yang dibaca aksi lewat
// next/headers diganti dengan cookie milik pengunjung di setiap test. revalidatePath() dari next/cache hanya
// bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi diganti tiruan.
// PRD §2.3 ▶ Keputusan 2026-11-17, UAT-B3.
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

/** Header berisi cookie sesi Member itu setelah login, seperti yang dikirim browser kembali. */
async function cookieMember(email: string) {
  const { headers: kepalaRespons } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = kepalaRespons
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function memberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

async function nonaktif(id: string) {
  const [baris] = await db
    .select({ nonaktif: user.nonaktif })
    .from(user)
    .where(eq(user.id, id));
  return baris.nonaktif;
}

describe("aksiUbahStatusMember", () => {
  it("Admin menonaktifkan Member: Member itu langsung keluar, dan daftar Member dimuat ulang", async () => {
    const member = await memberBaru();
    const ponsel = await cookieMember(member.email);
    sebagaiPengunjung(await cookieAdminBaru());
    vi.mocked(revalidatePath).mockClear();

    await aksiUbahStatusMember(
      formulir({ idMember: member.id, status: "nonaktif" }),
    );

    expect(await nonaktif(member.id)).toBe(true);
    expect(await bacaSesiMember(ponsel)).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/member");
  });

  it("Admin mengaktifkan kembali Member nonaktif", async () => {
    const member = await memberBaru();
    sebagaiPengunjung(await cookieAdminBaru());
    await aksiUbahStatusMember(
      formulir({ idMember: member.id, status: "nonaktif" }),
    );

    await aksiUbahStatusMember(
      formulir({ idMember: member.id, status: "aktif" }),
    );

    expect(await nonaktif(member.id)).toBe(false);
  });

  it("Tamu tanpa sesi Admin diarahkan ke halaman login /admin, dan status Member tidak berubah", async () => {
    const member = await memberBaru();
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahStatusMember(
        formulir({ idMember: member.id, status: "nonaktif" }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await nonaktif(member.id)).toBe(false);
  });

  it("Member yang sedang login diarahkan ke halaman login /admin, dan tidak bisa menonaktifkan Member lain", async () => {
    const pelaku = await memberBaru();
    const sasaran = await memberBaru();
    sebagaiPengunjung(await cookieMember(pelaku.email));

    await expect(
      aksiUbahStatusMember(
        formulir({ idMember: sasaran.id, status: "nonaktif" }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await nonaktif(sasaran.id)).toBe(false);
  });

  it("Member yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiUbahStatusMember(
        formulir({ idMember: randomUUID(), status: "nonaktif" }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});
