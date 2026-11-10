# Akun Digital

Toko web MIWE Digital Store untuk menjual akun digital, misalnya akun premium aplikasi dan game, kepada pembeli umum. Pembeli memesan, membayar, lalu menerima detail akunnya lewat web. Tidak mencakup aplikasi ponsel. Aturan bisnis lengkap ada di `docs/PRD.md`. Berkas ini hanya berisi glosarium.

## Language

<!-- Diisi lewat /tiket:rencanakan-produk. Tulis satu istilah per entri:

**Istilah**:
Definisi satu atau dua kalimat yang menjelaskan apa istilah itu, bukan apa yang dilakukannya.
_Avoid_: sinonim yang tidak dipakai

Bila istilah-istilah membentuk kelompok, kelompokkan dengan subjudul (### …). -->

Kata "akun" tidak dipakai sendirian sebagai istilah, karena bisa berarti barang yang dijual atau akun login di toko.

### Katalog

**Kategori**:
Kelompok satu tingkat tempat setiap Produk berada, misalnya "Streaming" atau "Game".
_Avoid_: subkategori, grup, kelompok

**Produk**:
Barang yang tampil di katalog dan bisa dibeli, misalnya "Netflix Premium".
_Avoid_: akun, akun digital, barang, item

**Varian**:
Pilihan di dalam sebuah Produk, misalnya "1 Bulan" atau "3 Bulan", yang punya Harga jual dan Item stok sendiri.
_Avoid_: paket, tipe, opsi, SKU

**Harga jual**:
Harga sebuah Varian sebelum potongan voucher.
_Avoid_: harga (tanpa keterangan), harga diskon

**Harga normal**:
Harga pembanding opsional sebuah Varian yang tampil dicoret di samping Harga jual dan tidak ikut hitungan pembayaran.
_Avoid_: harga coret, harga asli, harga awal

**Persen hemat**:
Selisih Harga normal dan Harga jual dalam persen bulat, yang tampil sebagai label "Hemat N%".
_Avoid_: persen diskon, persen potongan

**Produk Unggulan**:
Produk yang ditandai Admin untuk tampil di bagian atas beranda.
_Avoid_: produk pilihan, produk rekomendasi, featured

### Item stok

**Item stok**:
Satu set detail berbentuk teks milik sebuah Varian, misalnya data login akun, kode lisensi, atau kode redeem, yang dikirim ke tepat satu Pesanan.
_Avoid_: akun, kredensial, stok (untuk satu item), data akun

**Format Item stok**:
Daftar kolom yang ditetapkan Admin per Produk untuk mengisi Item stok, misalnya `Email`, `Password`, `Profil`.
_Avoid_: format akun, template akun, skema

**Stok Varian**:
Jumlah Item stok sebuah Varian yang masih bisa dijual.
_Avoid_: kuantitas, persediaan

**Tersedia**:
Status Item stok yang belum terkirim dan tidak sedang ditahan.
_Avoid_: ready, aktif, belum terjual

**Ditahan**:
Status Item stok yang sedang disisihkan untuk satu Pesanan Menunggu Pembayaran.
_Avoid_: reserved, dipesan, terkunci

**Terkirim**:
Status Item stok yang sudah dikirim ke sebuah Pesanan dan tidak bisa dipakai lagi.
_Avoid_: terjual, sold, terpakai

**Ambang stok menipis**:
Angka Stok Varian yang dianggap menipis, diatur Admin di pengaturan toko.
_Avoid_: minimum stok, safety stock, batas stok

### Pesanan dan pembayaran

**Pesanan**:
Satu pembelian satu Varian oleh seorang Pembeli, yang mendapat tepat satu Item stok setelah dibayar.
_Avoid_: order, transaksi, pembelian, invoice

**Nomor Pesanan**:
Kode acak berawalan `MIWE-` yang mengenali satu Pesanan, misalnya `MIWE-7K3P9Q`.
_Avoid_: ID order, nomor invoice, nomor transaksi

**Pendapatan**:
Jumlah Total bayar dari Pesanan Selesai dalam suatu rentang waktu.
_Avoid_: omzet, revenue, penjualan, pemasukan

**Qrispy**:
Layanan pembayaran QRIS yang dipakai toko untuk menerbitkan QRIS dan mengabarkan pembayaran.
_Avoid_: payment gateway, PG

**Halaman bayar**:
Halaman yang menampilkan QRIS dan rincian Total bayar sebuah Pesanan Menunggu Pembayaran.
_Avoid_: halaman checkout, halaman invoice

**Halaman Produk**:
Halaman satu Produk yang menampilkan foto, deskripsi, ketentuan garansi, dan Variannya.
_Avoid_: detail produk, halaman item

**Halaman Pesanan**:
Halaman satu Pesanan yang menampilkan status, rincian nominal, dan Item stoknya bila Selesai.
_Avoid_: halaman sukses, halaman terima kasih

**QRIS**:
Tagihan berbentuk kode QR yang diterbitkan Qrispy untuk satu Pesanan dan punya masa berlaku.
_Avoid_: invoice, kode bayar, QR code

**Kode unik**:
Tambahan Rp 1–499 yang dibubuhkan Qrispy pada setiap tagihan dan dibayar Pembeli.
_Avoid_: biaya admin, biaya layanan, kode pembayaran

**Total bayar**:
Nominal yang harus dibayar Pembeli untuk sebuah Pesanan, yaitu Harga jual dikurangi potongan voucher ditambah Kode unik.
_Avoid_: grand total, jumlah tagihan, nominal

**Penahanan**:
Keadaan sebuah Item stok yang disisihkan untuk satu Pesanan Menunggu Pembayaran, sehingga tidak bisa dibeli orang lain.
_Avoid_: reservasi, booking, lock, hold

**Menunggu Pembayaran**:
Status Pesanan yang QRIS-nya sudah terbit tetapi belum dibayar.
_Avoid_: pending, belum bayar

**Selesai**:
Status Pesanan yang sudah dibayar dan Item stoknya sudah dikirim.
_Avoid_: lunas, sukses, paid, berhasil

**Kedaluwarsa**:
Status Pesanan yang masa berlaku QRIS-nya lewat tanpa pembayaran.
_Avoid_: expired, hangus, kadaluarsa

**Dibatalkan**:
Status Pesanan yang dibatalkan Pembeli sebelum membayar.
_Avoid_: cancel, batal, gagal

**Bermasalah**:
Status Pesanan yang sudah dibayar tetapi Item stoknya belum bisa dikirim.
_Avoid_: gagal, error, tertunda

**Dana Dikembalikan**:
Status Pesanan Bermasalah yang uangnya sudah dikembalikan Admin di luar sistem.
_Avoid_: refund, dikembalikan

### Voucher

**Voucher**:
Kode yang diketik Pembeli saat checkout untuk mendapat Potongan voucher pada satu Pesanan.
_Avoid_: kupon, promo, kode promo, redeem

**Potongan voucher**:
Nominal yang dikurangkan dari Harga jual sebuah Pesanan karena Voucher.
_Avoid_: diskon, rabat, potongan harga

**Kuota voucher**:
Jumlah maksimum pemakaian sebuah Voucher oleh semua Pembeli.
_Avoid_: stok voucher, limit voucher

**Batas per email**:
Jumlah maksimum pemakaian sebuah Voucher oleh satu email.
_Avoid_: limit per user, kuota per orang

**Cakupan voucher**:
Produk atau Kategori tempat sebuah Voucher boleh dipakai, atau semua Produk.
_Avoid_: target voucher, produk berlaku

### Toko

**Dasbor admin**:
Bagian toko di bawah `/admin` tempat Admin mengelola toko.
_Avoid_: panel admin, backoffice, CMS

**Dasbor Member**:
Bagian toko tempat Member melihat Riwayat Pesanan dan mengelola profilnya.
_Avoid_: dashboard user, akun saya

**Pengaturan toko**:
Isian yang diubah Admin untuk nomor WhatsApp, Ambang stok menipis, dan teks halaman Syarat & Ketentuan serta Kebijakan Privasi.
_Avoid_: settings, konfigurasi

**Zona waktu toko**:
Zona waktu yang dipakai semua tanggal dan jam di toko, yaitu WIB.
_Avoid_: timezone, waktu server

### Orang

**Tamu**:
Pengunjung toko yang belum login.
_Avoid_: guest, pengunjung anonim

**Admin**:
Pengelola toko yang login di dasbor admin. Semua Admin punya hak yang sama.
_Avoid_: owner, superadmin, staf, operator

**Pembeli**:
Orang yang melakukan checkout di toko, baik yang sudah menjadi Member maupun yang belum.
_Avoid_: user, customer, pelanggan, pengguna

**Member**:
Pembeli yang sudah punya akun login terverifikasi di toko.
_Avoid_: akun, user, pengguna terdaftar

**Member nonaktif**:
Member yang dinonaktifkan Admin, sehingga tidak bisa login maupun checkout dengan emailnya.
_Avoid_: diblokir, banned, suspended

**Kode verifikasi**:
Kode 6 digit yang dikirim ke email untuk membuktikan bahwa pendaftar memang memegang email itu.
_Avoid_: OTP, PIN, token

**Riwayat Pesanan**:
Daftar semua Pesanan yang emailnya sama dengan email seorang Member.
_Avoid_: history, histori transaksi, riwayat pembelian

**Tautan Pesanan**:
Alamat acak halaman Pesanan yang dikirim lewat email dan bisa membuka Pesanan itu tanpa login.
_Avoid_: link rahasia, magic link, tautan unik
