import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { parse } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { bacaBerkasUnggahan, simpanGambar } from "./berkas-unggahan";
import {
  adaBerkasBerisi,
  FOLDER_UNGGAHAN_TEST,
  PNG,
  pngUnik,
} from "./uji-unggahan";

const FOLDER_PENGEMBANGAN = path.resolve(
  parse(readFileSync(".env.example")).UPLOAD_DIR ?? "",
);

const berkasTersimpan: string[] = [];

afterAll(async () => {
  await Promise.all(
    berkasTersimpan.map((nama) => rm(path.join(FOLDER_UNGGAHAN_TEST, nama))),
  );
});

const gambar = (isi: Buffer<ArrayBuffer>) =>
  new File([isi], "ikon.png", { type: "image/png" });

describe("menyimpan berkas unggahan", () => {
  it("gambar PNG ditulis ke folder unggahan dari .env.ci, bukan ke folder unggahan pengembangan", async () => {
    const hasil = await simpanGambar(gambar(PNG));

    expect(hasil.hasil).toBe("disimpan");
    if (hasil.hasil !== "disimpan") return;
    berkasTersimpan.push(hasil.nama);
    expect(FOLDER_UNGGAHAN_TEST).not.toBe(FOLDER_PENGEMBANGAN);
    expect(await readFile(path.join(FOLDER_UNGGAHAN_TEST, hasil.nama))).toEqual(
      PNG,
    );
  });

  it("berkas yang bukan gambar ditolak walaupun nama dan jenisnya mengaku PNG, dan tidak ditulis", async () => {
    const isi = Buffer.from(`<script>alert("${randomUUID()}")</script>`);

    const hasil = await simpanGambar(gambar(isi));

    expect(hasil).toEqual({ hasil: "ditolak", alasan: "bukan-gambar" });
    expect(await adaBerkasBerisi(isi)).toBe(false);
  });

  // Batas ukuran gambar 2 MB = 2.097.152 byte (keputusan teknis T06).
  it("gambar tepat 2 MB disimpan", async () => {
    const hasil = await simpanGambar(gambar(pngUnik(2_097_152)));

    expect(hasil.hasil).toBe("disimpan");
    if (hasil.hasil === "disimpan") berkasTersimpan.push(hasil.nama);
  });

  it("gambar lebih dari 2 MB ditolak dan tidak ditulis", async () => {
    const isi = pngUnik(2_097_153);

    const hasil = await simpanGambar(gambar(isi));

    expect(hasil).toEqual({ hasil: "ditolak", alasan: "terlalu-besar" });
    expect(await adaBerkasBerisi(isi)).toBe(false);
  });
});

describe("membaca berkas unggahan untuk disajikan", () => {
  it("gambar yang tersimpan terbaca kembali beserta jenisnya", async () => {
    const hasil = await simpanGambar(gambar(PNG));
    if (hasil.hasil !== "disimpan") {
      throw new Error("Gambar uji tidak tersimpan.");
    }
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
