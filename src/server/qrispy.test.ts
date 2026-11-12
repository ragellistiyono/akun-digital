import { afterEach, describe, expect, it, vi } from "vitest";

import { periksaKonfigurasiQrispy, qrispyAktif } from "./qrispy";
import { qrispyTiruan } from "./qrispy-tiruan";

// ADR-0004: QRISPY_MODE memilih implementasi adaptor Qrispy. Qrispy sungguhan tidak pernah dipanggil:
// fetch diganti tiruan, dan alamat serta token di bawah hanya untuk test.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ALAMAT_DASAR = "https://qrispy.uji.example";
const TOKEN = "token-uji-bukan-token-asli-9Hc4Lp";

/** Mengisi variabel Qrispy sungguhan, dengan nilai yang bisa diganti per test. */
function isiQrispySungguhan(nilai: Record<string, string> = {}) {
  for (const [nama, isi] of Object.entries({
    QRISPY_MODE: "sungguhan",
    QRISPY_BASE_URL: ALAMAT_DASAR,
    QRISPY_API_TOKEN: TOKEN,
    QRISPY_WEBHOOK_SECRET: "secret-webhook-uji-bukan-asli",
    ...nilai,
  })) {
    vi.stubEnv(nama, isi);
  }
}

describe("qrispyAktif (ADR-0004)", () => {
  it("test dan CI memakai Qrispy tiruan dari .env.ci", () => {
    expect(process.env.QRISPY_MODE).toBe("tiruan");
    expect(qrispyAktif()).toBe(qrispyTiruan);
  });

  it("QRISPY_MODE yang kosong atau tidak dikenal menghentikan checkout dengan pesan yang jelas", () => {
    vi.stubEnv("QRISPY_MODE", "");
    expect(() => qrispyAktif()).toThrow(/QRISPY_MODE/);
    vi.stubEnv("QRISPY_MODE", "produksi");
    expect(() => qrispyAktif()).toThrow(/QRISPY_MODE/);
  });

  it("QRISPY_MODE=sungguhan memanggil QRISPY_BASE_URL dengan QRISPY_API_TOKEN", async () => {
    isiQrispySungguhan();
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        status: "success",
        data: {
          qris_id: "550e8400-e29b-41d4-a716-446655440000",
          payment_status: "pending",
          amount: 50123,
          paid_at: null,
          expired_at: "2026-03-09T14:00:00+07:00",
          payment_reference: "MIWE-7K3P9Q",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);

    const status = await qrispyAktif().cekStatusQris(
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(status).toEqual({ paymentStatus: "pending" });
    const [alamat, permintaan] = fetch.mock.calls[0];
    expect(alamat).toBe(
      `${ALAMAT_DASAR}/api/payment/qris/550e8400-e29b-41d4-a716-446655440000/status`,
    );
    expect(new Headers(permintaan?.headers).get("X-API-TOKEN")).toBe(TOKEN);
  });

  it("QRISPY_MODE=sungguhan tanpa QRISPY_API_TOKEN menghentikan checkout tanpa memanggil Qrispy", () => {
    isiQrispySungguhan({ QRISPY_API_TOKEN: " " });
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal("fetch", fetch);

    expect(() => qrispyAktif()).toThrow(/QRISPY_API_TOKEN/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("periksaKonfigurasiQrispy, saat aplikasi mulai", () => {
  it("QRISPY_MODE=sungguhan dengan alamat, token, dan webhook secret yang terisi boleh berjalan", () => {
    isiQrispySungguhan();
    expect(() => periksaKonfigurasiQrispy()).not.toThrow();
  });

  for (const [kosong, disebut] of [
    [["QRISPY_API_TOKEN"], /QRISPY_API_TOKEN/],
    [["QRISPY_WEBHOOK_SECRET"], /QRISPY_WEBHOOK_SECRET/],
    [["QRISPY_BASE_URL"], /QRISPY_BASE_URL/],
    [
      ["QRISPY_API_TOKEN", "QRISPY_WEBHOOK_SECRET"],
      /QRISPY_API_TOKEN dan QRISPY_WEBHOOK_SECRET/,
    ],
  ] as const) {
    it(`QRISPY_MODE=sungguhan dengan ${kosong.join(" dan ")} kosong ditolak dengan pesan yang menyebutnya`, () => {
      isiQrispySungguhan(Object.fromEntries(kosong.map((nama) => [nama, ""])));
      expect(() => periksaKonfigurasiQrispy()).toThrow(disebut);
    });
  }

  it("Qrispy tiruan tidak membutuhkan token", () => {
    vi.stubEnv("QRISPY_MODE", "tiruan");
    vi.stubEnv("QRISPY_API_TOKEN", "");
    vi.stubEnv("QRISPY_BASE_URL", "");
    expect(() => periksaKonfigurasiQrispy()).not.toThrow();
  });
});
