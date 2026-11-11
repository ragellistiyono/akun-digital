// Skema database Drizzle. Tabel ditambahkan oleh tiket yang membutuhkannya,
// lalu migrasinya dibuat dengan `pnpm exec drizzle-kit generate`.
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
