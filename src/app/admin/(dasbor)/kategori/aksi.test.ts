import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { buatAdmin } from "@/server/auth/buat-admin";
import { koneksi } from "@/server/db";
import { buatKategori, daftarKategori } from "@/server/kategori";
import { FOLDER_UNGGAHAN_TEST, PNG } from "@/server/uji-unggahan";

import { aksiBuatKategori, aksiUbahKategori } from "./aksi";

// Test integrasi Server Action dengan database app_test dan folder unggahan dari .env.ci. Header
// permintaan yang dibaca aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const PASSWORD = "sandi-uji-admin-123";

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

function formulir(isian: Record<string, string | File>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) data.set(nama, nilai);
  return data;
}

async function cookieAdminBaru() {
  const email = `admin-${randomUUID()}@example.test`;
  await buatAdmin({ email, password: PASSWORD });
  const { headers: kepalaRespons } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  // Ambil pasangan nama=nilai cookie sesi dari Set-Cookie, seperti yang dikirim browser kembali.
  const cookie = kepalaRespons
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function kategoriBernama(nama: string) {
  return (await daftarKategori()).filter((k) => k.nama === nama);
}

/** Isi berkas ikon sebuah Kategori di folder unggahan test. */
function isiIkon(alamatIkon: string) {
  return readFile(path.join(FOLDER_UNGGAHAN_TEST, path.basename(alamatIkon)));
}

/** Gambar JPEG kecil (cukup byte awalnya untuk dikenali sebagai JPEG). */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const ikonPng = () => new File([PNG], "ikon.png", { type: "image/png" });

/** Kategori yang sudah ada, dibuat langsung lewat modul server. */
async function kategoriAda(nama: string) {
  await buatKategori({ nama, ikon: ikonPng() });
  const [ada] = await kategoriBernama(nama);
  return ada;
}

/** Nama Kategori unik per test, karena database test dipakai bersama oleh semua test. */
const namaUnik = (nama: string) => `${nama} ${randomUUID().slice(0, 8)}`;

function arahKe(alamat: string) {
  return (galat: unknown) =>
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    typeof galat.digest === "string" &&
    galat.digest.split(";")[2] === alamat;
}

function tidakDitemukan(galat: unknown) {
  return (
    typeof galat === "object" &&
    galat !== null &&
    "digest" in galat &&
    galat.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  );
}

const keadaanAwal = () => ({ nama: "" });

afterAll(async () => {
  await koneksi.end();
});

describe("membuat Kategori (PRD §3.1)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Kategori tidak dibuat", async () => {
    sebagaiPengunjung(new Headers());
    const nama = namaUnik("Streaming");

    await expect(
      aksiBuatKategori(keadaanAwal(), formulir({ nama, ikon: ikonPng() })),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await kategoriBernama(nama)).toEqual([]);
  });

  it("Admin membuat Kategori dengan nama dan ikon, lalu dibawa ke daftar Kategori", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const nama = namaUnik("Streaming");

    await expect(
      aksiBuatKategori(
        keadaanAwal(),
        formulir({ nama: `  ${nama} `, ikon: ikonPng() }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/kategori"));

    const [dibuat, ...lainnya] = await kategoriBernama(nama);
    expect(lainnya).toEqual([]);
    expect(dibuat.alamatIkon).toMatch(/^\/unggahan\/[0-9a-f-]{36}\.png$/);
    expect(await isiIkon(dibuat.alamatIkon)).toEqual(PNG);
  });

  it("Kategori tanpa nama ditolak dengan pesan, dan tidak dibuat", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatKategori(
      keadaanAwal(),
      formulir({ nama: "   ", ikon: ikonPng() }),
    );

    expect(keadaan).toEqual({
      nama: "   ",
      galat: {
        nama: "Nama Kategori belum diisi. Ketik nama Kategori, misalnya Streaming.",
      },
    });
    const tanpaNama = (await daftarKategori()).filter(
      (k) => k.nama.trim() === "",
    );
    expect(tanpaNama).toEqual([]);
  });

  it("Kategori tanpa ikon ditolak dengan pesan, dan tidak dibuat", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const nama = namaUnik("Streaming");

    // Browser mengirim berkas kosong tanpa nama bila Admin tidak memilih berkas.
    const keadaan = await aksiBuatKategori(
      keadaanAwal(),
      formulir({
        nama,
        ikon: new File([], "", { type: "application/octet-stream" }),
      }),
    );

    expect(keadaan).toEqual({
      nama,
      galat: {
        ikon: "Gambar ikon belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP untuk ikon Kategori.",
      },
    });
    expect(await kategoriBernama(nama)).toEqual([]);
  });

  it("tanpa nama dan tanpa ikon, kedua pesan tampil sekaligus", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiBuatKategori(
      keadaanAwal(),
      formulir({ nama: "" }),
    );

    expect(keadaan.galat).toEqual({
      nama: "Nama Kategori belum diisi. Ketik nama Kategori, misalnya Streaming.",
      ikon: "Gambar ikon belum dipilih. Pilih berkas gambar PNG, JPEG, atau WebP untuk ikon Kategori.",
    });
  });

  it("berkas ikon yang bukan gambar ditolak dengan pesan, dan Kategori tidak dibuat", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const nama = namaUnik("Streaming");

    const keadaan = await aksiBuatKategori(
      keadaanAwal(),
      formulir({
        nama,
        ikon: new File(["bukan gambar"], "ikon.png", { type: "image/png" }),
      }),
    );

    expect(keadaan).toEqual({
      nama,
      galat: {
        ikon: "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih berkas gambar dengan salah satu jenis itu.",
      },
    });
    expect(await kategoriBernama(nama)).toEqual([]);
  });

  it("gambar ikon lebih dari 2 MB ditolak dengan pesan, dan Kategori tidak dibuat", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const nama = namaUnik("Streaming");
    const besar = Buffer.alloc(2_097_153);
    PNG.copy(besar);

    const keadaan = await aksiBuatKategori(
      keadaanAwal(),
      formulir({ nama, ikon: new File([besar], "ikon.png") }),
    );

    expect(keadaan).toEqual({
      nama,
      galat: {
        ikon: "Gambar ini lebih besar dari 2 MB. Perkecil gambarnya, lalu pilih lagi.",
      },
    });
    expect(await kategoriBernama(nama)).toEqual([]);
  });
});

