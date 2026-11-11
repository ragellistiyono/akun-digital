// `pnpm admin:buat <email>`: membuat Admin baru (PRD §2.2). Tidak ada halaman untuk mendaftar Admin.
// Password dibaca dari input, bukan dari argumen perintah, supaya tidak tersimpan di riwayat shell.
// Di terminal, password yang diketik tidak ditampilkan. Bila input disalurkan (pipe), dua baris
// pertamanya dibaca sebagai password dan ulangannya.
import { createInterface } from "node:readline";

import { config } from "dotenv";
import { z } from "zod";

import {
  PANJANG_PASSWORD_MINIMUM,
  periksaPanjangPassword,
} from "../src/domain/panjang-password";

// Variabel lingkungan dari shell didahulukan; .env hanya mengisi yang belum ada.
config({ quiet: true });

function gagal(pesan: string): never {
  console.error(pesan);
  process.exit(1);
}

const barisMasukan = process.stdin.isTTY
  ? null
  : createInterface({ input: process.stdin, terminal: false })[
      Symbol.asyncIterator
    ]();

function bacaTersembunyiDariTerminal(): Promise<string> {
  const stdin = process.stdin;
  return new Promise((resolve) => {
    let isi = "";
    const selesai = () => {
      stdin.off("data", tiapKetikan);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(isi);
    };
    const tiapKetikan = (data: string) => {
      for (const huruf of data) {
        if (huruf === "\r" || huruf === "\n" || huruf === "\u0004") {
          selesai();
          return;
        }
        if (huruf === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        isi =
          huruf === "\u007f" || huruf === "\b" ? isi.slice(0, -1) : isi + huruf;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", tiapKetikan);
    stdin.resume();
  });
}

async function tanyaPassword(pertanyaan: string): Promise<string> {
  process.stdout.write(pertanyaan);
  if (!barisMasukan) return bacaTersembunyiDariTerminal();

  const { value, done } = await barisMasukan.next();
  process.stdout.write("\n");
  if (done) {
    gagal(
      "Password tidak terbaca karena input sudah habis. Jalankan ulang perintahnya di terminal, lalu ketik password saat diminta.",
    );
  }
  return value;
}

const email = z.email().safeParse(process.argv[2]?.trim().toLowerCase() ?? "");
if (!email.success) {
  gagal(
    "Email Admin belum diisi atau tidak sah. Jalankan `pnpm admin:buat <email>`, misalnya `pnpm admin:buat admin@example.com`.",
  );
}

const password = await tanyaPassword("Password Admin baru: ");
if (password === "") {
  gagal(
    "Password belum diisi. Jalankan ulang perintahnya, lalu ketik password Admin saat diminta.",
  );
}
// Ditolak sebelum diminta mengulang, supaya pemilik tidak mengetik ulang password yang pasti ditolak.
if (!periksaPanjangPassword(password).valid) {
  gagal(
    `Password terlalu pendek: password Admin minimal ${PANJANG_PASSWORD_MINIMUM} karakter. Jalankan ulang perintahnya, lalu ketik password yang panjangnya minimal ${PANJANG_PASSWORD_MINIMUM} karakter.`,
  );
}
const ulangan = await tanyaPassword("Ulangi password: ");
if (ulangan !== password) {
  gagal(
    "Kedua password tidak sama. Jalankan ulang perintahnya, lalu ketik password yang sama dua kali.",
  );
}

// Modul database dimuat setelah .env terbaca, karena ia membaca DATABASE_URL saat dimuat.
const { buatAdmin } = await import("../src/server/auth/buat-admin");
const { koneksi } = await import("../src/server/db");
try {
  const hasil = await buatAdmin({ email: email.data, password });
  if (hasil.hasil === "email-sudah-dipakai") {
    gagal(
      `Email ${email.data} sudah dipakai Admin lain. Pakai email lain, atau login di /admin dengan email itu.`,
    );
  }
  console.log(
    `Admin ${email.data} sudah dibuat. Login di /admin dengan email dan password tadi.`,
  );
} finally {
  await koneksi.end();
}
