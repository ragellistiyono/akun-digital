// Enkripsi isi Item stok di database (PRD §12) dengan kunci dari ITEM_STOK_KEY. Isi Item stok, yaitu
// isi kolom-kolom Format Item stok menurut urutannya, dienkripsi dengan AES-256-GCM. Sidik jarinya
// berupa HMAC-SHA256, supaya Item stok yang sama persis bisa dikenali tanpa membuka Item stok lain
// (PRD §4.2). Kedua kunci itu diturunkan dari ITEM_STOK_KEY dengan HKDF, jadi saling terpisah.
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { z } from "zod";

/** Kunci enkripsi dan kunci sidik jari Item stok, diturunkan dari ITEM_STOK_KEY. */
type KunciItemStok = { enkripsi: Buffer; sidikJari: Buffer };

type HasilBacaKunci =
  | { hasil: "ada"; kunci: KunciItemStok }
  | { hasil: "belum-diisi" | "tidak-sah" };

// ITEM_STOK_KEY berisi tepat 32 byte acak dalam base64, misalnya hasil `openssl rand -base64 32`.
const POLA_KUNCI = /^[A-Za-z0-9+/]{43}=$/;
const PANJANG_IV = 12;
const PANJANG_TAG = 16;

const turunkan = (kunciInduk: Buffer, kegunaan: string) =>
  Buffer.from(hkdfSync("sha256", kunciInduk, "", kegunaan, 32));

/**
 * Membaca kunci Item stok dari ITEM_STOK_KEY. Dibaca saat dipakai, bukan saat modul dimuat, supaya
 * `next build` tidak membutuhkannya.
 */
export function bacaKunciItemStok(): HasilBacaKunci {
  const nilai = process.env.ITEM_STOK_KEY?.trim();
  if (!nilai) return { hasil: "belum-diisi" };
  if (!POLA_KUNCI.test(nilai)) return { hasil: "tidak-sah" };

  const kunciInduk = Buffer.from(nilai, "base64");
  return {
    hasil: "ada",
    kunci: {
      enkripsi: turunkan(kunciInduk, "item-stok/enkripsi"),
      sidikJari: turunkan(kunciInduk, "item-stok/sidik-jari"),
    },
  };
}

// Isi Item stok ditulis sebagai larik JSON, supaya batas antarkolom tidak pernah bercampur dengan isi
// kolomnya, termasuk bila isinya memuat |.
const teksItemStok = (nilai: readonly string[]) => JSON.stringify(nilai);

/**
 * Sidik jari sebuah Item stok: HMAC-SHA256 dari isi kolomnya dalam heksadesimal. Item stok yang sama
 * persis selalu mendapat sidik jari yang sama, tetapi isinya tidak bisa dibaca dari sidik jari itu.
 */
export function sidikJariItemStok(
  kunci: KunciItemStok,
  nilai: readonly string[],
) {
  return createHmac("sha256", kunci.sidikJari)
    .update(teksItemStok(nilai))
    .digest("hex");
}

/**
 * Mengenkripsi isi sebuah Item stok dengan AES-256-GCM dan IV acak. Hasilnya base64 dari IV, tag
 * autentikasi, lalu teks tersandi.
 */
export function enkripsiItemStok(
  kunci: KunciItemStok,
  nilai: readonly string[],
) {
  const iv = randomBytes(PANJANG_IV);
  const sandi = createCipheriv("aes-256-gcm", kunci.enkripsi, iv);
  const tersandi = Buffer.concat([
    sandi.update(teksItemStok(nilai), "utf8"),
    sandi.final(),
  ]);
  return Buffer.concat([iv, sandi.getAuthTag(), tersandi]).toString("base64");
}

const IsiItemStok = z.array(z.string());

/**
 * Membuka isi Item stok yang dienkripsi enkripsiItemStok, dengan ITEM_STOK_KEY yang sama. Melempar
 * galat bila ITEM_STOK_KEY belum diisi atau tidak sah, atau bila isinya tidak bisa dibuka dengan kunci
 * itu.
 */
export function bukaItemStok(isiTerenkripsi: string): string[] {
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    throw new Error(
      "ITEM_STOK_KEY belum diisi atau tidak sah, jadi isi Item stok tidak bisa dibuka. Isi ITEM_STOK_KEY di berkas .env server dengan kunci yang dipakai saat Item stok disimpan, lalu jalankan ulang aplikasinya.",
    );
  }
  const data = Buffer.from(isiTerenkripsi, "base64");
  const iv = data.subarray(0, PANJANG_IV);
  const tag = data.subarray(PANJANG_IV, PANJANG_IV + PANJANG_TAG);
  const tersandi = data.subarray(PANJANG_IV + PANJANG_TAG);

  const pembuka = createDecipheriv("aes-256-gcm", kunci.kunci.enkripsi, iv);
  pembuka.setAuthTag(tag);
  const teks = Buffer.concat([
    pembuka.update(tersandi),
    pembuka.final(),
  ]).toString("utf8");
  return IsiItemStok.parse(JSON.parse(teks));
}
