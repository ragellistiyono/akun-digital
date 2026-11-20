import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db, koneksi } from "./db";
import { user } from "./db/schema";
import {
  bacaSaldoMember,
  riwayatSaldoMember,
  ubahSaldoOlehAdmin,
} from "./saldo";
import { ubahStatusMember } from "./status-member";
import { sisipkanMember } from "./uji-member";

// Test integrasi dengan database app_test (.env.ci), yang dipakai bersama test lain, jadi setiap test memakai
// Member dengan email unik (issue T76, PRD §15.1, §15.2, §15.6). Nominal dan keterangan dari
// tests/golden/ubah-saldo-admin.json dan contoh PRD §15.2.

afterAll(async () => {
  await koneksi.end();
});

async function memberBaru() {
  const email = `saldo-${randomUUID()}@example.test`;
  await sisipkanMember({ email, password: "sandi-uji-member-123" });
  const [{ id }] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return { email, id };
}

const tambah = (idMember: string, nominal: string, keterangan: string) =>
  ubahSaldoOlehAdmin({ idMember, aksi: "tambah", nominal, keterangan });

const kurangi = (idMember: string, nominal: string, keterangan: string) =>
  ubahSaldoOlehAdmin({ idMember, aksi: "kurangi", nominal, keterangan });

/** Isi Riwayat saldo halaman pertama tanpa waktu, yang ditulis database. */
async function barisRiwayat(idMember: string) {
  const { baris } = await riwayatSaldoMember({ idMember, halaman: 1 });
  return baris.map(({ jenis, nominal, saldoSesudah, rujukan }) => ({
    jenis,
    nominal,
    saldoSesudah,
    rujukan,
  }));
}

describe("saldo Member baru (PRD §15.1)", () => {
  it("dimulai dari Rp 0 tanpa Riwayat saldo", async () => {
    const { email, id } = await memberBaru();

    expect(await bacaSaldoMember(id)).toEqual({
      email,
      nonaktif: false,
      saldo: 0,
    });
    expect(await riwayatSaldoMember({ idMember: id, halaman: 1 })).toEqual({
      baris: [],
      jumlah: 0,
      halaman: 1,
      jumlahHalaman: 1,
    });
  });
});

