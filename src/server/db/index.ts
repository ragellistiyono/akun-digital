import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL kosong, jadi aplikasi tidak bisa membuka database. Salin `.env.example` menjadi `.env`, isi DATABASE_URL, lalu jalankan ulang perintahnya.",
  );
}

/** Koneksi PostgreSQL bersama. Perintah sekali jalan menutupnya dengan `koneksi.end()`. */
export const koneksi = postgres(url, { onnotice: () => {} });

export const db = drizzle(koneksi, { schema });