describe("mengubah Kategori (PRD §3.1)", () => {
  it("Tamu tanpa sesi Admin diarahkan ke halaman login, dan Kategori tidak berubah", async () => {
    const lama = await kategoriAda(namaUnik("Streaming"));
    sebagaiPengunjung(new Headers());

    await expect(
      aksiUbahKategori(
        keadaanAwal(),
        formulir({ id: lama.id, nama: namaUnik("Film"), ikon: ikonPng() }),
      ),
    ).rejects.toSatisfy(arahKe("/admin"));

    expect(await kategoriBernama(lama.nama)).toEqual([lama]);
  });

  it("Admin mengganti nama Kategori tanpa memilih ikon baru, dan ikonnya tetap", async () => {
    const lama = await kategoriAda(namaUnik("Streaming"));
    const namaBaru = namaUnik("Film");
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiUbahKategori(
        keadaanAwal(),
        formulir({
          id: lama.id,
          nama: namaBaru,
          ikon: new File([], "", { type: "application/octet-stream" }),
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/kategori"));

    expect(await kategoriBernama(lama.nama)).toEqual([]);
    expect(await kategoriBernama(namaBaru)).toEqual([
      { id: lama.id, nama: namaBaru, alamatIkon: lama.alamatIkon },
    ]);
  });

  it("Admin mengganti ikon Kategori, dan berkas ikon lama dihapus dari folder unggahan", async () => {
    const lama = await kategoriAda(namaUnik("Streaming"));
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiUbahKategori(
        keadaanAwal(),
        formulir({
          id: lama.id,
          nama: lama.nama,
          ikon: new File([JPEG], "ikon-baru.jpg", { type: "image/jpeg" }),
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/kategori"));

    const [baru] = await kategoriBernama(lama.nama);
    expect(baru.alamatIkon).toMatch(/^\/unggahan\/[0-9a-f-]{36}\.jpg$/);
    expect(await isiIkon(baru.alamatIkon)).toEqual(JPEG);
    await expect(isiIkon(lama.alamatIkon)).rejects.toThrow("ENOENT");
  });

  it("ikon pengganti yang bukan gambar ditolak dengan pesan, dan Kategori tidak berubah", async () => {
    const lama = await kategoriAda(namaUnik("Streaming"));
    sebagaiPengunjung(await cookieAdminBaru());
    const namaBaru = namaUnik("Film");

    const keadaan = await aksiUbahKategori(
      keadaanAwal(),
      formulir({
        id: lama.id,
        nama: namaBaru,
        ikon: new File(["%PDF-1.7"], "ikon.pdf", { type: "application/pdf" }),
      }),
    );

    expect(keadaan).toEqual({
      nama: namaBaru,
      galat: {
        ikon: "Berkas ini bukan gambar PNG, JPEG, atau WebP. Pilih berkas gambar dengan salah satu jenis itu.",
      },
    });
    expect(await kategoriBernama(lama.nama)).toEqual([lama]);
    await expect(
      access(path.join(FOLDER_UNGGAHAN_TEST, path.basename(lama.alamatIkon))),
    ).resolves.toBeUndefined();
  });

  it("nama yang dikosongkan ditolak dengan pesan, dan Kategori tidak berubah", async () => {
    const lama = await kategoriAda(namaUnik("Streaming"));
    sebagaiPengunjung(await cookieAdminBaru());

    const keadaan = await aksiUbahKategori(
      keadaanAwal(),
      formulir({ id: lama.id, nama: "" }),
    );

    expect(keadaan).toEqual({
      nama: "",
      galat: {
        nama: "Nama Kategori belum diisi. Ketik nama Kategori, misalnya Streaming.",
      },
    });
    expect(await kategoriBernama(lama.nama)).toEqual([lama]);
  });

  for (const id of ["00000000-0000-4000-8000-000000000000", "bukan-id"]) {
    it(`Kategori "${id}" yang tidak ada menghasilkan halaman tidak ditemukan`, async () => {
      sebagaiPengunjung(await cookieAdminBaru());

      await expect(
        aksiUbahKategori(
          keadaanAwal(),
          formulir({ id, nama: namaUnik("Film") }),
        ),
      ).rejects.toSatisfy(tidakDitemukan);
    });
  }
});
