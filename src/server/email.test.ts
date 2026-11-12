import { afterEach, describe, expect, it, vi } from "vitest";

import { pengirimEmailAktif } from "./email";
import { emailResend } from "./email-resend";
import { emailTiruan } from "./email-tiruan";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pengirimEmailAktif", () => {
  it("EMAIL_MODE=tiruan memilih email tiruan, dan EMAIL_MODE=resend memilih Resend", () => {
    vi.stubEnv("EMAIL_MODE", "tiruan");
    expect(pengirimEmailAktif()).toBe(emailTiruan);

    vi.stubEnv("EMAIL_MODE", "resend");
    expect(pengirimEmailAktif()).toBe(emailResend);
  });

  it("EMAIL_MODE yang kosong atau tidak dikenal dilempar sebagai kegagalan yang menyebut EMAIL_MODE", () => {
    for (const mode of ["", "sungguhan"]) {
      vi.stubEnv("EMAIL_MODE", mode);
      expect(() => pengirimEmailAktif()).toThrow("EMAIL_MODE");
    }
  });
});
