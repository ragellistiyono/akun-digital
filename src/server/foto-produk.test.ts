import { afterAll, describe, expect, it } from "vitest";

import { koneksi } from "./db";
import { unggahFotoProduk } from "./foto-produk";
import { adaBerkasBerisi, pngUnik } from "./uji-unggahan";

// Test integrasi dengan database app_test dan folder unggahan dari .env.ci. PostgreSQL menolak id yang
// bukan UUID, jadi id seperti itu dipakai untuk membuat penulisan database gagal.
afterAll(async () => {
  await koneksi.end();
});

describe("berkas foto saat foto Produk tidak bisa ditulis", () => {
  it("gambar yang baru disimpan dihapus lagi, lalu galatnya diteruskan", async () => {
    const isi = pngUnik();

    await expect(
      unggahFotoProduk({
        produkId: "bukan-uuid",
        foto: new File([isi], "foto.png", { type: "image/png" }),
      }),
    ).rejects.toThrow();

    expect(await adaBerkasBerisi(isi)).toBe(false);
  });
});
