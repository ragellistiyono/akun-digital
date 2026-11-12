import { afterEach, describe, expect, it, vi } from "vitest";

import { emailResend } from "./email-resend";

// Test unit adaptor Resend (PRD §10.1). Resend sungguhan tidak dipanggil: fetch diganti tiruan yang
// mencatat permintaan dan menjawab seperti HTTP API Resend.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const KUNCI = "re_kunci_uji_bukan_asli";

const EMAIL = {
  dari: "MIWE Digital Store <no-reply@miwe.example>",
  kepada: "budi@example.test",
  subjek: "Pesanan selesai: MIWE-7K3P9Q",
  teks: "Pesanan selesai",
  html: "<h1>Pesanan selesai</h1>",
};

/** fetch tiruan yang selalu memberi jawaban itu. */
function fetchTiruan(jawaban: () => Response) {
  const tiruan = vi.fn<typeof fetch>(async () => jawaban());
  vi.stubGlobal("fetch", tiruan);
  return tiruan;
}

describe("emailResend", () => {
  it("mengirim email lewat HTTP API Resend dengan RESEND_API_KEY sebagai Bearer token", async () => {
    vi.stubEnv("RESEND_API_KEY", KUNCI);
    const fetch = fetchTiruan(() => Response.json({ id: "4ef9a417" }));

    await emailResend.kirim(EMAIL);

    expect(fetch).toHaveBeenCalledOnce();
    const [alamat, permintaan] = fetch.mock.calls[0];
    expect(alamat).toBe("https://api.resend.com/emails");
    expect(permintaan?.method).toBe("POST");
    const kepala = new Headers(permintaan?.headers);
    expect(kepala.get("Authorization")).toBe(`Bearer ${KUNCI}`);
    expect(kepala.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(permintaan?.body))).toEqual({
      from: "MIWE Digital Store <no-reply@miwe.example>",
      to: ["budi@example.test"],
      subject: "Pesanan selesai: MIWE-7K3P9Q",
      text: "Pesanan selesai",
      html: "<h1>Pesanan selesai</h1>",
    });
  });

  it("jawaban gagal dari Resend dilempar dengan kode HTTP dan pesannya, tanpa RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", KUNCI);
    fetchTiruan(() =>
      Response.json(
        {
          statusCode: 429,
          name: "rate_limit_exceeded",
          message: "Too many requests.",
        },
        { status: 429 },
      ),
    );

    const galat = await emailResend.kirim(EMAIL).catch((g: unknown) => g);

    expect(galat).toBeInstanceOf(Error);
    expect(String(galat)).toContain("429");
    expect(String(galat)).toContain("Too many requests.");
    expect(String(galat)).not.toContain(KUNCI);
  });

  it("selama RESEND_API_KEY kosong, Resend tidak dipanggil dan kegagalannya dilempar", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = fetchTiruan(() => Response.json({ id: "4ef9a417" }));

    await expect(emailResend.kirim(EMAIL)).rejects.toThrow("RESEND_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
});
