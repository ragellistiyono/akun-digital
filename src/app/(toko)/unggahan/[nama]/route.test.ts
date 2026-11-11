import { rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { simpanGambar } from "@/server/berkas-unggahan";
import { FOLDER_UNGGAHAN_TEST, PNG } from "@/server/uji-unggahan";

import { GET } from "./route";

const berkasTersimpan: string[] = [];

afterAll(async () => {
  await Promise.all(
    berkasTersimpan.map((nama) => rm(path.join(FOLDER_UNGGAHAN_TEST, nama))),
  );
});

function minta(nama: string) {
  return GET(new Request(`http://localhost/unggahan/${nama}`), {
    params: Promise.resolve({ nama }),
  });
}

describe("rute toko /unggahan/[nama]", () => {
  it("menyajikan gambar unggahan dengan jenisnya, tanpa boleh dijalankan sebagai halaman", async () => {
    const hasil = await simpanGambar(
      new File([PNG], "ikon.png", { type: "image/png" }),
    );
    if (hasil.hasil !== "disimpan") {
      throw new Error("Gambar uji tidak tersimpan.");
    }
    berkasTersimpan.push(hasil.nama);

    const respons = await minta(hasil.nama);

    expect(respons.status).toBe(200);
    expect(respons.headers.get("content-type")).toBe("image/png");
    expect(respons.headers.get("x-content-type-options")).toBe("nosniff");
    expect(respons.headers.get("content-security-policy")).toBe(
      "default-src 'none'",
    );
    expect(Buffer.from(await respons.arrayBuffer())).toEqual(PNG);
  });

  for (const nama of [
    "00000000-0000-4000-8000-000000000000.png",
    "../../.env.ci",
    "..%2F..%2F.env.ci",
    "berkas.svg",
  ]) {
    it(`nama "${nama}" dijawab 404 dengan pesan yang menyebut sebab dan langkah berikutnya`, async () => {
      const respons = await minta(nama);

      expect(respons.status).toBe(404);
      expect(await respons.text()).toBe(
        "Gambar ini tidak ditemukan, mungkin karena sudah diganti atau dihapus. Muat ulang halaman toko untuk melihat gambar terbaru.",
      );
    });
  }
});
