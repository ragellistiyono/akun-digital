# Fixture golden

Folder ini berisi contoh hitungan yang benar, yang diturunkan dari PRD.

Folder ini hanya-baca. Agent tidak boleh mengubahnya, karena folder ini termasuk berkas terlindungi. Kalau sebuah test merah, yang diperbaiki adalah kodenya, bukan fixture di sini.

Setiap aturan PRD punya satu berkas JSON, misalnya `denda-keterlambatan.json`. Isinya kasus-kasus dengan input, output yang diharapkan, dan rujukan ke PRD §.

## Aturan yang belum punya golden

<!-- Catat di sini aturan PRD yang belum punya contoh hitungan. -->

Aturan PRD yang memuat angka tetapi belum atau tidak punya berkas golden:

- **§2.3 total belanja Member** memakai hitungan yang sama dengan `pendapatan.json`, hanya untuk Pesanan Member itu dan tanpa batas rentang waktu.
- **§3.3 hingga 5 foto per Produk** adalah batas isian form, sehingga diuji lewat test form biasa.
- **§5.5 Kode unik Rp 1–499** ditentukan Qrispy, bukan dihitung toko. Toko hanya mencatat angka yang diberikan Qrispy.
- **§5.6 hitung mundur** hanya tampilan dari waktu kedaluwarsa. Aturan waktunya ada di `kedaluwarsa-pesanan.json`.
- **§6.4 kirim ulang email otomatis "beberapa kali"**: jumlah dan jedanya keputusan teknis, bukan aturan bisnis.
- **§2.2 dan §7.5 lama sesi login**: Admin 12 jam dan Member 30 hari sejak login (▶ Keputusan 2026-11-11). Ini pengaturan sesi login, bukan hitungan di modul domain, jadi diuji lewat test integrasi.
- **§8.3 Voucher dengan potongan Rp 0** sudah diputuskan (▶ Keputusan 2026-11-17, sebelumnya OD-3). Hasil akhirnya ada di `penerapan-voucher.json`, dan hitungan potongannya di `potongan-voucher.json`.
- **§9.2 kartu ringkasan** berupa hitungan jumlah dalam rentang dari `rentang-waktu-toko.json`. Pendapatannya ada di `pendapatan.json`, dan jumlah Pesanan Selesai menurut waktu bayar ada di `jumlah-pesanan-selesai.json`.
- **§9.4 urutan daftar Stok menipis** (Stok Varian terkecil di atas) adalah urutan tampil. Daftar `menipis` di `stok-menipis.json` mengikuti urutan input dan tidak menguji urutan tampil.
- **§7.2 jeda 60 detik untuk pendaftaran ulang** memakai aturan yang sama dengan `kirim-ulang-kode-verifikasi.json`.
- **§10.1 batas paket gratis Resend** adalah batas layanan luar, bukan aturan aplikasi.
- **§11.1 lebar layar 360 piksel** diuji lewat test end-to-end di ukuran ponsel.
- **§12 tujuh cadangan harian** diatur oleh skrip di server, bukan oleh modul domain.
- **§9.2 kartu Item stok Tersedia, Item stok Terkirim, Pesanan Menunggu Pembayaran, dan Member terdaftar** (▶ Keputusan 2026-11-20) adalah hitungan jumlah tanpa rumus. Cakupannya tertulis di PRD dan diuji lewat test integrasi. Kartu uangnya memakai `laba.json` dan `pendapatan.json`.
- **§14.3 Biaya transaksi Pesanan yang dibayar sebelum fitur tayang** dihitung sekali dengan nilai awal (0,7% dan Rp 100.000) memakai rumus `biaya-transaksi.json`. Ini pekerjaan migrasi data, jadi diuji lewat test migrasi.
- **§14.6 penolakan tanggal akhir sebelum tanggal mulai** dan **§14.8 50 Pesanan per halaman** adalah aturan form dan tampilan, jadi diuji lewat test biasa.
- **§14.7 Pendapatan per Kategori** adalah penjumlahan `pendapatan.json` per Kategori, dengan Pendapatan terbesar di atas. Urutan tampil ini tidak punya berkas golden sendiri.
