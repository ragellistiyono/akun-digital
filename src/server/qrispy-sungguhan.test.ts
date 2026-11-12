import { describe, expect, it, vi } from "vitest";

import { GalatQrispy, qrispySungguhan } from "./qrispy-sungguhan";

// Test unit Qrispy sungguhan (ADR-0004). Qrispy sungguhan tidak pernah dipanggil: fetch disuntikkan dan
// menjawab dengan contoh respons dari docs/referensi/qrispy-api.md. Alamat dan token di bawah hanya untuk
// test dan bukan milik Qrispy.
const ALAMAT_DASAR = "https://qrispy.uji.example";
const TOKEN = "token-uji-bukan-token-asli-9Hc4Lp";

/** fetch tiruan yang selalu memberi jawaban itu dan mencatat setiap permintaan. */
function fetchTiruan(jawaban: () => Response) {
  return vi.fn<typeof fetch>(async () => jawaban());
}

/** Contoh respons `201 Created` membuat QRIS (docs/referensi/qrispy-api.md bagian 3). */
const QRIS_BARU_201 = {
  status: "success",
  data: {
    qris_id: "550e8400-e29b-41d4-a716-446655440000",
    qris_image_url:
      "https://api.qrispy.id/api/public/qris/550e8400-e29b-41d4-a716-446655440000.png",
    // Contoh di referensi dipotong dengan "..."; di sini diganti potongan PNG base64 yang utuh.
    qris_image_base64: "data:image/png;base64,iVBORw0KGgo=",
    amount: 50123,
    requested_amount: 50000,
    unique_id: 123,
    expired_at: "2026-03-09T14:00:00+07:00",
    expires_in_seconds: 900,
    checkout_url:
      "https://qrispy.id/payment/550e8400-e29b-41d4-a716-446655440000",
    payment_reference: "MIWE-7K3P9Q",
    return_url: null,
  },
};

describe("Qrispy sungguhan: membuat QRIS (docs/referensi/qrispy-api.md bagian 3)", () => {
  it("mengirim X-API-TOKEN, Content-Type, dan Accept, dengan body amount dan payment_reference tanpa return_url", async () => {
    const fetch = fetchTiruan(() =>
      Response.json(QRIS_BARU_201, { status: 201 }),
    );
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch,
    });

    await qrispy.buatQris({ amount: 50000, paymentReference: "MIWE-7K3P9Q" });

    expect(fetch).toHaveBeenCalledOnce();
    const [alamat, permintaan] = fetch.mock.calls[0];
    expect(alamat).toBe(`${ALAMAT_DASAR}/api/payment/qris/generate`);
    expect(permintaan?.method).toBe("POST");
    const kepala = new Headers(permintaan?.headers);
    expect(kepala.get("X-API-TOKEN")).toBe(TOKEN);
    expect(kepala.get("Content-Type")).toBe("application/json");
    expect(kepala.get("Accept")).toBe("application/json");
    expect(JSON.parse(String(permintaan?.body))).toEqual({
      amount: 50000,
      payment_reference: "MIWE-7K3P9Q",
    });
  });

  it("contoh respons 201 menjadi Kode unik Rp 123, Total bayar Rp 50.123, dan kedaluwarsa 9 Maret 2026 pukul 14.00 WIB", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() => Response.json(QRIS_BARU_201, { status: 201 })),
    });

    const qris = await qrispy.buatQris({
      amount: 50000,
      paymentReference: "MIWE-7K3P9Q",
    });

    expect(qris).toEqual({
      qrisId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 50123,
      requestedAmount: 50000,
      uniqueId: 123,
      expiredAt: new Date("2026-03-09T07:00:00Z"),
      gambarQr: "data:image/png;base64,iVBORw0KGgo=",
    });
  });
});

/**
 * Respons status QRIS (docs/referensi/qrispy-api.md bagian 4) dengan payment_status dan paid_at itu.
 * Contoh di referensi berstatus pending; waktu bayar untuk status paid diambil dari contoh webhook di
 * bagian 6.
 */
function statusQris(paymentStatus: string, paidAt: string | null = null) {
  return {
    status: "success",
    data: {
      qris_id: "550e8400-e29b-41d4-a716-446655440000",
      payment_status: paymentStatus,
      amount: 50123,
      paid_at: paidAt,
      expired_at: "2026-03-09T14:00:00+07:00",
      payment_reference: "MIWE-7K3P9Q",
    },
  };
}

