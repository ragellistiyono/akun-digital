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

import { kirimTautanAturUlangPassword } from "@/server/auth/atur-ulang-password";
import { masukMember } from "@/server/auth/masuk";
import { db, koneksi } from "@/server/db";
import { user } from "@/server/db/schema";
import { emailTiruanKe } from "@/server/email-tiruan";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";
import { ubahStatusMember } from "@/server/status-member";
import { sisipkanMember } from "@/server/uji-member";

import { aksiAturUlangPassword } from "./aksi";

// Test integrasi Server Action Atur ulang password dengan database app_test dan email tiruan dari .env.ci
// (APP_URL https://miwe.example [CONTOH]). Jam dikendalikan lewat Date palsu, sementara timer asli tetap
// jalan supaya koneksi database tidak terganggu. Baris Pengaturan toko dipakai bersama test lain yang
// berjalan bersamaan, jadi nomor WhatsApp yang dibaca email diatur lewat bacaPengaturanToko tiruan.
// PRD §7.5 ▶ Keputusan 2026-11-17, UAT-G5 langkah 8–9.
vi.mock("@/server/pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("@/server/pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

const PASSWORD_LAMA = "sandi-lama-member-1";
const PASSWORD_BARU = "sandi-baru-member-2";
const POLA_ALAMAT_TAUTAN =
  /^https:\/\/miwe\.example\/atur-ulang-password\/([A-Za-z0-9_-]{43})$/m;

function pada(jam: string) {
  vi.setSystemTime(new Date(`2026-11-17T${jam}+07:00`));
}

/** Member aktif baru dengan email unik. Hasilnya email dan id Member itu. */
async function memberBaru() {
  const email = `budi-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_LAMA });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

/** Bagian acak Tautan atur ulang password di email terakhir ke alamat itu. */
function tautanTerakhir(email: string) {
  const cocok = POLA_ALAMAT_TAUTAN.exec(
    emailTiruanKe(email).at(-1)?.teks ?? "",
  );
  if (!cocok)
    throw new Error(`Belum ada email Atur ulang password ke ${email}.`);
  return cocok[1];
}

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

/** Mengirim password baru langsung ke Server Action untuk tautan itu. Hasilnya alamat tujuan pengalihan. */
function kirimPasswordBaru(tautan: string, passwordBaru: string) {
  const data = new FormData();
  data.set("passwordBaru", passwordBaru);
  return aksiAturUlangPassword(tautan, {}, data).then(
    () => null,
    (galat: unknown) => alamatPengalihan(galat),
  );
}

function masuk(email: string, password: string) {
  return masukMember({ email, password, kepala: new Headers() });
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

describe("aksiAturUlangPassword untuk tautan milik Member nonaktif (PRD §7.5 ▶ Keputusan 2026-11-17)", () => {
  it("password baru yang dikirim langsung ke Server Action ditolak, dan password tidak berubah", async () => {
    const budi = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email: budi.email });
    const tautan = tautanTerakhir(budi.email);
    pada("10:05:00");
    await ubahStatusMember({ idMember: budi.id, nonaktif: true });

    pada("10:10:00");
    // Ditolak: Member dibawa kembali ke halaman tautan itu, yang menampilkan pesan nonaktif.
    expect(await kirimPasswordBaru(tautan, PASSWORD_BARU)).toBe(
      `/atur-ulang-password/${tautan}`,
    );

    await ubahStatusMember({ idMember: budi.id, nonaktif: false });
    expect(await masuk(budi.email, PASSWORD_BARU)).toEqual({
      hasil: "ditolak",
    });
    expect(await masuk(budi.email, PASSWORD_LAMA)).toEqual({
      hasil: "berhasil",
    });
  });

  it("setelah Member diaktifkan kembali, tautan yang masih dalam 30 menit bisa dipakai", async () => {
    const budi = await memberBaru();
    pada("10:00:00");
    await kirimTautanAturUlangPassword({ email: budi.email });
    const tautan = tautanTerakhir(budi.email);
    pada("10:05:00");
    await ubahStatusMember({ idMember: budi.id, nonaktif: true });
    pada("10:10:00");
    await kirimPasswordBaru(tautan, PASSWORD_BARU);

    pada("10:15:00");
    await ubahStatusMember({ idMember: budi.id, nonaktif: false });
    pada("10:20:00");
    expect(await kirimPasswordBaru(tautan, PASSWORD_BARU)).toBe(
      "/masuk?password=diganti",
    );

    expect(await masuk(budi.email, PASSWORD_BARU)).toEqual({
      hasil: "berhasil",
    });
  });
});
