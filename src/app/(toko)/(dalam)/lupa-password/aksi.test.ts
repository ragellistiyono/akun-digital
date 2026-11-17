import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { buatAdmin } from "@/server/auth/buat-admin";
import { daftarPendaftar } from "@/server/auth/pendaftaran";
import { db, koneksi } from "@/server/db";
import { user } from "@/server/db/schema";
import { emailTiruanKe } from "@/server/email-tiruan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { ubahStatusMember } from "@/server/status-member";
import { sisipkanMember } from "@/server/uji-member";

import { aksiLupaPassword } from "./aksi";

// Test integrasi Server Action Lupa password dengan database app_test dan email tiruan dari .env.ci. Jam
// dikendalikan lewat Date palsu, sementara timer asli tetap jalan supaya koneksi database tidak
// terganggu. Baris Pengaturan toko dipakai bersama test lain yang berjalan bersamaan, jadi nomor WhatsApp
// yang dibaca email diatur lewat bacaPengaturanToko tiruan. PRD §7.5 ▶ Keputusan 2026-11-17, UAT-G5.
vi.mock("@/server/pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("@/server/pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

const PASSWORD = "sandi-uji-member-123";
const PESAN_TERKIRIM =
  "Bila email ini terdaftar sebagai Member, tautan atur ulang password sudah kami kirim. Periksa juga folder spam.";

function pada(jam: string) {
  vi.setSystemTime(new Date(`2026-11-17T${jam}+07:00`));
}

function minta(email: string) {
  const data = new FormData();
  data.set("email", email);
  return aksiLupaPassword({ email: "" }, data);
}

async function memberAktifBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  return email;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp: null,
    syaratKetentuan: "",
    kebijakanPrivasi: "",
    ambangStokMenipis: 5,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await koneksi.end();
});

describe("aksiLupaPassword (PRD §7.5 ▶ Keputusan 2026-11-17)", () => {
  it("Member aktif melihat pesan terkirim dan menerima satu email Atur ulang password", async () => {
    const email = await memberAktifBaru();

    expect(await minta(email)).toEqual({ email, pesan: PESAN_TERKIRIM });
    expect(emailTiruanKe(email).map(({ subjek }) => subjek)).toEqual([
      "Atur ulang password",
    ]);
  });

  it("email yang tidak terdaftar, email Pendaftar, email Member nonaktif, dan email Admin menampilkan pesan yang sama, tanpa email Atur ulang password", async () => {
    const emailAsing = `asing-${randomUUID()}@example.test`;
    const emailPendaftar = `pendaftar-${randomUUID()}@example.test`;
    await daftarPendaftar({ email: emailPendaftar, password: PASSWORD });
    const emailNonaktif = await memberAktifBaru();
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailNonaktif));
    await ubahStatusMember({ idMember: id, nonaktif: true });
    const emailAdmin = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email: emailAdmin, password: PASSWORD });

    for (const email of [
      emailAsing,
      emailPendaftar,
      emailNonaktif,
      emailAdmin,
    ]) {
      expect(await minta(email)).toEqual({ email, pesan: PESAN_TERKIRIM });
      expect(
        emailTiruanKe(email).filter(
          ({ subjek }) => subjek === "Atur ulang password",
        ),
      ).toEqual([]);
    }
    // Email Pendaftar hanya menerima Kode verifikasi dari pendaftarannya.
    expect(emailTiruanKe(emailPendaftar)).toHaveLength(1);
    expect(emailTiruanKe(emailAsing)).toEqual([]);
    expect(emailTiruanKe(emailNonaktif)).toEqual([]);
    expect(emailTiruanKe(emailAdmin)).toEqual([]);
  });

  // UAT-G5 langkah 2.
  it("dua permintaan untuk Member aktif dengan jarak kurang dari 60 detik menampilkan pesan yang sama, tetapi hanya mengirim satu email", async () => {
    const email = await memberAktifBaru();

    pada("10:00:00");
    expect(await minta(email)).toEqual({ email, pesan: PESAN_TERKIRIM });
    pada("10:00:59");
    expect(await minta(email)).toEqual({ email, pesan: PESAN_TERKIRIM });

    expect(emailTiruanKe(email)).toHaveLength(1);
  });

  it("email kosong dan email yang tidak sah ditolak di isian, tanpa pesan terkirim", async () => {
    expect(await minta("")).toEqual({
      email: "",
      galat: "Email belum diisi. Ketik email Anda.",
    });
    expect(await minta("bukan-email")).toEqual({
      email: "bukan-email",
      galat:
        "Penulisan email tidak sah. Periksa lagi, misalnya nama@domain.com.",
    });
  });
});
