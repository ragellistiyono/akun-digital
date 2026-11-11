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
import { auth } from "./auth";
import { buatAdmin } from "./buat-admin";
import { wajibSesiAdmin } from "./sesi-admin";

// Test integrasi dengan database app_test (.env.ci). Jam dikendalikan lewat Date palsu, sementara
// timer asli tetap jalan supaya koneksi database tidak terganggu.
const PASSWORD = "sandi-uji-admin-123";

function emailAcak() {
  return `admin-${randomUUID()}@miwe.example`;
}

async function loginAdmin(email: string) {
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

function arahKeLoginAdmin(galat: unknown) {
  return (
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    typeof galat.digest === "string" &&
    galat.digest.split(";")[2] === "/admin"
  );
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

describe("sesi Admin (PRD §2.2 ▶ Keputusan 2026-11-11)", () => {
  it("masih berlaku sedetik sebelum 12 jam sejak login", async () => {
    const email = emailAcak();
    await buatAdmin({ email, password: PASSWORD });

    vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
    const kepala = await loginAdmin(email);

    vi.setSystemTime(new Date("2026-11-11T19:59:59+07:00"));
    const sesi = await wajibSesiAdmin(kepala);
    expect(sesi.user.email).toBe(email);
  });

  it("ditolak tepat 12 jam sejak login, dan Admin diarahkan ke halaman login", async () => {
    const email = emailAcak();
    await buatAdmin({ email, password: PASSWORD });

    vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
    const kepala = await loginAdmin(email);

    vi.setSystemTime(new Date("2026-11-11T20:00:00+07:00"));
    await expect(wajibSesiAdmin(kepala)).rejects.toSatisfy(arahKeLoginAdmin);
  });

  it("ditolak lebih dari 12 jam sejak login, dan Admin diarahkan ke halaman login", async () => {
    const email = emailAcak();
    await buatAdmin({ email, password: PASSWORD });

    vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
    const kepala = await loginAdmin(email);

    vi.setSystemTime(new Date("2026-11-11T21:30:00+07:00"));
    await expect(wajibSesiAdmin(kepala)).rejects.toSatisfy(arahKeLoginAdmin);
  });

  it("tidak diperpanjang walaupun Admin aktif memakai dasbor admin", async () => {
    const email = emailAcak();
    await buatAdmin({ email, password: PASSWORD });

    vi.setSystemTime(new Date("2026-11-11T08:00:00+07:00"));
    const kepala = await loginAdmin(email);

    for (const jam of ["10:00", "14:00", "18:00", "19:59"]) {
      vi.setSystemTime(new Date(`2026-11-11T${jam}:00+07:00`));
      await wajibSesiAdmin(kepala);
    }

    vi.setSystemTime(new Date("2026-11-11T20:00:00+07:00"));
    await expect(wajibSesiAdmin(kepala)).rejects.toSatisfy(arahKeLoginAdmin);
  });

  it("tanpa cookie sesi, pengunjung diarahkan ke halaman login", async () => {
    await expect(wajibSesiAdmin(new Headers())).rejects.toSatisfy(
      arahKeLoginAdmin,
    );
  });
});
