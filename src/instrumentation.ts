// Dipanggil Next.js sekali setiap kali server dimulai (`next start` maupun `next dev`), sebelum server
// melayani permintaan. Pekerjaan latar pg-boss (ADR-0001) berjalan di proses server yang sama dengan
// aplikasi, karena toko berjalan sebagai satu proses di satu VPS (PRD §12) dan Qrispy tiruan menyimpan
// pembayarannya di memori proses itu. Bila PostgreSQL tidak terjangkau, server gagal dimulai dengan galat
// dari pg-boss. Konfigurasi Qrispy diperiksa lebih dulu, sehingga QRISPY_MODE=sungguhan tanpa token atau
// webhook secret membuat server gagal dimulai. `next build` tidak memanggil register(), jadi build tidak
// membutuhkan variabel itu.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { periksaKonfigurasiQrispy } = await import("@/server/qrispy");
  periksaKonfigurasiQrispy();
  const { jalankanPekerjaanLatar } = await import("@/server/pekerjaan-latar");
  await jalankanPekerjaanLatar();
}
