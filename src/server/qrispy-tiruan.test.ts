import { afterEach, describe, expect, it, vi } from "vitest";

import { qrispyAktif } from "./qrispy";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";

// ADR-0004 dan issue T14: Qrispy tiruan menerbitkan QRIS dengan Kode unik acak Rp 1–499, waktu
// kedaluwarsa 15 menit dari sekarang, dan gambar QR contoh. Bentuk datanya mengikuti respons Qrispy di
// docs/referensi/qrispy-api.md bagian 3.
describe("Qrispy tiruan", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("menerbitkan QRIS dengan Kode unik Rp 1–499 yang ditambahkan ke nominal dari toko", async () => {
    const qris = await qrispyTiruan.buatQris({
      amount: 50000,
      paymentReference: "MIWE-7K3P9Q",
    });

    expect(qris.requestedAmount).toBe(50000);
    expect(qris.uniqueId).toBeGreaterThanOrEqual(1);
    expect(qris.uniqueId).toBeLessThanOrEqual(499);
    expect(qris.amount - qris.requestedAmount).toBe(qris.uniqueId);
  });

  it("Kode unik-nya acak", async () => {
    const kodeUnik = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const qris = await qrispyTiruan.buatQris({
        amount: 1000,
        paymentReference: "MIWE-7K3P9Q",
      });
      kodeUnik.add(qris.uniqueId);
    }
    expect(kodeUnik.size).toBeGreaterThan(1);
  });

  it("kedaluwarsa 15 menit sejak QRIS diterbitkan", async () => {
    // Contoh PRD §5.8: QRIS terbit pukul 10.00.00 dan kedaluwarsa pukul 10.15.00.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T10:00:00+07:00"));

    const qris = await qrispyTiruan.buatQris({
      amount: 50000,
      paymentReference: "MIWE-7K3P9Q",
    });

    expect(qris.expiredAt).toEqual(new Date("2026-11-11T10:15:00+07:00"));
  });

  it("setiap QRIS punya qris_id sendiri dan gambar QR contoh berupa PNG", async () => {
    const [a, b] = await Promise.all(
      [1, 2].map(() =>
        qrispyTiruan.buatQris({
          amount: 50000,
          paymentReference: "MIWE-7K3P9Q",
        }),
      ),
    );

    expect(a.qrisId).not.toBe(b.qrisId);
    expect(a.gambarQr).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
    const png = Buffer.from(a.gambarQr.split(",")[1], "base64");
    // Tanda tangan berkas PNG.
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });
});

// Issue T16 dan docs/referensi/qrispy-api.md bagian 4: Qrispy tiruan menjawab cek status QRIS. QRIS
// berstatus `paid` setelah pembayarannya dipicu, dengan nominal yang diatur pemicunya sebagai `amount`.
describe("cek status Qrispy tiruan", () => {
  it("QRIS yang belum dibayar dijawab pending", async () => {
    const qris = await qrispyTiruan.buatQris({
      amount: 50000,
      paymentReference: "MIWE-7K3P9Q",
    });

    expect(await qrispyTiruan.cekStatusQris(qris.qrisId)).toEqual({
      paymentStatus: "pending",
    });
  });

  it("setelah pembayaran Total bayar dipicu, QRIS dijawab paid dengan nominal dan waktu bayarnya", async () => {
    const qris = await qrispyTiruan.buatQris({
      amount: 50000,
      paymentReference: "MIWE-7K3P9Q",
    });
    const waktuBayar = new Date("2026-11-11T10:05:00+07:00");

    bayarQrisTiruan(
      { qrisId: qris.qrisId, amount: qris.amount },
      { sekarang: waktuBayar },
    );

    expect(await qrispyTiruan.cekStatusQris(qris.qrisId)).toEqual({
      paymentStatus: "paid",
      amount: qris.amount,
      paidAt: waktuBayar,
    });
  });

  it("nominal yang dibayar bisa kurang dari Total bayar", async () => {
    const qris = await qrispyTiruan.buatQris({
      amount: 45000,
      paymentReference: "MIWE-7K3P9Q",
    });

    bayarQrisTiruan({ qrisId: qris.qrisId, amount: 45000 });

    expect(await qrispyTiruan.cekStatusQris(qris.qrisId)).toMatchObject({
      paymentStatus: "paid",
      amount: 45000,
    });
  });
});

// ADR-0004: QRISPY_MODE memilih implementasi. .env.ci memakai tiruan.
describe("qrispyAktif", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("memakai Qrispy tiruan bila QRISPY_MODE=tiruan", () => {
    vi.stubEnv("QRISPY_MODE", "tiruan");
    expect(qrispyAktif()).toBe(qrispyTiruan);
  });

  it("QRISPY_MODE yang kosong atau tidak dikenal menghentikan checkout dengan pesan yang jelas", () => {
    vi.stubEnv("QRISPY_MODE", "");
    expect(() => qrispyAktif()).toThrow(/QRISPY_MODE/);
    vi.stubEnv("QRISPY_MODE", "sungguhan");
    expect(() => qrispyAktif()).toThrow(/QRISPY_MODE/);
  });
});
