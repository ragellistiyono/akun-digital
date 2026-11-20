// `pnpm db:seed`: mengisi database lokal dengan data "Persiapan bersama" di docs/UAT.md, termasuk Member dan
// Voucher (docs/UAT.md ▶ Keputusan 2026-11-17). Isinya contoh [CONTOH] dan ada di src/server/seed-uat.ts. Seed
// boleh dijalankan ulang: data seed yang sudah ada dilewati, jadi tidak tergandakan.
import { config } from "dotenv";

// Variabel lingkungan dari shell didahulukan; .env hanya mengisi yang belum ada.
config({ quiet: true });

// Modul database dimuat setelah .env terbaca, karena ia membaca DATABASE_URL saat dimuat.
const { ADMIN_SEED, MEMBER_SEED, isiSeedUat } =
  await import("../src/server/seed-uat");
const { koneksi } = await import("../src/server/db");
try {
  const dibuat = await isiSeedUat();
  console.log(
    [
      "Data seed UAT selesai. Data seed yang sudah ada dilewati. Baru dibuat:",
      `- ${dibuat.admin} Admin, ${dibuat.member} Member, ${dibuat.kategori} Kategori, ${dibuat.produk} Produk, ${dibuat.varian} Varian, ${dibuat.foto} foto;`,
      `- ${dibuat.itemStok} Item stok, ${dibuat.voucher} Voucher, ${dibuat.pesanan} Pesanan, dan ${dibuat.biayaOperasional} Biaya operasional;`,
      `- Pengaturan toko: ${dibuat.pengaturanToko === 1 ? "diisi" : "tidak diubah, karena sudah terisi"}.`,
      `Login di /admin sebagai ${ADMIN_SEED.email}, dan di halaman Masuk sebagai ${MEMBER_SEED.aktif.email} (aktif) atau ${MEMBER_SEED.nonaktif.email} (nonaktif). Password-nya ada di src/server/seed-uat.ts.`,
    ].join("\n"),
  );
} catch (galat) {
  console.error(galat instanceof Error ? galat.message : galat);
  process.exitCode = 1;
} finally {
  await koneksi.end();
}
