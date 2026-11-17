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
import { user } from "../db/schema";
import { emailTiruanKe } from "../email-tiruan";
import { bacaPengaturanToko } from "../pengaturan-toko";
import { ubahStatusMember } from "../status-member";
import { sisipkanMember } from "../uji-member";
import { buatAdmin } from "./buat-admin";
import {
  aturUlangPassword,
  bacaTautanAturUlangPassword,
  kirimTautanAturUlangPassword,
} from "./atur-ulang-password";
import { auth } from "./auth";
import { masukMember } from "./masuk";
import { daftarPendaftar } from "./pendaftaran";
import { bacaSesiMember } from "./sesi-member";

// Test integrasi dengan database app_test dan email tiruan dari .env.ci (EMAIL_MODE=tiruan, APP_URL
// https://miwe.example [CONTOH]). Jam dikendalikan lewat Date palsu, sementara timer asli tetap jalan supaya
// koneksi database tidak terganggu. Baris Pengaturan toko dipakai bersama test lain yang berjalan
// bersamaan, jadi nomor WhatsApp yang dibaca email diatur lewat bacaPengaturanToko tiruan.
// PRD §7.5 ▶ Keputusan 2026-11-17, §10.2 ▶ Keputusan 2026-11-17.
vi.mock("../pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("../pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

/** Nomor WhatsApp toko [CONTOH], dalam bentuk yang disimpan (tests/golden/nomor-whatsapp.json). */
const NOMOR_WHATSAPP = "6281234567890";
const PASSWORD_LAMA = "sandi-lama-member-1";
const PASSWORD_BARU = "sandi-baru-member-2";
const PESAN_EMAIL =
  "Buka tautan berikut untuk membuat password baru. Tautan berlaku 30 menit dan hanya bisa dipakai sekali. Abaikan email ini bila Anda tidak memintanya, password Anda tidak berubah.";
const POLA_ALAMAT_TAUTAN =
  /^https:\/\/miwe\.example\/atur-ulang-password\/([A-Za-z0-9_-]{43})$/;

function pada(jam: string) {
  vi.setSystemTime(new Date(`2026-11-17T${jam}+07:00`));
}

async function memberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_LAMA });
  return email;
}

/** Bagian acak Tautan atur ulang password di email terakhir ke alamat itu. */
function tautanTerakhir(email: string) {
  const surat = emailTiruanKe(email).at(-1);
  const alamat = surat?.teks
    .split("\n")
    .find((baris) => POLA_ALAMAT_TAUTAN.test(baris));
  const cocok = POLA_ALAMAT_TAUTAN.exec(alamat ?? "");
  if (!cocok)
    throw new Error(`Belum ada email Atur ulang password ke ${email}.`);
  return cocok[1];
}

function masuk(email: string, password: string) {
  return masukMember({ email, password, kepala: new Headers() });
}

/** Login Member di satu "perangkat", lalu kembalikan cookie sesinya seperti yang dikirim browser. */
async function loginDiPerangkat(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
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

describe("kirim Tautan atur ulang password (PRD §7.5, §10.2)", () => {
  it('mengirim satu email "Atur ulang password" ke Member aktif, dengan tautan di alamat toko dan footer WhatsApp', async () => {
    const email = await memberBaru();
    pada("10:00:00");

    expect(await kirimTautanAturUlangPassword({ email })).toEqual({
      hasil: "terkirim",
    });

    const terkirim = emailTiruanKe(email);
    expect(terkirim).toHaveLength(1);
    const [surat] = terkirim;
    expect(surat.dari).toBe("MIWE Digital Store <no-reply@miwe.example>");
    expect(surat.subjek).toBe("Atur ulang password");
    const baris = surat.teks.split("\n");
    expect(baris).toEqual([
      "Atur ulang password",
      "",
      PESAN_EMAIL,
      "",
      expect.stringMatching(POLA_ALAMAT_TAUTAN),
      "",
      "Butuh bantuan? Hubungi kami di WhatsApp +6281234567890 (https://wa.me/6281234567890)",
    ]);
    expect(surat.html).toContain(PESAN_EMAIL);
    expect(surat.html).toContain(`href="${baris[4]}"`);
    expect(surat.html).toContain(
      '<a href="https://wa.me/6281234567890">WhatsApp +6281234567890</a>',
    );
  });

  it("Pendaftar, Member nonaktif, Admin, dan email yang tidak terdaftar tidak menerima email apa pun", async () => {
    const emailPendaftar = `pendaftar-${randomUUID()}@example.test`;
    await daftarPendaftar({ email: emailPendaftar, password: PASSWORD_LAMA });
    const emailNonaktif = await memberBaru();
    const [{ id }] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, emailNonaktif));
    await ubahStatusMember({ idMember: id, nonaktif: true });
    const emailAdmin = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email: emailAdmin, password: PASSWORD_LAMA });
    const emailAsing = `asing-${randomUUID()}@example.test`;

    for (const email of [emailNonaktif, emailAdmin, emailAsing]) {
      expect(await kirimTautanAturUlangPassword({ email })).toEqual({
        hasil: "tidak-dikirim",
      });
      expect(emailTiruanKe(email)).toEqual([]);
    }
    expect(
      await kirimTautanAturUlangPassword({ email: emailPendaftar }),
    ).toEqual({ hasil: "tidak-dikirim" });
    // Satu-satunya email ke Pendaftar adalah Kode verifikasi dari pendaftarannya.
    expect(emailTiruanKe(emailPendaftar).map((s) => s.subjek)).toEqual([
      expect.stringMatching(/^Kode verifikasi: \d{6}$/),
    ]);
  });

  it("email yang diketik dengan huruf besar dan spasi dikirimi tautan dalam bentuk bakunya", async () => {
    const email = await memberBaru();

    await kirimTautanAturUlangPassword({ email: `  ${email.toUpperCase()} ` });

    expect(emailTiruanKe(email)).toHaveLength(1);
  });

  it("tautan baru untuk email yang sama paling cepat dikirim 60 detik setelah tautan sebelumnya", async () => {
    const email = await memberBaru();

    pada("10:00:00");
    expect(await kirimTautanAturUlangPassword({ email })).toEqual({
      hasil: "terkirim",
    });
    pada("10:00:59");
    expect(await kirimTautanAturUlangPassword({ email })).toEqual({
      hasil: "tidak-dikirim",
    });
    expect(emailTiruanKe(email)).toHaveLength(1);

    pada("10:01:00");
    expect(await kirimTautanAturUlangPassword({ email })).toEqual({
      hasil: "terkirim",
    });
    expect(emailTiruanKe(email)).toHaveLength(2);
  });
});

