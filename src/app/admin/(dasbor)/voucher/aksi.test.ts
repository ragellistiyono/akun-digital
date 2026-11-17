import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { afterAll, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { koneksi } from "@/server/db";
import { arahKe, cookieAdminBaru, tidakDitemukan } from "@/server/uji-admin";
import { sisipkanKategori, sisipkanProduk } from "@/server/uji-katalog";
import { sisipkanMember } from "@/server/uji-member";
import { bacaVoucher, daftarVoucher } from "@/server/voucher";

import {
  aksiBuatVoucher,
  aksiUbahStatusVoucher,
  aksiUbahVoucher,
  type KeadaanFormVoucher,
} from "./aksi";

// Test integrasi Server Action Voucher dengan database app_test dari .env.ci. Header permintaan yang dibaca
// aksi lewat next/headers diganti dengan cookie milik pengunjung di setiap test. revalidatePath() dari
// next/cache hanya bisa berjalan di dalam Server Action yang dijalankan Next.js, jadi diganti tiruan.
// PRD §8.2, §8.4, §8.8 (▶ Keputusan 2026-11-17), UAT-H5.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PASSWORD_MEMBER = "sandi-uji-member-123";

afterAll(async () => {
  await koneksi.end();
});

function sebagaiPengunjung(kepala: Headers) {
  vi.mocked(headers).mockResolvedValue(kepala);
}

async function cookieMemberBaru() {
  const email = `member-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: PASSWORD_MEMBER });
  const { headers: kepalaRespons } = await auth.api.signInEmail({
    body: { email, password: PASSWORD_MEMBER },
    returnHeaders: true,
  });
  const cookie = kepalaRespons
    .getSetCookie()
    .map((baris) => baris.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** Kode Voucher unik untuk satu test, huruf besar dan angka saja. */
const kodeBaru = () =>
  `V${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

const AWAL: KeadaanFormVoucher = {
  isian: {
    kode: "",
    jenisPotongan: "nominal",
    nilai: "",
    batasMaksimum: "",
    mulai: "",
    berakhir: "",
    kuotaVoucher: "",
    batasPerEmail: "1",
    minimalHargaJual: "",
    khususMember: false,
    aktif: true,
    cakupan: "semua",
    produkId: [],
    kategoriId: [],
  },
};

/** Isian form. Isian berisi daftar dikirim berulang dengan nama yang sama, seperti kotak centang. */
function formulir(isian: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [nama, nilai] of Object.entries(isian)) {
    for (const satu of [nilai].flat()) data.append(nama, satu);
  }
  return data;
}

/** Form Voucher baru dengan isian bawaannya, ditimpa `isian`. */
const formBaru = (isian: Record<string, string | string[]>) =>
  formulir({
    jenisPotongan: "nominal",
    batasPerEmail: "1",
    aktif: "on",
    ...isian,
  });

async function voucherDenganKode(kode: string) {
  const semua = await daftarVoucher();
  return semua.find((v) => v.kode === kode);
}

/** Membuat Voucher lewat aksi sebagai Admin, lalu mengembalikan Voucher yang tersimpan. */
async function buatSebagaiAdmin(
  isian: Record<string, string | string[]> & { kode: string },
) {
  sebagaiPengunjung(await cookieAdminBaru());
  await expect(aksiBuatVoucher(AWAL, formBaru(isian))).rejects.toSatisfy(
    arahKe("/admin/voucher"),
  );
  const tersimpan = await voucherDenganKode(isian.kode.trim().toUpperCase());
  if (!tersimpan) throw new Error("Voucher tidak tersimpan");
  return tersimpan;
}

describe("aksiBuatVoucher", () => {
  it("Admin membuat Voucher nominal Rp 5.000; kode huruf kecil disimpan huruf besar, lalu dasbor kembali ke daftar Voucher", async () => {
    const kode = kodeBaru();
    const voucher = await buatSebagaiAdmin({
      kode: ` ${kode.toLowerCase()} `,
      nilai: "5.000",
    });

    expect(voucher).toMatchObject({
      kode,
      jenisPotongan: "nominal",
      nilai: 5000,
      batasMaksimum: null,
      kuotaVoucher: null,
      batasPerEmail: 1,
      minimalHargaJual: null,
      mulai: null,
      berakhir: null,
      khususMember: false,
      aktif: true,
    });
  });

  it("Admin membuat Voucher 10%, maksimal Rp 10.000, minimal Harga jual Rp 50.000, dengan masa berlaku WIB dan khusus Member", async () => {
    const kode = kodeBaru();
    const voucher = await buatSebagaiAdmin({
      kode,
      jenisPotongan: "persen",
      nilai: "10",
      batasMaksimum: "Rp 10.000",
      minimalHargaJual: "50000",
      kuotaVoucher: "100",
      batasPerEmail: "",
      mulai: "2026-12-01T00:00",
      berakhir: "2026-12-31T23:59",
      khususMember: "on",
    });

    expect(voucher).toMatchObject({
      kode,
      jenisPotongan: "persen",
      nilai: 10,
      batasMaksimum: 10000,
      kuotaVoucher: 100,
      batasPerEmail: null,
      minimalHargaJual: 50000,
      mulai: new Date("2026-11-30T17:00:00Z"),
      berakhir: new Date("2026-12-31T16:59:00Z"),
      khususMember: true,
    });
  });

  it("Voucher terbaru tampil paling atas di daftar Voucher", async () => {
    const lama = kodeBaru();
    const baru = kodeBaru();
    await buatSebagaiAdmin({ kode: lama, nilai: "1000" });
    await buatSebagaiAdmin({ kode: baru, nilai: "2000" });

    const kode = (await daftarVoucher()).map((v) => v.kode);
    expect(kode.indexOf(baru)).toBeLessThan(kode.indexOf(lama));
  });

  it("kode yang sudah dipakai ditolak tanpa membedakan huruf besar dan kecil (UAT-H5 langkah 7)", async () => {
    const kode = kodeBaru();
    await buatSebagaiAdmin({ kode, nilai: "5000" });

    const hasil = await aksiBuatVoucher(
      AWAL,
      formBaru({ kode: kode.toLowerCase(), nilai: "3000" }),
    );

    expect(hasil.galat?.kode).toBe(
      "Kode ini sudah dipakai Voucher lain, tanpa membedakan huruf besar dan kecil. Ganti kodenya supaya setiap Voucher berbeda.",
    );
    expect(hasil.isian.kode).toBe(kode.toLowerCase());
    expect((await daftarVoucher()).filter((v) => v.kode === kode)).toHaveLength(
      1,
    );
  });

  it("kode dengan tanda hubung ditolak karena hanya boleh huruf dan angka (UAT-H5 langkah 7)", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const hasil = await aksiBuatVoucher(
      AWAL,
      formBaru({ kode: "HEMAT-10", nilai: "10000" }),
    );

    expect(hasil.galat?.kode).toBe(
      "Kode hanya boleh berisi huruf A–Z dan angka 0–9, tanpa spasi atau tanda baca. Hapus karakter lainnya, misalnya HEMAT-10 menjadi HEMAT10.",
    );
    expect(await voucherDenganKode("HEMAT-10")).toBeUndefined();
  });

  it("waktu berakhir yang sama dengan atau sebelum waktu mulai ditolak dengan pesan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());
    const pesan =
      "Waktu berakhir harus setelah waktu mulai. Ubah waktu berakhirnya, atau kosongkan salah satu waktu.";

    for (const berakhir of ["2026-11-30T10:00", "2026-11-30T09:59"]) {
      const kode = kodeBaru();
      const hasil = await aksiBuatVoucher(
        AWAL,
        formBaru({ kode, nilai: "2000", mulai: "2026-11-30T10:00", berakhir }),
      );
      expect(hasil.galat?.berakhir).toBe(pesan);
      expect(await voucherDenganKode(kode)).toBeUndefined();
    }
  });

  it("semua isian yang tidak sah disebut sekaligus, dan isiannya dikembalikan apa adanya", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    const hasil = await aksiBuatVoucher(
      AWAL,
      formBaru({
        kode: "",
        jenisPotongan: "persen",
        nilai: "101",
        kuotaVoucher: "0",
        batasPerEmail: "0",
      }),
    );

    expect(Object.keys(hasil.galat ?? {}).sort()).toEqual(
      ["batasPerEmail", "kode", "kuotaVoucher", "nilai"].sort(),
    );
    expect(hasil.isian).toMatchObject({
      jenisPotongan: "persen",
      nilai: "101",
      kuotaVoucher: "0",
    });
  });
});

