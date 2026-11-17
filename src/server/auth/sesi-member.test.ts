import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { koneksi } from "../db";
import { sisipkanMember } from "../uji-member";
import { auth } from "./auth";
import { buatAdmin } from "./buat-admin";
import { bacaSesiMember } from "./sesi-member";

// Test integrasi dengan database app_test (.env.ci). Jam dikendalikan lewat Date palsu, sementara
// timer asli tetap jalan supaya koneksi database tidak terganggu.
const PASSWORD = "sandi-uji-member-123";

async function cookieSetelahLogin(email: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  // Ambil pasangan nama=nilai cookie sesi dari Set-Cookie, seperti yang dikirim browser kembali.
  const cookie = headers
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function memberBaruLoginPukul08() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD });
  vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
  return { email, kepala: await cookieSetelahLogin(email) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await koneksi.end();
});

describe("sesi Member (PRD §7.5 ▶ Keputusan 2026-11-11)", () => {
  it("masih berlaku 29 hari 23 jam setelah login", async () => {
    const { email, kepala } = await memberBaruLoginPukul08();

    vi.setSystemTime(new Date("2026-12-11T07:00:00+07:00"));
    const sesi = await bacaSesiMember(kepala);
    expect(sesi?.user.email).toBe(email);
  });

  it("sudah berakhir tepat 30 hari setelah login", async () => {
    const { kepala } = await memberBaruLoginPukul08();

    vi.setSystemTime(new Date("2026-12-11T08:00:00+07:00"));
    expect(await bacaSesiMember(kepala)).toBeNull();
  });

  it("tidak diperpanjang walaupun Member aktif memakai toko", async () => {
    const { kepala } = await memberBaruLoginPukul08();

    for (const tanggal of ["2026-11-20", "2026-12-01", "2026-12-10"]) {
      vi.setSystemTime(new Date(`${tanggal}T12:00:00+07:00`));
      expect(await bacaSesiMember(kepala)).not.toBeNull();
    }

    vi.setSystemTime(new Date("2026-12-11T08:00:00+07:00"));
    expect(await bacaSesiMember(kepala)).toBeNull();
  });

  it("sesi Admin bukan sesi Member", async () => {
    const email = `admin-${randomUUID()}@example.test`;
    await buatAdmin({ email, password: PASSWORD });
    vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
    const kepala = await cookieSetelahLogin(email);

    expect(await bacaSesiMember(kepala)).toBeNull();
  });

  it("tanpa cookie sesi, tidak ada Member yang login", async () => {
    expect(await bacaSesiMember(new Headers())).toBeNull();
  });
});
