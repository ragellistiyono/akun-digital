import { afterEach, describe, expect, it, vi } from "vitest";

import { jalankanPekerjaanLatar } from "@/server/pekerjaan-latar";

import { register } from "./instrumentation";

// Pekerja latar pg-boss tidak dijalankan di proses test, karena pekerja itu akan memproses pekerjaan di
// database app_test yang dipakai bersama test lain. Yang diperiksa hanya apakah register() menjalankannya.
vi.mock("@/server/pekerjaan-latar", () => ({
  jalankanPekerjaanLatar: vi.fn(async () => {}),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(jalankanPekerjaanLatar).mockClear();
});

describe("register, saat server dimulai", () => {
  it("menolak mulai bila QRISPY_MODE=sungguhan tetapi QRISPY_API_TOKEN belum diisi, sebelum pekerja latar berjalan", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("QRISPY_MODE", "sungguhan");
    vi.stubEnv("QRISPY_BASE_URL", "https://qrispy.uji.example");
    vi.stubEnv("QRISPY_API_TOKEN", "");

    await expect(register()).rejects.toThrow(/QRISPY_API_TOKEN/);
    expect(jalankanPekerjaanLatar).not.toHaveBeenCalled();
  });

  it("dengan Qrispy tiruan, server mulai dan pekerja latar dijalankan", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("QRISPY_MODE", "tiruan");

    await register();

    expect(jalankanPekerjaanLatar).toHaveBeenCalledOnce();
  });
});
