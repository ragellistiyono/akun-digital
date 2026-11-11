// Skema database Drizzle. Tabel ditambahkan oleh tiket yang membutuhkannya,
// lalu migrasinya dibuat dengan `pnpm exec drizzle-kit generate`.
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { STATUS_ITEM_STOK } from "../../domain/item-stok";

// Tabel login Better Auth untuk email dan password (ADR-0001). Nama tabel dan kolom mengikuti
// skema bawaan Better Auth, supaya adaptor Drizzle-nya bisa memakainya tanpa pemetaan.
const instan = (nama: string) => timestamp(nama, { withTimezone: true });

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: instan("created_at").defaultNow().notNull(),
  updatedAt: instan("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: instan("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (tabel) => [index("session_user_id_idx").on(tabel.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instan("access_token_expires_at"),
    refreshTokenExpiresAt: instan("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (tabel) => [index("account_user_id_idx").on(tabel.userId)],
);

// Better Auth mewajibkan tabel ini walaupun login Admin belum memakainya (kode sekali pakai,
// misalnya untuk verifikasi email atau atur ulang password).
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instan("expires_at").notNull(),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (tabel) => [index("verification_identifier_idx").on(tabel.identifier)],
);

// Batas salah password login (PRD §7.7), satu baris per email dalam bentuk bakunya (PRD §7.4).
// Baris juga dibuat untuk email yang tidak terdaftar, supaya penolakannya sama dengan email Admin.
export const batasLogin = pgTable("batas_login", {
  email: text("email").primaryKey(),
  jumlahSalah: integer("jumlah_salah").default(0).notNull(),
  terkunciSampai: instan("terkunci_sampai"),
});

// Kategori (PRD §3.1): satu tingkat, dengan nama dan gambar ikon. Kolom ikon berisi nama berkas
// gambar di folder unggahan (src/server/berkas-unggahan.ts).
export const kategori = pgTable("kategori", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: text("nama").notNull(),
  ikon: text("ikon").notNull(),
});

// Produk (PRD §3.2, §3.3, §3.6, §3.7) di tepat satu Kategori. Kategori yang masih berisi Produk tidak
// bisa dihapus (PRD §3.1), jadi rujukannya restrict. Format Item stok (PRD §4.1) disimpan sebagai
// daftar nama kolom berurutan; aturan isinya (issue T07) diperiksa periksaFormatItemStok di domain.
// Foto Produk (PRD §3.3) adalah daftar nama berkas gambar di folder unggahan menurut urutannya; foto
// pertama menjadi sampul. Batas 5 foto diperiksa tambahFoto di domain.
export const produk = pgTable(
  "produk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategori.id, { onDelete: "restrict" }),
    deskripsi: text("deskripsi").notNull(),
    ketentuanGaransi: text("ketentuan_garansi").notNull(),
    unggulan: boolean("unggulan").default(false).notNull(),
    aktif: boolean("aktif").default(true).notNull(),
    formatItemStok: text("format_item_stok").array().notNull(),
    foto: text("foto").array().default([]).notNull(),
  },
  (tabel) => [index("produk_kategori_id_idx").on(tabel.kategoriId)],
);

// Varian (PRD §3.2, §3.5, §3.7): pilihan di dalam sebuah Produk, dengan Harga jual dan Harga normal
// opsional dalam rupiah bulat. Aturan harganya diperiksa periksaHarga di domain. Harga normal tidak
// dibatasi maksimum, jadi disimpan sebagai bigint. Varian tidak ada tanpa Produknya, jadi ikut
// terhapus bersama Produk (T29).
export const varian = pgTable(
  "varian",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produkId: uuid("produk_id")
      .notNull()
      .references(() => produk.id, { onDelete: "cascade" }),
    nama: text("nama").notNull(),
    hargaJual: integer("harga_jual").notNull(),
    hargaNormal: bigint("harga_normal", { mode: "number" }),
    aktif: boolean("aktif").default(true).notNull(),
  },
  (tabel) => [index("varian_produk_id_idx").on(tabel.produkId)],
);

// Status Item stok (GLOSSARY): Tersedia, Ditahan, atau Terkirim. Stok Varian dihitung dari status ini
// oleh stokVarian di domain (PRD §5.3).
export const statusItemStok = pgEnum("status_item_stok", STATUS_ITEM_STOK);

// Item stok (PRD §4) milik satu Varian. Isinya, yaitu isi kolom-kolom Format Item stok, disimpan
// terenkripsi (PRD §12) oleh src/server/enkripsi-item-stok.ts. Sidik jari HMAC dari isinya dipakai
// untuk menolak Item stok yang sama persis di Varian yang sama (PRD §4.2) tanpa membuka Item stok
// lain; indeks unik menjaganya juga bila dua Admin mengisi bersamaan. Item stok tidak ada tanpa
// Variannya, jadi ikut terhapus bersama Varian.
export const itemStok = pgTable(
  "item_stok",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    varianId: uuid("varian_id")
      .notNull()
      .references(() => varian.id, { onDelete: "cascade" }),
    isiTerenkripsi: text("isi_terenkripsi").notNull(),
    sidikJari: text("sidik_jari").notNull(),
    status: statusItemStok("status").default("Tersedia").notNull(),
  },
  (tabel) => [
    uniqueIndex("item_stok_varian_id_sidik_jari_idx").on(
      tabel.varianId,
      tabel.sidikJari,
    ),
  ],
);