const akhiranUnik = () => randomUUID().slice(0, 8);

/** Produk uji dengan satu Varian di Kategorinya sendiri. Hasilnya id Produk itu. */
const produkBaru = (nama: string) =>
  sisipkanProduk({
    nama: `${nama} ${akhiranUnik()}`,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });

// Cakupan voucher (T54, PRD §8.4 ▶ Keputusan 2026-11-17): semua Produk, satu Produk atau lebih, atau satu
// Kategori atau lebih, tanpa mencampur Produk dan Kategori.
describe("cakupan voucher", () => {
  it("Voucher baru tanpa pilihan cakupan berlaku untuk semua Produk", async () => {
    const voucher = await buatSebagaiAdmin({ kode: kodeBaru(), nilai: "5000" });

    expect((await bacaVoucher(voucher.id))?.cakupan).toEqual({
      jenis: "semua",
    });
  });

  it("Voucher dibatasi untuk dua Produk sekaligus, dan Voucher yang tersimpan membawa kedua Produk itu", async () => {
    const netflix = await produkBaru("Netflix Premium");
    const spotify = await produkBaru("Spotify Premium");

    const voucher = await buatSebagaiAdmin({
      kode: kodeBaru(),
      nilai: "5000",
      cakupan: "produk",
      produkId: [netflix, spotify],
    });

    const cakupan = (await bacaVoucher(voucher.id))?.cakupan;
    expect(cakupan?.jenis).toBe("produk");
    expect(
      cakupan && "daftar" in cakupan ? [...cakupan.daftar].sort() : [],
    ).toEqual([netflix, spotify].sort());
  });

  it.each([
    [
      "produk",
      "Belum ada Produk yang dipilih. Centang satu Produk atau lebih, atau pilih Semua Produk.",
    ],
    [
      "kategori",
      "Belum ada Kategori yang dipilih. Centang satu Kategori atau lebih, atau pilih Semua Produk.",
    ],
  ])(
    "cakupan %s tanpa satu pun pilihan ditolak dengan pesan, dan Voucher tidak dibuat",
    async (cakupan, pesan) => {
      sebagaiPengunjung(await cookieAdminBaru());
      const kode = kodeBaru();

      const hasil = await aksiBuatVoucher(
        AWAL,
        formBaru({ kode, nilai: "5000", cakupan }),
      );

      expect(hasil.galat).toEqual({ cakupan: pesan });
      expect(hasil.isian.cakupan).toBe(cakupan);
      expect(await voucherDenganKode(kode)).toBeUndefined();
    },
  );

  it("Produk dan Kategori tidak tersimpan bersamaan: hanya pilihan untuk jenis cakupan terpilih yang disimpan", async () => {
    const netflix = await produkBaru("Netflix Premium");
    const musik = await sisipkanKategori({ nama: `Musik ${akhiranUnik()}` });

    const voucher = await buatSebagaiAdmin({
      kode: kodeBaru(),
      nilai: "5000",
      cakupan: "kategori",
      produkId: [netflix],
      kategoriId: [musik],
    });

    expect((await bacaVoucher(voucher.id))?.cakupan).toEqual({
      jenis: "kategori",
      daftar: [musik],
    });
  });

  it("Admin membatasi Voucher hanya untuk Kategori Musik, lalu mengembalikannya ke semua Produk (UAT-H3)", async () => {
    const musik = await sisipkanKategori({ nama: `Musik ${akhiranUnik()}` });
    const voucher = await buatSebagaiAdmin({ kode: kodeBaru(), nilai: "5000" });
    const ubah = (isian: Record<string, string | string[]>) =>
      expect(
        aksiUbahVoucher(
          AWAL,
          formulir({
            id: voucher.id,
            jenisPotongan: "nominal",
            nilai: "5000",
            batasPerEmail: "1",
            aktif: "on",
            ...isian,
          }),
        ),
      ).rejects.toSatisfy(arahKe("/admin/voucher"));

    await ubah({ cakupan: "kategori", kategoriId: [musik] });
    expect((await bacaVoucher(voucher.id))?.cakupan).toEqual({
      jenis: "kategori",
      daftar: [musik],
    });

    await ubah({ cakupan: "semua", kategoriId: [musik] });
    expect((await bacaVoucher(voucher.id))?.cakupan).toEqual({
      jenis: "semua",
    });
  });
});