describe("Qrispy sungguhan: cek status (docs/referensi/qrispy-api.md bagian 4)", () => {
  it("menanyakan status lewat GET dengan ketiga header", async () => {
    const fetch = fetchTiruan(() => Response.json(statusQris("pending")));
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch,
    });

    await qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000");

    const [alamat, permintaan] = fetch.mock.calls[0];
    expect(alamat).toBe(
      `${ALAMAT_DASAR}/api/payment/qris/550e8400-e29b-41d4-a716-446655440000/status`,
    );
    expect(permintaan?.method).toBe("GET");
    const kepala = new Headers(permintaan?.headers);
    expect(kepala.get("X-API-TOKEN")).toBe(TOKEN);
    expect(kepala.get("Content-Type")).toBe("application/json");
    expect(kepala.get("Accept")).toBe("application/json");
  });

  it("paid menjadi status paid dengan amount sebagai nominal diterima dan paid_at sebagai waktu bayar", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json(statusQris("paid", "2026-03-09T13:45:21+07:00")),
      ),
    });

    expect(
      await qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
    ).toEqual({
      paymentStatus: "paid",
      amount: 50123,
      paidAt: new Date("2026-03-09T06:45:21Z"),
    });
  });

  for (const paymentStatus of ["pending", "expired", "cancelled"] as const) {
    it(`${paymentStatus} menjadi status ${paymentStatus} tanpa nominal maupun waktu bayar`, async () => {
      const qrispy = qrispySungguhan({
        alamatDasar: ALAMAT_DASAR,
        token: TOKEN,
        fetch: fetchTiruan(() => Response.json(statusQris(paymentStatus))),
      });

      expect(
        await qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
      ).toEqual({ paymentStatus });
    });
  }
});

describe("Qrispy sungguhan: membatalkan QRIS (docs/referensi/qrispy-api.md bagian 5)", () => {
  it("meminta pembatalan lewat POST dengan ketiga header, dan contoh respons 200 berarti pembatalan diterima", async () => {
    const fetch = fetchTiruan(() =>
      Response.json({
        status: "success",
        message: "QRIS cancelled successfully",
      }),
    );
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch,
    });

    await expect(
      qrispy.batalkanQris("550e8400-e29b-41d4-a716-446655440000"),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledOnce();
    const [alamat, permintaan] = fetch.mock.calls[0];
    expect(alamat).toBe(
      `${ALAMAT_DASAR}/api/payment/qris/550e8400-e29b-41d4-a716-446655440000/cancel`,
    );
    expect(permintaan?.method).toBe("POST");
    const kepala = new Headers(permintaan?.headers);
    expect(kepala.get("X-API-TOKEN")).toBe(TOKEN);
    expect(kepala.get("Content-Type")).toBe("application/json");
    expect(kepala.get("Accept")).toBe("application/json");
  });
});

/**
 * Respons error Qrispy (docs/referensi/qrispy-api.md bagian 7). Pesan 400 diambil dari contoh batas nominal
 * di bagian 3; pesan lainnya sintetis, karena referensi tidak memberi contohnya.
 */
const RESPONS_ERROR = [
  [400, "Maximum QRIS amount is Rp 499,000 for security purposes."],
  [401, "Invalid API token."],
  [429, "Too many requests."],
  [500, "Internal server error."],
] as const;

describe("Qrispy sungguhan: respons error (docs/referensi/qrispy-api.md bagian 7)", () => {
  for (const [kode, pesan] of RESPONS_ERROR) {
    it(`HTTP ${kode} saat membuat QRIS menjadi GalatQrispy dengan kode dan pesan Qrispy, tanpa token`, async () => {
      const qrispy = qrispySungguhan({
        alamatDasar: ALAMAT_DASAR,
        token: TOKEN,
        fetch: fetchTiruan(() =>
          Response.json({ status: "error", message: pesan }, { status: kode }),
        ),
      });

      const galat = await qrispy
        .buatQris({ amount: 500000, paymentReference: "MIWE-7K3P9Q" })
        .catch((g: unknown) => g);

      expect(galat).toBeInstanceOf(GalatQrispy);
      expect(galat).toMatchObject({ statusHttp: kode });
      expect(String(galat)).toContain(`HTTP ${kode}`);
      expect(String(galat)).toContain(pesan);
      expect(String(galat)).not.toContain(TOKEN);
    });
  }

  it("HTTP 429 saat cek status menjadi GalatQrispy", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json(
          { status: "error", message: "Too many requests." },
          { status: 429 },
        ),
      ),
    });

    await expect(
      qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toMatchObject({ name: "GalatQrispy", statusHttp: 429 });
  });

  it("HTTP 400 saat membatalkan QRIS menjadi GalatQrispy", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json(
          { status: "error", message: "QRIS cannot be cancelled." },
          { status: 400 },
        ),
      ),
    });

    await expect(
      qrispy.batalkanQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toMatchObject({ name: "GalatQrispy", statusHttp: 400 });
  });

  it("HTTP 500 dengan body yang bukan JSON tetap menjadi GalatQrispy dengan potongan isinya", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(
        () => new Response("<html>502 Bad Gateway</html>", { status: 500 }),
      ),
    });

    const galat = await qrispy
      .buatQris({ amount: 50000, paymentReference: "MIWE-7K3P9Q" })
      .catch((g: unknown) => g);

    expect(galat).toBeInstanceOf(GalatQrispy);
    expect(galat).toMatchObject({ statusHttp: 500 });
    expect(String(galat)).toContain("502 Bad Gateway");
  });
});

