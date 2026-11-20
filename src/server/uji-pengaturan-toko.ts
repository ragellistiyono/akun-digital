// Bahan bersama untuk test integrasi yang mengubah Pengaturan toko. Berkas ini hanya diimpor oleh test.
import { koneksi } from "./db";

// Nomor kunci advisory PostgreSQL untuk Pengaturan toko. Angkanya bebas, asal tidak dipakai kunci lain.
const KUNCI_PENGATURAN_TOKO = 6801;

/**
 * Mengunci Pengaturan toko untuk satu berkas test, lalu memberi fungsi pelepasnya. Pengaturan toko berlaku untuk
 * seluruh toko, padahal berkas test berjalan bersamaan di app_test. Berkas yang mengubah isian Biaya transaksi
 * lalu memeriksa hasilnya memegang kunci ini selama berjalan, supaya berkas lain tidak menimpa isian itu di
 * tengah jalan. Kuncinya dipegang satu koneksi khusus, jadi query test sendiri tetap berjalan.
 */
export async function kunciPengaturanToko() {
  const sesi = await koneksi.reserve();
  await sesi`select pg_advisory_lock(${KUNCI_PENGATURAN_TOKO})`;
  return async () => {
    await sesi`select pg_advisory_unlock(${KUNCI_PENGATURAN_TOKO})`;
    sesi.release();
  };
}