describe("aksiUbahVoucher", () => {
  it("mengubah syarat Voucher tersimpan, dan kodenya tetap walaupun form mengirim kode lain (UAT-H5 langkah 8)", async () => {
    const kode = kodeBaru();
    const voucher = await buatSebagaiAdmin({ kode, nilai: "5000" });

    await expect(
      aksiUbahVoucher(
        AWAL,
        formulir({
          id: voucher.id,
          kode: "KODELAIN",
          jenisPotongan: "persen",
          nilai: "15",
          batasMaksimum: "",
          kuotaVoucher: "10",
          batasPerEmail: "2",
          minimalHargaJual: "30.000",
          mulai: "",
          berakhir: "2026-11-30T23:59",
          khususMember: "on",
        }),
      ),
    ).rejects.toSatisfy(arahKe("/admin/voucher"));

    expect(await bacaVoucher(voucher.id)).toMatchObject({
      kode,
      jenisPotongan: "persen",
      nilai: 15,
      batasMaksimum: null,
      kuotaVoucher: 10,
      batasPerEmail: 2,
      minimalHargaJual: 30000,
      mulai: null,
      berakhir: new Date("2026-11-30T16:59:00Z"),
      khususMember: true,
      aktif: false,
    });
  });

  it("Voucher yang tidak ada menampilkan halaman tidak ditemukan", async () => {
    sebagaiPengunjung(await cookieAdminBaru());

    await expect(
      aksiUbahVoucher(
        AWAL,
        formulir({
          id: randomUUID(),
          jenisPotongan: "nominal",
          nilai: "5000",
        }),
      ),
    ).rejects.toSatisfy(tidakDitemukan);
  });
});