describe("Qrispy sungguhan: respons yang tidak cocok skema", () => {
  it("respons membuat QRIS berbentuk draf awal, tanpa requested_amount dan unique_id (referensi bagian 8), ditolak sebagai GalatQrispy", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json({
          status: "success",
          data: {
            qris_id: "550e8400-e29b-41d4-a716-446655440000",
            qris_image_base64: "data:image/png;base64,iVBORw0KGgo=",
            amount: 50000,
            expired_at: "2026-03-09T14:00:00+07:00",
          },
        }),
      ),
    });

    const galat = await qrispy
      .buatQris({ amount: 50000, paymentReference: "MIWE-7K3P9Q" })
      .catch((g: unknown) => g);

    expect(galat).toBeInstanceOf(GalatQrispy);
    expect(galat).toMatchObject({ statusHttp: 200 });
    expect(String(galat)).toContain("tidak cocok");
    expect(String(galat)).not.toContain(TOKEN);
  });

  it("gambar QR yang bukan data URL PNG ditolak", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json(
          {
            ...QRIS_BARU_201,
            data: { ...QRIS_BARU_201.data, qris_image_base64: "iVBORw0KGgo=" },
          },
          { status: 201 },
        ),
      ),
    });

    await expect(
      qrispy.buatQris({ amount: 50000, paymentReference: "MIWE-7K3P9Q" }),
    ).rejects.toBeInstanceOf(GalatQrispy);
  });

  it("payment_status di luar pending, paid, expired, dan cancelled ditolak", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() => Response.json(statusQris("refunded"))),
    });

    await expect(
      qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(GalatQrispy);
  });

  it("status paid tanpa paid_at ditolak", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() => Response.json(statusQris("paid"))),
    });

    await expect(
      qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(GalatQrispy);
  });

  it("jawaban sukses yang bukan JSON ditolak", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() => new Response("OK", { status: 200 })),
    });

    await expect(
      qrispy.batalkanQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(GalatQrispy);
  });

  it("jawaban 200 berstatus error ditolak, jadi pembatalan tidak dianggap diterima", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: fetchTiruan(() =>
        Response.json({ status: "error", message: "QRIS already paid." }),
      ),
    });

    await expect(
      qrispy.batalkanQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(GalatQrispy);
  });
});

describe("Qrispy sungguhan: Qrispy yang tidak menjawab", () => {
  it("permintaan dihentikan setelah batas waktu, lalu menjadi GalatQrispy tanpa kode HTTP", async () => {
    // fetch tiruan yang tidak pernah menjawab, dan baru berhenti saat permintaannya dihentikan.
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_alamat, permintaan) =>
        new Promise((_, tolak) => {
          permintaan?.signal?.addEventListener("abort", () =>
            tolak(permintaan.signal?.reason),
          );
        }),
    );
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch,
      batasTungguMs: 20,
    });

    const galat = await qrispy
      .buatQris({ amount: 50000, paymentReference: "MIWE-7K3P9Q" })
      .catch((g: unknown) => g);

    expect(galat).toBeInstanceOf(GalatQrispy);
    expect(galat).toMatchObject({ statusHttp: null });
    expect(String(galat)).toContain("tidak menjawab");
    expect(String(galat)).not.toContain(TOKEN);
  });

  it("koneksi yang gagal menjadi GalatQrispy tanpa kode HTTP", async () => {
    const qrispy = qrispySungguhan({
      alamatDasar: ALAMAT_DASAR,
      token: TOKEN,
      fetch: vi.fn<typeof fetch>(async () => {
        throw new TypeError("fetch failed");
      }),
    });

    await expect(
      qrispy.cekStatusQris("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toMatchObject({ name: "GalatQrispy", statusHttp: null });
  });
});