describe("Tambah saldo dan Kurangi saldo oleh Admin (PRD §15.6)", () => {
  it("setiap perubahan menambah tepat satu baris Riwayat saldo dengan saldo sesudahnya, terbaru di atas", async () => {
    const { id } = await memberBaru();

    expect(
      await tambah(id, "50000", "  Ganti rugi akun Netflix bermasalah "),
    ).toMatchObject({ hasil: "diubah", saldoSesudah: 50000 });
    expect(
      await kurangi(id, "20000", "Pengembalian uang lewat transfer"),
    ).toMatchObject({ hasil: "diubah", saldoSesudah: 30000 });

    expect((await bacaSaldoMember(id))?.saldo).toBe(30000);
    expect(await barisRiwayat(id)).toEqual([
      {
        jenis: "Dikurangi Admin",
        nominal: -20000,
        saldoSesudah: 30000,
        rujukan: "Pengembalian uang lewat transfer",
      },
      {
        jenis: "Ditambah Admin",
        nominal: 50000,
        saldoSesudah: 50000,
        rujukan: "Ganti rugi akun Netflix bermasalah",
      },
    ]);
  });

  it("pengurangan Rp 1 lebih besar dari saldo ditolak dan saldo tetap; pengurangan sebesar seluruh saldo membuat saldo Rp 0", async () => {
    const { email, id } = await memberBaru();
    await tambah(id, "50000", "Saldo awal");

    expect(await kurangi(id, "50001", "Saldo dikembalikan")).toEqual({
      hasil: "ditolak",
      email,
      saldo: 50000,
      nominal: 50001,
      periksa: {
        valid: false,
        alasanNominal: null,
        alasanKeterangan: null,
        alasanSaldo: "tidak-cukup",
        saldoSesudah: null,
        keteranganTersimpan: null,
      },
    });
    expect((await bacaSaldoMember(id))?.saldo).toBe(50000);
    expect(await barisRiwayat(id)).toHaveLength(1);

    expect(await kurangi(id, "50000", "Saldo dikembalikan")).toMatchObject({
      hasil: "diubah",
      saldoSesudah: 0,
    });
    expect((await bacaSaldoMember(id))?.saldo).toBe(0);
    expect((await barisRiwayat(id))[0]).toEqual({
      jenis: "Dikurangi Admin",
      nominal: -50000,
      saldoSesudah: 0,
      rujukan: "Saldo dikembalikan",
    });
  });

  it("isian yang ditolak, misalnya tanpa keterangan, tidak mengubah saldo maupun Riwayat saldo", async () => {
    const { id } = await memberBaru();

    expect(await tambah(id, "5000", "   ")).toMatchObject({
      hasil: "ditolak",
      periksa: { alasanKeterangan: "kosong" },
    });

    expect((await bacaSaldoMember(id))?.saldo).toBe(0);
    expect(await barisRiwayat(id)).toEqual([]);
  });

  it("dua pengurangan bersamaan yang masing-masing sah tetapi jumlahnya melebihi saldo: satu berhasil, satu ditolak, dan saldo tidak negatif", async () => {
    const { id } = await memberBaru();
    await tambah(id, "50000", "Saldo awal");

    // Transaksi lain menahan baris Member itu dulu, supaya kedua pengurangan pasti dimulai sebelum salah satunya
    // selesai, lalu dilepas setelah keduanya berjalan.
    let lepas = () => {};
    const ditahan = new Promise<void>((selesai) => (lepas = selesai));
    let terkunci = () => {};
    const sudahTerkunci = new Promise<void>((s) => (terkunci = s));
    const penahan = db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, id))
        .for("update");
      terkunci();
      await ditahan;
    });
    await sudahTerkunci;

    const semuaPengurangan = Promise.all([
      kurangi(id, "30000", "Pengurangan pertama"),
      kurangi(id, "30000", "Pengurangan kedua"),
    ]);
    await new Promise((selesai) => setTimeout(selesai, 300));
    lepas();
    await penahan;
    const hasil = await semuaPengurangan;

    expect(hasil.map((h) => h.hasil).sort()).toEqual(["ditolak", "diubah"]);
    expect(hasil.find((h) => h.hasil === "ditolak")).toMatchObject({
      saldo: 20000,
      periksa: { alasanSaldo: "tidak-cukup" },
    });
    expect((await bacaSaldoMember(id))?.saldo).toBe(20000);
    const riwayat = await barisRiwayat(id);
    expect(riwayat).toHaveLength(2);
    expect(riwayat[0]).toMatchObject({ nominal: -30000, saldoSesudah: 20000 });
  });

  it("berlaku juga untuk Member nonaktif", async () => {
    const { id } = await memberBaru();
    await ubahStatusMember({ idMember: id, nonaktif: true });

    expect(await tambah(id, "20000", "Saldo awal")).toMatchObject({
      hasil: "diubah",
      saldoSesudah: 20000,
    });
    expect(await bacaSaldoMember(id)).toMatchObject({
      nonaktif: true,
      saldo: 20000,
    });
  });

  it("Member yang tidak ada menghasilkan tidak-ada", async () => {
    expect(await tambah(randomUUID(), "5000", "Koreksi")).toEqual({
      hasil: "tidak-ada",
    });
    expect(await bacaSaldoMember(randomUUID())).toBeNull();
  });
});

describe("Riwayat saldo per halaman (PRD §15.2)", () => {
  it("dibagi per 50 baris, terbaru di atas", async () => {
    const { id } = await memberBaru();
    for (let nomor = 1; nomor <= 51; nomor++) {
      await tambah(id, "1000", `Tambah ke-${nomor}`);
    }

    const pertama = await riwayatSaldoMember({ idMember: id, halaman: 1 });
    expect(pertama).toMatchObject({ jumlah: 51, halaman: 1, jumlahHalaman: 2 });
    expect(pertama.baris).toHaveLength(50);
    expect(pertama.baris[0]).toMatchObject({
      rujukan: "Tambah ke-51",
      saldoSesudah: 51000,
    });
    expect(pertama.baris[49].rujukan).toBe("Tambah ke-2");

    const kedua = await riwayatSaldoMember({ idMember: id, halaman: 2 });
    expect(kedua).toMatchObject({ jumlah: 51, halaman: 2, jumlahHalaman: 2 });
    expect(kedua.baris.map((b) => b.rujukan)).toEqual(["Tambah ke-1"]);
  });
});