describe("atur ulang password lewat tautan (PRD §7.5 ▶ Keputusan 2026-11-17)", () => {
  it("tautan yang masih berlaku menyimpan password baru: password baru diterima saat login, password lama ditolak", async () => {
    const email = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email });
    const tautan = tautanTerakhir(email);

    pada("10:29:59");
    expect(await bacaTautanAturUlangPassword(tautan)).toEqual({
      keadaan: "berlaku",
    });
    expect(
      await aturUlangPassword({ tautan, passwordBaru: PASSWORD_BARU }),
    ).toEqual({ hasil: "berhasil" });

    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "ditolak" });
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "berhasil" });
  });

  it("tautan yang sudah dipakai ditolak bila dibuka lagi, dan password tidak berubah lagi", async () => {
    const email = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email });
    const tautan = tautanTerakhir(email);
    pada("10:05:00");
    await aturUlangPassword({ tautan, passwordBaru: PASSWORD_BARU });

    pada("10:06:00");
    expect(await bacaTautanAturUlangPassword(tautan)).toEqual({
      keadaan: "tidak-berlaku",
      alasan: "sudah-dipakai",
    });
    expect(
      await aturUlangPassword({
        tautan,
        passwordBaru: "sandi-ketiga-member-3",
      }),
    ).toEqual({ hasil: "tidak-berlaku", alasan: "sudah-dipakai" });
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "berhasil" });
  });

  it("tautan yang dibuka tepat 30 menit setelah dikirim ditolak karena kedaluwarsa", async () => {
    const email = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email });
    const tautan = tautanTerakhir(email);

    pada("10:30:00");
    expect(await bacaTautanAturUlangPassword(tautan)).toEqual({
      keadaan: "tidak-berlaku",
      alasan: "kedaluwarsa",
    });
    expect(
      await aturUlangPassword({ tautan, passwordBaru: PASSWORD_BARU }),
    ).toEqual({ hasil: "tidak-berlaku", alasan: "kedaluwarsa" });
    expect(await masuk(email, PASSWORD_LAMA)).toEqual({ hasil: "berhasil" });
  });

  it("tautan lama ditolak karena diganti setelah tautan baru dikirim, dan tautan baru tetap berlaku", async () => {
    const email = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email });
    const tautanLama = tautanTerakhir(email);
    pada("10:01:00");
    await kirimTautanAturUlangPassword({ email });
    const tautanBaru = tautanTerakhir(email);

    pada("10:02:00");
    expect(await bacaTautanAturUlangPassword(tautanLama)).toEqual({
      keadaan: "tidak-berlaku",
      alasan: "diganti",
    });
    expect(
      await aturUlangPassword({
        tautan: tautanLama,
        passwordBaru: PASSWORD_BARU,
      }),
    ).toEqual({ hasil: "tidak-berlaku", alasan: "diganti" });
    expect(await bacaTautanAturUlangPassword(tautanBaru)).toEqual({
      keadaan: "berlaku",
    });
  });

  it("tautan yang tidak pernah dikirim tidak dikenal", async () => {
    const tautan = "A".repeat(43);

    expect(await bacaTautanAturUlangPassword(tautan)).toEqual({
      keadaan: "tidak-dikenal",
    });
    expect(
      await aturUlangPassword({ tautan, passwordBaru: PASSWORD_BARU }),
    ).toEqual({ hasil: "tidak-dikenal" });
  });

  it("setelah password baru disimpan, semua sesi Member itu berakhir", async () => {
    const email = await memberBaru();
    const ponsel = await loginDiPerangkat(email, PASSWORD_LAMA);
    const laptop = await loginDiPerangkat(email, PASSWORD_LAMA);
    await kirimTautanAturUlangPassword({ email });

    await aturUlangPassword({
      tautan: tautanTerakhir(email),
      passwordBaru: PASSWORD_BARU,
    });

    expect(await bacaSesiMember(ponsel)).toBeNull();
    expect(await bacaSesiMember(laptop)).toBeNull();
  });

  it("email yang terkunci karena 5 kali salah password bisa langsung login dengan password baru, dan hitungan salahnya kembali ke 0", async () => {
    const email = await memberBaru();
    pada("10:00:00");
    for (let i = 1; i <= 5; i++) await masuk(email, "password-yang-salah");
    expect(await masuk(email, PASSWORD_LAMA)).toMatchObject({
      hasil: "terkunci",
    });
    await kirimTautanAturUlangPassword({ email });

    pada("10:01:00");
    await aturUlangPassword({
      tautan: tautanTerakhir(email),
      passwordBaru: PASSWORD_BARU,
    });

    // Hitungan kembali ke 0: empat kali salah lagi belum mengunci email ini.
    for (let i = 1; i <= 4; i++) await masuk(email, "password-yang-salah");
    expect(await masuk(email, PASSWORD_BARU)).toEqual({ hasil: "berhasil" });
  });
});