describe("aksiUbahStatusVoucher", () => {
  it("Admin menonaktifkan Voucher lalu mengaktifkannya kembali, dan daftar Voucher dimuat ulang", async () => {
    const voucher = await buatSebagaiAdmin({ kode: kodeBaru(), nilai: "5000" });
    vi.mocked(revalidatePath).mockClear();

    await aksiUbahStatusVoucher(
      formulir({ id: voucher.id, status: "nonaktif" }),
    );
    expect((await bacaVoucher(voucher.id))?.aktif).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/voucher");

    await aksiUbahStatusVoucher(formulir({ id: voucher.id, status: "aktif" }));
    expect((await bacaVoucher(voucher.id))?.aktif).toBe(true);
  });
});

describe("kewenangan", () => {
  it.each([
    ["Tamu", async () => new Headers()],
    ["Member", cookieMemberBaru],
  ])(
    "%s diarahkan ke halaman login /admin, dan tidak bisa membuat, mengubah, maupun menonaktifkan Voucher",
    async (_peran, kepala) => {
      const voucher = await buatSebagaiAdmin({
        kode: kodeBaru(),
        nilai: "5000",
      });
      const kode = kodeBaru();
      sebagaiPengunjung(await kepala());

      await expect(
        aksiBuatVoucher(AWAL, formBaru({ kode, nilai: "5000" })),
      ).rejects.toSatisfy(arahKe("/admin"));
      await expect(
        aksiUbahVoucher(
          AWAL,
          formulir({ id: voucher.id, jenisPotongan: "nominal", nilai: "1" }),
        ),
      ).rejects.toSatisfy(arahKe("/admin"));
      await expect(
        aksiUbahStatusVoucher(formulir({ id: voucher.id, status: "nonaktif" })),
      ).rejects.toSatisfy(arahKe("/admin"));

      expect(await voucherDenganKode(kode)).toBeUndefined();
      expect(await bacaVoucher(voucher.id)).toMatchObject({
        nilai: 5000,
        aktif: true,
      });
    },
  );
});
