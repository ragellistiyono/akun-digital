import { readFileSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { parse } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { bacaBerkasUnggahan, simpanGambar } from "./berkas-unggahan";

// Folder unggahan test dan pengembangan dibaca langsung dari berkasnya, bukan dari process.env,
// supaya test ini gagal bila test ternyata menulis ke folder unggahan pengembangan.
const FOLDER_TEST = path.resolve(
  parse(readFileSync(".env.ci")).UPLOAD_DIR ?? "",
);
const FOLDER_PENGEMBANGAN = path.resolve(
  parse(readFileSync(".env.example")).UPLOAD_DIR ?? "",
);

// Gambar PNG 1×1 piksel yang sah.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const berkasTersimpan: string[] = [];

afterAll(async () => {
  await Promise.all(
    berkasTersimpan.map((nama) => rm(path.join(FOLDER_TEST, nama))),
  );
});

describe("menyimpan berkas unggahan", () => {
  it("gambar PNG ditulis ke folder unggahan dari .env.ci, bukan ke folder unggahan pengembangan", async () => {
    const hasil = await simpanGambar(
      new File([PNG], "ikon.png", { type: "image/png" }),
    );

    expect(hasil.hasil).toBe("disimpan");
    if (hasil.hasil !== "disimpan") return;
    berkasTersimpan.push(hasil.nama);
    expect(FOLDER_TEST).not.toBe(FOLDER_PENGEMBANGAN);
    expect(await readFile(path.join(FOLDER_TEST, hasil.nama))).toEqual(PNG);
  });

  it("berkas yang bukan gambar ditolak walaupun nama dan jenisnya mengaku PNG, dan tidak ditulis", async () => {
    const isiFolderSebelum = await isiFolderTest();

    const hasil = await simpanGambar(
      new File(["<script>alert(1)</script>"], "ikon.png", {
        type: "image/png",
      }),
    );

    expect(hasil).toEqual({ hasil: "ditolak", alasan: "bukan-gambar" });
    expect(await isiFolderTest()).toEqual(isiFolderSebelum);
  });

  // Batas ukuran gambar 2 MB = 2.097.152 byte (keputusan teknis T06).
  it("gambar tepat 2 MB disimpan", async () => {
    const hasil = await simpanGambar(pngBerukuran(2_097_152));

    expect(hasil.hasil).toBe("disimpan");
    if (hasil.hasil === "disimpan") berkasTersimpan.push(hasil.nama);
  });

  it("gambar lebih dari 2 MB ditolak dan tidak ditulis", async () => {
    const isiFolderSebelum = await isiFolderTest();

    const hasil = await simpanGambar(pngBerukuran(2_097_153));

    expect(hasil).toEqual({ hasil: "ditolak", alasan: "terlalu-besar" });
    expect(await isiFolderTest()).toEqual(isiFolderSebelum);
  });
});

describe("membaca berkas unggahan untuk disajikan", () => {
  it("gambar yang tersimpan terbaca kembali beserta jenisnya", async () => {
    const hasil = await simpanGambar(
      new File([PNG], "ikon.png", { type: "image/png" }),
    );
    if (hasil.hasil !== "disimpan")
      throw new Error("Gambar uji tidak tersimpan.");
    berkasTersimpan.push(hasil.nama);

    expect(await bacaBerkasUnggahan(hasil.nama)).toEqual({
      isi: new Uint8Array(PNG),
      jenis: "image/png",
    });
  });

  for (const nama of [
    "00000000-0000-4000-8000-000000000000.png",
    "../../.env.ci",
    "..%2F..%2F.env.ci",
    ".env.ci",
  ]) {
    it(`nama "${nama}" yang bukan gambar unggahan tidak terbaca`, async () => {
      expect(await bacaBerkasUnggahan(nama)).toBeNull();
    });
  }
});

/** Berkas berawalan PNG dengan ukuran tepat sekian byte. */
function pngBerukuran(byte: number) {
  const isi = Buffer.alloc(byte);
  PNG.copy(isi);
  return new File([isi], "foto.png", { type: "image/png" });
}

async function isiFolderTest() {
  return (await readdir(FOLDER_TEST).catch(() => [])).sort();
}
