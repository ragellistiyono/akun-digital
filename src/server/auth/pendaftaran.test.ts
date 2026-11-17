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

import { db, koneksi } from "../db";
import { pendaftar } from "../db/schema";
import { emailTiruanKe } from "../email-tiruan";
import { bacaPengaturanToko } from "../pengaturan-toko";
import { sisipkanMember } from "../uji-member";
import { auth } from "./auth";
import { buatAdmin } from "./buat-admin";
import { masukMember } from "./masuk";
import { daftarPendaftar, kirimUlangKodeVerifikasi } from "./pendaftaran";

// Test integrasi dengan database app_test dan email tiruan dari .env.ci (EMAIL_MODE=tiruan). Jam
// dikendalikan lewat Date palsu, sementara timer asli tetap jalan supaya koneksi database tidak
// terganggu. Baris Pengaturan toko dipakai bersama test lain yang berjalan bersamaan, jadi nomor
// WhatsApp yang dibaca email diatur lewat bacaPengaturanToko tiruan.
vi.mock("../pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("../pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

/** Nomor WhatsApp toko [CONTOH], dalam bentuk yang disimpan (tests/golden/nomor-whatsapp.json). */
const NOMOR_WHATSAPP = "6281234567890";
const PASSWORD = "sandi-uji-daftar-1";
const PASSWORD_LAIN = "sandi-uji-daftar-2";
const PESAN_KODE =
  "Masukkan kode ini untuk menyelesaikan pendaftaran Member MIWE Digital Store. Kode berlaku 10 menit. Abaikan email ini bila Anda tidak mendaftar.";

function pada(jam: string) {
  vi.setSystemTime(new Date(`2026-11-11T${jam}+07:00`));
}

const emailBaru = () => `pendaftar-${randomUUID()}@example.test`;

/** Kode verifikasi dari subjek email "Kode verifikasi: <kode>" (PRD §10.2). */
function kodeDari(subjek: string) {
  const cocok = /^Kode verifikasi: (\d{6})$/.exec(subjek);
  if (!cocok)
    throw new Error(`Subjek "${subjek}" bukan email Kode verifikasi.`);
  return cocok[1];
}

/** Password Pendaftar yang tersimpan cocok dengan password itu. */
async function passwordTersimpan(email: string, password: string) {
  const [baris] = await db
    .select({ hash: pendaftar.password })
    .from(pendaftar)
    .where(eq(pendaftar.email, email));
  const konteks = await auth.$context;
  return konteks.password.verify({ hash: baris.hash, password });
}

async function kodeTersimpan(email: string) {
  const [baris] = await db
    .select({ kode: pendaftar.kodeVerifikasi })
    .from(pendaftar)
    .where(eq(pendaftar.email, email));
  return baris.kode;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp: NOMOR_WHATSAPP,
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

describe("daftar sebagai Pendaftar (PRD §7.2, §7.3, §10.2)", () => {
  it('mengirim satu email "Kode verifikasi: <kode>" 6 digit ke email itu, dengan isi dan footer WhatsApp', async () => {
    const email = emailBaru();
    pada("10:00:00");

    expect(await daftarPendaftar({ email, password: PASSWORD })).toEqual({
      hasil: "kode-terkirim",
    });

    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(1);
    const [surat] = terkirim;
    const kode = kodeDari(surat.subjek);
    expect(surat.dari).toBe("MIWE Digital Store <no-reply@miwe.example>");
    expect(surat.teks.split("\n")).toEqual([
      "Kode verifikasi",
      "",
      PESAN_KODE,
      "",
      kode,
      "",
      "Butuh bantuan? Hubungi kami di WhatsApp +6281234567890 (https://wa.me/6281234567890)",
    ]);
    expect(surat.html).toContain(PESAN_KODE);
    expect(surat.html).toContain(kode);
    expect(surat.html).toContain(
      '<a href="https://wa.me/6281234567890">WhatsApp +6281234567890</a>',
    );
  });

  it("selama nomor WhatsApp belum diisi, email Kode verifikasi tidak memuat footer WhatsApp", async () => {
    vi.mocked(bacaPengaturanToko).mockResolvedValue({
      nomorWhatsapp: null,
      syaratKetentuan: "",
      kebijakanPrivasi: "",
      ambangStokMenipis: 5,
    });
    const email = emailBaru();

    await daftarPendaftar({ email, password: PASSWORD });

    const [surat] = emailTiruanKe(email);
    expect(surat.teks).not.toContain("WhatsApp");
    expect(surat.html).not.toContain("WhatsApp");
  });

  it("email diketik dengan huruf besar dan spasi disimpan dan dikirimi kode dalam bentuk bakunya", async () => {
    const email = emailBaru();

    await daftarPendaftar({
      email: `  ${email.toUpperCase()} `,
      password: PASSWORD,
    });

    expect(emailTiruanKe(email)).toHaveLength(1);
    expect(await passwordTersimpan(email, PASSWORD)).toBe(true);
  });

  // UAT-G3 langkah 2 dan PRD §7.5 ▶ Keputusan 2026-11-17: Pendaftar belum bisa login.
  it("Pendaftar yang login dengan email dan password-nya ditolak seperti password salah", async () => {
    const email = emailBaru();
    await daftarPendaftar({ email, password: PASSWORD });

    expect(
      await masukMember({ email, password: PASSWORD, kepala: new Headers() }),
    ).toEqual({ hasil: "ditolak" });
  });
});

describe("pendaftaran ulang Pendaftar (PRD §7.2 ▶ Keputusan 2026-11-17)", () => {
  it("30 detik setelah kode terakhir ditolak dengan sisa 30 detik, tanpa mengubah password dan tanpa email baru", async () => {
    const email = emailBaru();
    pada("10:00:00");
    await daftarPendaftar({ email, password: PASSWORD });
    const kodeLama = await kodeTersimpan(email);

    pada("10:00:30");
    expect(await daftarPendaftar({ email, password: PASSWORD_LAIN })).toEqual({
      hasil: "tunggu",
      tungguDetik: 30,
    });

    expect(emailTiruanKe(email)).toHaveLength(1);
    expect(await passwordTersimpan(email, PASSWORD)).toBe(true);
    expect(await kodeTersimpan(email)).toBe(kodeLama);
  });

  it("setelah 60 detik menyimpan password baru dan mengirim kode baru yang menggantikan kode lama", async () => {
    const email = emailBaru();
    pada("10:00:00");
    await daftarPendaftar({ email, password: PASSWORD });

    pada("10:20:00");
    expect(await daftarPendaftar({ email, password: PASSWORD_LAIN })).toEqual({
      hasil: "kode-terkirim",
    });

    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(2);
    expect(await passwordTersimpan(email, PASSWORD_LAIN)).toBe(true);
    expect(await passwordTersimpan(email, PASSWORD)).toBe(false);
    expect(await kodeTersimpan(email)).toBe(kodeDari(terkirim[1].subjek));
  });
});

describe("email yang sudah terdaftar (PRD §7.2 ▶ Keputusan 2026-11-17, UAT-G3 langkah 5)", () => {
  it("email Member ditolak, juga bila ditulis huruf besar, dan tidak ada email yang terkirim", async () => {
    const email = `member-${randomUUID()}@example.test`;
    await sisipkanMember({ email, password: PASSWORD });

    for (const diketik of [email, email.toUpperCase()]) {
      expect(
        await daftarPendaftar({ email: diketik, password: PASSWORD_LAIN }),
      ).toEqual({
        hasil: "email-terdaftar",
      });
    }
    expect(emailTiruanKe(email)).toHaveLength(0);
  });

  it("email Admin ditolak, juga bila ditulis huruf besar, dan tidak ada email yang terkirim", async () => {
    const email = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email, password: PASSWORD });

    for (const diketik of [email, email.toUpperCase()]) {
      expect(
        await daftarPendaftar({ email: diketik, password: PASSWORD_LAIN }),
      ).toEqual({
        hasil: "email-terdaftar",
      });
    }
    expect(emailTiruanKe(email)).toHaveLength(0);
  });
});

