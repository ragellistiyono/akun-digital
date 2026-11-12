// `pnpm db:seed`: mengisi database dengan data "Persiapan bersama" di docs/UAT.md untuk UAT M1 (PRD §13
// ▶ Keputusan 2026-11-11). Isinya contoh [CONTOH] dan ada di src/server/seed-uat.ts. Seed boleh dijalankan
// ulang: data seed yang sudah ada dilewati, jadi tidak tergandakan.
import { config } from "dotenv";

// Variabel lingkungan dari shell didahulukan; .env hanya mengisi yang belum ada.
config({ quiet: true });

// Modul database dimuat setelah .env terbaca, karena ia membaca DATABASE_URL saat dimuat.
const { ADMIN_SEED, isiSeedUat } = await import("../src/server/seed-uat");
const { koneksi } = await import("../src/server/db");
try {
  const dibuat = await isiSeedUat();
  console.log(
    [
      "Data seed UAT selesai. Data seed yang sudah ada dilewati. Baru dibuat:",
      `- ${dibuat.admin} Admin, ${dibuat.kategori} Kategori, ${dibuat.produk} Produk, ${dibuat.varian} Varian, ${dibuat.foto} foto;`,
      `- ${dibuat.itemStok} Item stok dan ${dibuat.pesanan} Pesanan;`,
      `- Pengaturan toko: ${dibuat.pengaturanToko === 1 ? "diisi" : "tidak diubah, karena sudah terisi"}.`,
      `Login di /admin sebagai ${ADMIN_SEED.email}. Password-nya ada di src/server/seed-uat.ts.`,
    ].join("\n"),
  );
} catch (galat) {
  console.error(galat instanceof Error ? galat.message : galat);
  process.exitCode = 1;
} finally {
  await koneksi.end();
}