describe('"Kirim ulang kode" (PRD §7.7)', () => {
  it("pada detik ke-59 ditolak dengan sisa 1 detik, dan pada detik ke-60 mengirim kode baru", async () => {
    const email = emailBaru();
    pada("10:00:00");
    await daftarPendaftar({ email, password: PASSWORD });
    const kodeLama = await kodeTersimpan(email);

    pada("10:00:59");
    expect(await kirimUlangKodeVerifikasi({ email })).toEqual({
      hasil: "tunggu",
      tungguDetik: 1,
    });
    expect(emailTiruanKe(email)).toHaveLength(1);
    expect(await kodeTersimpan(email)).toBe(kodeLama);

    pada("10:01:00");
    expect(await kirimUlangKodeVerifikasi({ email })).toEqual({
      hasil: "kode-terkirim",
    });
    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(2);
    expect(await kodeTersimpan(email)).toBe(kodeDari(terkirim[1].subjek));
    expect(await passwordTersimpan(email, PASSWORD)).toBe(true);
  });

  it("jeda dihitung dari kode terakhir: kirim ulang 30 detik setelah kirim ulang sebelumnya ditolak", async () => {
    const email = emailBaru();
    pada("10:00:00");
    await daftarPendaftar({ email, password: PASSWORD });
    pada("10:01:00");
    await kirimUlangKodeVerifikasi({ email });

    pada("10:01:30");
    expect(await kirimUlangKodeVerifikasi({ email })).toEqual({
      hasil: "tunggu",
      tungguDetik: 30,
    });
  });

  it("email yang bukan Pendaftar tidak dikirimi kode", async () => {
    const email = emailBaru();

    expect(await kirimUlangKodeVerifikasi({ email })).toEqual({
      hasil: "bukan-pendaftar",
    });
    expect(emailTiruanKe(email)).toHaveLength(0);
  });
});
