# Skenario UAT Akun Digital

<!-- Buat satu bagian untuk setiap bagian PRD. Setiap skenario memuat:
- ID, misalnya UAT-A1;
- langkah-langkahnya;
- hasil yang diharapkan;
- rujukan ke PRD §.
Disusun lewat /tiket:rencanakan-produk dan dijalankan pemilik di akhir tahap. Data uji memakai nilai bertanda [CONTOH]. -->

## Persiapan bersama

1. Jalankan aplikasi dengan data seed. Isi seed berikut bertanda `[CONTOH]`:
   - **Admin:** `admin@miwe.example`. Password-nya ada di berkas seed.
   - **Member:** `member@miwe.example` (aktif) dan `nonaktif@miwe.example` (nonaktif). Password-nya ada di berkas seed.
   - **Kategori:** "Streaming", "Musik", dan "Game". Kategori "Game" hanya berisi Produk nonaktif.
   - **Produk "Netflix Premium":**
     - Kategori Streaming, ditandai Produk Unggulan;
     - Format Item stok `Email`, `Password`, `Profil`;
     - Varian "1 Bulan": Harga jual Rp 50.000, Harga normal Rp 75.000, 10 Item stok Tersedia;
     - Varian "3 Bulan": Harga jual Rp 135.000, 4 Item stok Tersedia.
   - **Produk "YouTube Premium":** Kategori Streaming, Varian "1 Bulan" Rp 20.000 tanpa Item stok, dan Varian "3 Bulan" Rp 55.000 dengan 3 Item stok Tersedia.
   - **Produk "Spotify Premium":** Kategori Musik, satu Varian "1 Bulan" Rp 25.000, tanpa Item stok.
   - **Produk "Uji Bayar":** Kategori Streaming, satu Varian Rp 1.000, Format Item stok `Kode`, 10 Item stok Tersedia. Produk ini dipakai untuk pembayaran sungguhan.
   - **Produk "Game Lama":** Kategori Game, nonaktif.
   - **Voucher:**
     - `HEMAT5`: nominal Rp 5.000, Batas per email 1;
     - `HEMAT10`: 10% maksimal Rp 10.000, minimal Harga jual Rp 50.000;
     - `MEMBER20`: 20%, khusus Member;
     - `SATUKALI`: nominal Rp 2.000, Kuota voucher 1;
     - `LAMA`: masa berlakunya sudah berakhir kemarin;
     - `MATI`: nonaktif.
   - **Pesanan Bermasalah:** dua Pesanan Bermasalah untuk Netflix Premium 1 Bulan.
   - **Pesanan Selesai:** satu Pesanan Selesai milik `member@miwe.example` yang memakai `HEMAT5`.
   - **Pengaturan toko:** Ambang stok menipis 5.
2. Siapkan dua email yang bisa Anda buka sendiri, disebut **Email A** dan **Email B**.
3. Siapkan ponsel dengan aplikasi e-wallet, dan laptop.
4. Qrispy tidak punya mode uji. Skenario bertanda **(bayar)** memakai pembayaran sungguhan Rp 1.000 ditambah Kode unik lewat Produk "Uji Bayar". Skenario lain cukup sampai halaman bayar, lalu dibatalkan.
5. Skenario bertanda **(tunggu)** butuh menunggu beberapa menit.
6. Jalankan skenario sesuai urutan di berkas ini. Setiap skenario yang membuat Pesanan Menunggu Pembayaran ditutup dengan membatalkannya, supaya tidak mengganggu skenario berikutnya (§5.4).

▶ Keputusan 2026-11-12 (#87): Isi data seed M1 (`pnpm db:seed`):
- Pesanan Selesai milik `member@miwe.example` adalah Netflix Premium 1 Bulan, tanpa voucher, karena voucher milik M2.
- Kedua Pesanan Bermasalah memakai email contoh `bermasalah-1@miwe.example` dan `bermasalah-2@miwe.example`, yang tidak bisa menerima email. UAT-E6 mengoreksi email Pesanan pertama menjadi Email A lebih dulu (§6.4).
- Produk "Game Lama" tidak punya Varian. Akibatnya Kategori "Game" tetap tersembunyi di toko walaupun Game Lama diaktifkan.

## A. Tujuan dan batas (§1)

**UAT-A1 — Pembelian tanpa campur tangan Admin (bayar)**
- Langkah:
  1. Di ponsel, sebagai Tamu, buka toko.
  2. Pilih "Uji Bayar" dan checkout dengan Email A.
  3. Simpan gambar QR, lalu bayar dari aplikasi e-wallet.
- Hasil:
  - Dalam satu menit setelah membayar, halaman berpindah sendiri dan menampilkan Item stok.
  - Email "Pesanan selesai" masuk ke Email A.
  - Tidak ada Admin yang melakukan apa pun.
- PRD: §1.2

## B. Pengguna dan peran (§2)

**UAT-B1 — Login Admin terpisah**
- Langkah:
  1. Buka `/admin`, lalu login sebagai Admin.
  2. Keluar. Login sebagai `member@miwe.example` di halaman login Member, lalu buka `/admin`.
- Hasil:
  - Admin masuk ke dasbor admin.
  - Member tidak bisa membuka dasbor admin.
  - Tidak ada halaman untuk mendaftar Admin.
- PRD: §2.1, §2.2

**UAT-B2 — Tamu tidak bisa membuka dasbor admin**
- Langkah: sebagai Tamu, buka `/admin/pesanan`.
- Hasil: Tamu diarahkan ke halaman login Admin.
- PRD: §2.1

**UAT-B3 — Menonaktifkan dan mengaktifkan Member**
- Langkah:
  1. Sebagai Admin, buka daftar Member, lalu nonaktifkan `member@miwe.example`.
  2. Coba login sebagai Member itu.
  3. Sebagai Tamu, coba checkout dengan email itu.
  4. Aktifkan kembali Member itu, lalu login lagi.
- Hasil:
  - Daftar Member menampilkan email, tanggal daftar, jumlah Pesanan Selesai, dan total belanja.
  - Selama nonaktif, login dan checkout ditolak.
  - Setelah diaktifkan kembali, login berhasil.
  - Admin tidak pernah melihat password Member.
- PRD: §2.3

**UAT-B4 — Password Admin baru**
- Langkah:
  1. Di server, jalankan `pnpm admin:buat admin-baru@miwe.example` dan ketik password 7 karakter dua kali.
  2. Jalankan lagi dengan password 8 karakter.
  3. Login di `/admin` dengan Admin itu.
- Hasil:
  - Langkah 1 ditolak dengan pesan bahwa password minimal 8 karakter, dan Admin tidak dibuat.
  - Langkah 2 membuat Admin, dan Admin itu bisa login.
- PRD: §2.2

## C. Katalog (§3)

**UAT-C1 — Beranda dan pencarian**
- Langkah:
  1. Buka beranda.
  2. Ketik "netflix" di kotak cari.
  3. Saring menurut Kategori Musik.
- Hasil:
  - Urutan dari atas: kotak cari, deret Kategori, Produk Unggulan berisi Netflix Premium, lalu semua Produk aktif.
  - Kategori "Game" tidak tampil.
  - Tidak ada banner promo.
  - Pencarian menampilkan Netflix Premium.
  - Saringan Musik hanya menampilkan Spotify Premium.
- PRD: §3.1, §3.6

**UAT-C2 — Halaman Produk**
- Langkah: buka Netflix Premium, lalu buka Uji Bayar.
- Hasil:
  - Netflix Premium menampilkan nama, Kategori, foto, deskripsi, teks ketentuan garansi, tombol WhatsApp, dan kedua Varian beserta harga dan stoknya.
  - Uji Bayar tidak menampilkan pilihan Varian.
- PRD: §3.2, §3.3

**UAT-C3 — Stok dan Habis**
- Langkah: lihat Varian Netflix Premium, lalu lihat Spotify Premium.
- Hasil:
  - Varian 1 Bulan menampilkan "Stok 10".
  - Spotify Premium tampil "Habis" di katalog dan tidak bisa dibeli.
- PRD: §3.4

**UAT-C4 — Harga normal dan aturan harga**
- Langkah:
  1. Lihat Varian Netflix Premium 1 Bulan.
  2. Sebagai Admin, isi Harga normal Varian 3 Bulan dengan Rp 135.000, lalu simpan.
  3. Isi Harga jual sebuah Varian dengan Rp 999, lalu simpan.
  4. Isi Harga jual sebuah Varian dengan Rp 499.001, lalu simpan.
- Hasil:
  - Varian 1 Bulan menampilkan Rp 75.000 dicoret dan "Hemat 33%", di Halaman Produk maupun di daftar Varian kartu Produk Unggulan Netflix Premium di beranda layar lebar.
  - Langkah 2 ditolak karena Harga normal tidak lebih besar dari Harga jual.
  - Langkah 3 ditolak karena Harga jual kurang dari Rp 1.000.
  - Langkah 4 ditolak karena Harga jual lebih dari Rp 499.000.
- PRD: §3.2, §3.5

**UAT-C5 — Harga di kartu Produk**
- Langkah: lihat kartu Netflix Premium, YouTube Premium, Uji Bayar, dan Spotify Premium di beranda.
- Hasil:
  - Netflix Premium: "Mulai Rp 50.000".
  - YouTube Premium: "Mulai Rp 55.000", karena Varian Rp 20.000 sedang habis.
  - Uji Bayar: "Rp 1.000", tanpa kata "Mulai".
  - Spotify Premium: label "Habis" dengan harga Rp 25.000.
- PRD: §3.8

**UAT-C6 — Nonaktif dan hapus**
- Langkah:
  1. Sebagai Admin, coba hapus Kategori "Game".
  2. Nonaktifkan Netflix Premium, lalu buka katalog dan Riwayat Pesanan yang memuat Netflix Premium.
  3. Coba hapus Netflix Premium.
- Hasil:
  - Kategori "Game" tidak bisa dihapus karena masih berisi Produk.
  - Netflix Premium hilang dari katalog, tetapi Pesanan lamanya tetap tampil utuh.
  - Netflix Premium tidak bisa dihapus karena sudah pernah dipesan.
- PRD: §3.1, §3.7

**UAT-C7 — Nama Kategori unik**
- Langkah:
  1. Sebagai Admin, buat Kategori baru bernama "streaming".
  2. Ubah nama Kategori "Musik" menjadi "Streaming".
- Hasil:
  - Kedua langkah ditolak dengan pesan bahwa nama Kategori sudah dipakai.
  - Kategori "Streaming" dan "Musik" tetap seperti semula.
- PRD: §3.1

## D. Item stok (§4)

**UAT-D1 — Menempel banyak Item stok**
- Langkah: sebagai Admin, tempel lima baris berikut ke Varian Netflix Premium 1 Bulan.
  ```
  a@mail.com|pass1|Profil 1
  b@mail.com|pass2|Profil 2
  c@mail.com|pass3
  a@mail.com|pass1|Profil 1
  d@mail.com|pass4|Profil 4
  ```
- Hasil:
  - Ringkasan menampilkan "3 tersimpan, 2 ditolak".
  - Baris 3 ditolak karena jumlah kolomnya salah.
  - Baris 4 ditolak karena kembar dengan baris 1.
  - Stok Varian bertambah 3.
- PRD: §4.2

**UAT-D2 — Mengubah Format Item stok**
- Langkah:
  1. Ganti nama kolom `Profil` di Netflix Premium menjadi `Nama Profil`.
  2. Coba tambah kolom `PIN`.
- Hasil:
  - Ganti nama berhasil.
  - Tambah kolom ditolak karena masih ada Item stok Tersedia.
  - Item stok Terkirim tetap tampil dengan kolom lamanya.
- PRD: §4.1

**UAT-D3 — Mengubah dan menghapus Item stok**
- Langkah:
  1. Ubah satu Item stok Tersedia.
  2. Mulai checkout Netflix Premium 1 Bulan dengan Email B, tanpa membayar. Sebagai Admin, coba ubah Item stok yang Ditahan.
  3. Coba hapus satu Item stok Terkirim.
  4. Batalkan Pesanan Email B.
- Hasil:
  - Langkah 1 berhasil.
  - Langkah 2 dan 3 ditolak.
- PRD: §4.3, §4.4

**UAT-D4 — Nama kolom Format Item stok kembar**
- Langkah: sebagai Admin, buat Produk baru dengan Format Item stok `Email`, `Password`, `email`.
- Hasil:
  - Produk ditolak dengan pesan bahwa kolom 3 kembar dengan kolom lain.
  - Setelah kolom 3 diganti `Profil`, Produk tersimpan.
- PRD: §4.1

## E. Checkout dan pembayaran (§5)

**UAT-E1 — Penahanan dan pembatalan**
- Langkah:
  1. Catat Stok Varian Netflix Premium 1 Bulan.
  2. Checkout Varian itu dengan Email A sampai halaman bayar.
  3. Di browser lain, lihat stoknya.
  4. Tekan "Batalkan", lalu lihat stoknya lagi.
- Hasil:
  - Langkah 3: stok berkurang satu.
  - Langkah 4: Pesanan menjadi Dibatalkan, dan stok kembali seperti semula.
- PRD: §5.3, §5.8

Pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan." (§5.8 ▶ Keputusan 2026-11-12) diuji lewat test otomatis, karena pembayaran yang masuk tepat saat membatalkan sulit dibuat dengan sengaja.

**UAT-E2 — Satu Pesanan menunggu per email**
- Langkah:
  1. Checkout Uji Bayar dengan Email A sampai halaman bayar.
  2. Buka tab baru, lalu checkout Netflix Premium dengan `EMAIL-A` yang ditulis huruf besar.
  3. Di browser lain, misalnya di laptop, checkout Netflix Premium dengan Email A.
  4. Batalkan Pesanan Email A dari browser pertama.
- Hasil:
  - Langkah 2 diarahkan ke Pesanan Email A yang masih menunggu, dengan pilihan untuk membatalkannya.
  - Langkah 3 ditolak dengan pesan bahwa email ini masih punya Pesanan yang menunggu pembayaran, beserta jam kedaluwarsanya. Pesan itu tidak memuat tautan ke Pesanan dan tidak punya tombol batal.
- PRD: §5.4, §7.4

Pengarahan ke Pesanan yang menunggu saat Stok Varian 0 (§5.4 ▶ Keputusan 2026-11-12) diuji lewat test otomatis.

**UAT-E3 — Halaman bayar di ponsel**
- Langkah: di ponsel, checkout Netflix Premium 1 Bulan dengan Email A dan Voucher `HEMAT5`.
- Hasil:
  - Halaman menampilkan gambar QR dan hitung mundur.
  - Rinciannya: Harga jual Rp 50.000, potongan voucher − Rp 5.000, Kode unik antara Rp 1 dan Rp 499, dan Total bayar yang sama dengan nominal di aplikasi e-wallet.
  - Tombol "Simpan gambar QR" menyimpan gambar ke galeri, dan gambar itu bisa dibuka dari aplikasi e-wallet.
  - Batalkan Pesanan setelah selesai melihat.
- Catatan (▶ Keputusan 2026-11-12, #87): di iPhone (Safari), gambar yang diunduh masuk ke aplikasi Files, bukan galeri Foto. Catat apakah ini mengganggu; bila ya, perilakunya dijadikan tiket baru.
- PRD: §5.2, §5.5, §5.6

**UAT-E4 — Kedaluwarsa (tunggu)**
- Langkah: checkout Uji Bayar dengan Email B, lalu biarkan 15 menit tanpa membayar.
- Hasil:
  - Pesanan menjadi Kedaluwarsa.
  - Stok Uji Bayar kembali.
  - Checkout baru dengan Email B diterima.
- PRD: §5.7, §5.8

**UAT-E5 — Harga terkunci**
- Langkah:
  1. Checkout Netflix Premium 3 Bulan dengan Email A sampai halaman bayar.
  2. Sebagai Admin, ubah Harga jualnya menjadi Rp 140.000.
  3. Muat ulang halaman bayar.
- Hasil:
  - Pesanan tetap Rp 135.000.
  - Batalkan Pesanan, lalu kembalikan harganya.
- PRD: §5.1

**UAT-E6 — Menyelesaikan Pesanan Bermasalah**
- Langkah:
  1. Sebagai Admin, buka Pesanan Bermasalah pertama dari seed, koreksi emailnya menjadi Email A, lalu tekan "Kirim Item stok" dan tegaskan.
  2. Buka Pesanan Bermasalah kedua, tekan "Tandai Dana Dikembalikan", lalu tegaskan.
- Hasil:
  - Koreksi email Pesanan pertama tersimpan tanpa mengirim email.
  - Pesanan pertama menjadi Selesai, mendapat satu Item stok dari Varian yang sama, dan email "Pesanan selesai" terkirim ke Email A.
  - Kedua aksi meminta penegasan sebelum dijalankan, dan tidak ada yang berubah bila Anda memilih Batal.
  - Pesanan kedua menjadi Dana Dikembalikan.
  - Kartu "Bermasalah" di dasbor admin berkurang dua.
- PRD: §5.7, §5.9, §6.4

**UAT-E7 — Syarat & Ketentuan di checkout**
- Langkah: buka form checkout.
- Hasil:
  - Form hanya berisi email dan kode voucher.
  - Ada kalimat "Dengan membayar, Anda menyetujui Syarat & Ketentuan" dengan tautan, tanpa kotak centang.
- PRD: §5.2

## F. Pengiriman Item stok (§6)

**UAT-F1 — Item stok di halaman, email, dan Tautan Pesanan (bayar)**
- Langkah:
  1. Selesaikan pembelian Uji Bayar dengan Email A.
  2. Tekan "Salin" pada Item stok.
  3. Buka email "Pesanan selesai", lalu buka Tautan Pesanan di browser lain yang belum login.
- Hasil:
  - Item stok yang disalin sama dengan yang tampil.
  - Email berisi Item stok, rincian nominal, dan Tautan Pesanan.
  - Tautan Pesanan membuka halaman Pesanan tanpa login.
- PRD: §6.1, §6.2, §6.3

Tanda "Email gagal" (§6.4) diuji lewat test otomatis, karena kegagalan kirim email sulit dibuat dengan sengaja.

**UAT-F2 — Kirim ulang dan koreksi email**
- Langkah:
  1. Sebagai Admin, buka Pesanan dari UAT-F1, lalu tekan kirim ulang email.
  2. Koreksi emailnya menjadi Email B, lalu kirim ulang.
- Hasil:
  - Email A menerima salinan kedua.
  - Email B menerima email Pesanan itu.
  - Tidak ada tombol kirim ulang di halaman Pesanan milik Pembeli.
- PRD: §6.4

## G. Member (§7)

**UAT-G1 — Membuat akun setelah membayar (bayar)**
- Langkah:
  1. Sebagai Tamu, beli Uji Bayar dengan Email B. Email B belum pernah menjadi Member.
  2. Di halaman Pesanan, isi password lewat ajakan "Buat akun untuk menyimpan riwayat".
  3. Masukkan Kode verifikasi dari email.
- Hasil:
  - Item stok sudah tampil sebelum akun dibuat.
  - Setelah Kode verifikasi benar, Member masuk.
  - Riwayat Pesanan memuat semua Pesanan Email B dari skenario sebelumnya, termasuk yang Kedaluwarsa dan Dibatalkan, dengan yang terbaru di atas.
- PRD: §7.1, §7.3, §7.4

**UAT-G2 — Email yang sudah Member (bayar)**
- Langkah: tanpa login, beli Uji Bayar dengan email `member@miwe.example`.
- Hasil:
  - Halaman Pesanan menampilkan "Login untuk melihat riwayat", bukan form buat akun.
  - Setelah login, Pesanan itu ada di Riwayat Pesanan.
- PRD: §7.1, §7.4

**UAT-G3 — Daftar tanpa membeli**
- Langkah: buka tab Akun, pilih Daftar, isi email baru dan password 8 karakter, lalu masukkan Kode verifikasi.
- Hasil:
  - Akun aktif.
  - Password 7 karakter ditolak.
  - Sebelum Kode verifikasi dimasukkan, akun belum bisa dipakai login.
- PRD: §7.2, §7.3, §7.5

**UAT-G4 — Aturan Kode verifikasi (tunggu)**
- Langkah:
  1. Daftar dengan email baru, lalu langsung tekan "Kirim ulang kode".
  2. Tunggu 60 detik, lalu tekan lagi.
  3. Masukkan kode yang salah 5 kali, lalu masukkan kode yang benar.
  4. Minta kode baru, tunggu 11 menit, lalu masukkan kode itu.
- Hasil:
  - Langkah 1 ditolak dengan pesan untuk menunggu.
  - Langkah 2 mengirim kode baru.
  - Langkah 3: setelah 5 kali salah, kode yang benar pun ditolak.
  - Langkah 4: kode ditolak karena kedaluwarsa.
- PRD: §7.3, §7.7

**UAT-G5 — Lupa password (tunggu)**
- Langkah:
  1. Minta atur ulang password untuk `member@miwe.example`, lalu pakai tautannya.
  2. Buka tautan yang sama sekali lagi.
  3. Minta tautan baru, tunggu 31 menit, lalu buka.
- Hasil:
  - Langkah 1 berhasil.
  - Langkah 2 ditolak karena tautan sudah dipakai.
  - Langkah 3 ditolak karena tautan kedaluwarsa.
- PRD: §7.5

**UAT-G6 — Salah password berturut-turut (tunggu)**
- Langkah:
  1. Login sebagai `member@miwe.example` dengan password salah 5 kali.
  2. Langsung coba dengan password benar.
  3. Tunggu 15 menit, lalu coba lagi.
  4. Ulangi langkah 1–2 di login Admin.
- Hasil:
  - Langkah 2 ditolak.
  - Langkah 3 berhasil.
  - Login Admin berperilaku sama.
- PRD: §7.7

**UAT-G7 — Dasbor Member**
- Langkah:
  1. Login sebagai Member dengan email yang diketik `Member@MIWE.example`.
  2. Buka profil.
- Hasil:
  - Login berhasil.
  - Riwayat Pesanan bisa dibuka dan Item stoknya bisa disalin.
  - Password bisa diganti.
  - Tidak ada isian untuk mengganti email, dan tidak ada tombol hapus akun.
- PRD: §7.4, §7.6

## H. Voucher (§8)

Pada skenario voucher, cukup lihat rincian di halaman bayar, lalu batalkan Pesanannya. Aturan pembayaran telat untuk Voucher (§8.6) diuji lewat test otomatis, karena butuh kabar pembayaran yang datang setelah QRIS kedaluwarsa.

**UAT-H1 — Menghitung potongan voucher**
- Langkah:
  1. Checkout Netflix Premium 1 Bulan dengan `HEMAT5`.
  2. Checkout Netflix Premium 3 Bulan dengan `hemat10`, ditulis huruf kecil.
- Hasil:
  - Langkah 1: potongan voucher Rp 5.000.
  - Langkah 2: potongan voucher Rp 10.000, karena 10% dari Rp 135.000 adalah Rp 13.500 dan dibatasi maksimal Rp 10.000.
- PRD: §8.1, §8.2, §8.3

**UAT-H2 — Batas bawah Rp 1.000**
- Langkah:
  1. Sebagai Admin, ubah sementara Harga jual Netflix Premium 1 Bulan menjadi Rp 3.000. Checkout Varian itu dengan Email A dan `HEMAT5`.
  2. Batalkan Pesanan, lalu kembalikan Harga jualnya ke Rp 50.000.
  3. Checkout Uji Bayar dengan `HEMAT5`.
- Hasil:
  - Langkah 1: potongan voucher dipangkas menjadi Rp 2.000, sehingga Total bayar Rp 1.000 ditambah Kode unik.
  - Langkah 3: Voucher ditolak dengan pesan "Voucher tidak memberi potongan untuk produk ini" `[CONTOH]` (OD-3).
- PRD: §8.3

**UAT-H3 — Syarat dan pesan penolakan**
- Langkah: coba setiap kode berikut di checkout.
- Hasil:

  | Kode dan keadaan | Pesan |
  |---|---|
  | `ASAL` | "Kode voucher tidak ditemukan" |
  | `MATI` | "Kode voucher tidak ditemukan" |
  | `LAMA` | "Voucher sudah berakhir" |
  | `HEMAT10` untuk Uji Bayar (Rp 1.000) | "Minimal pembelian Rp 50.000" |
  | `MEMBER20` sebagai Tamu | "Voucher khusus Member, silakan login" |
  | `MEMBER20` setelah login Member | Diterima, potongan voucher Rp 10.000 untuk Netflix Premium 1 Bulan |

  Lalu, sebagai Admin, batasi `HEMAT5` hanya untuk Kategori Musik. Checkout Netflix Premium dengan `HEMAT5`. Pesannya: "Voucher tidak berlaku untuk produk ini". Setelah itu kembalikan cakupan `HEMAT5` ke semua Produk.
- PRD: §8.4, §8.7

**UAT-H4 — Kuota dan Batas per email**
- Langkah:
  1. Checkout Netflix Premium 1 Bulan dengan Email A dan `SATUKALI`, lalu biarkan di halaman bayar.
  2. Di browser lain, checkout Varian yang sama dengan Email B dan `SATUKALI`.
  3. Batalkan Pesanan Email A, lalu ulangi langkah 2.
  4. Sebagai Admin, lihat pemakaian `SATUKALI`, lalu batalkan Pesanan Email B.
  5. Checkout Netflix Premium 1 Bulan dengan email `MEMBER@miwe.example` dan `HEMAT5`.
- Hasil:
  - Langkah 2: "Kuota voucher habis".
  - Langkah 3: diterima.
  - Langkah 4: pemakaian `SATUKALI` tercatat 1 sebelum Pesanan Email B dibatalkan, lalu 0 sesudahnya.
  - Langkah 5: ditolak dengan "Anda sudah memakai voucher ini", karena email itu sudah punya Pesanan Selesai yang memakai `HEMAT5`.
- PRD: §8.5, §8.8

**UAT-H5 — Kelola voucher**
- Langkah:
  1. Sebagai Admin, buat Voucher baru `COBA` dengan masa berlaku berakhir 2 menit lagi.
  2. Pakai di checkout, lalu batalkan.
  3. Tunggu sampai lewat menit berakhirnya, lalu coba lagi.
  4. Coba hapus `COBA` dan `HEMAT5`.
  5. Buat Voucher `HAPUS` tanpa memakainya, lalu hapus.
  6. Nonaktifkan `HEMAT5`, lalu aktifkan kembali.
- Hasil:
  - Langkah 2 diterima.
  - Langkah 3 ditolak dengan "Voucher sudah berakhir".
  - Langkah 4 ditolak. `COBA` pernah tercatat di Pesanan walaupun Pesanannya Dibatalkan, dan `HEMAT5` pernah dipakai.
  - Langkah 5 berhasil.
  - `HEMAT5` bisa dinonaktifkan dan diaktifkan kembali.
- PRD: §8.4, §8.8

## I. Dasbor admin (§9)

**UAT-I1 — Ringkasan dan Pendapatan**
- Langkah: setelah skenario bertanda (bayar) selesai, buka dasbor admin. Jumlahkan sendiri Total bayar semua Pesanan Selesai hari ini di daftar Pesanan.
- Hasil:
  - Pendapatan hari ini sama dengan hasil penjumlahan Anda, termasuk Kode unik.
  - Pesanan Bermasalah dan Dana Dikembalikan tidak ikut dihitung.
  - Jumlah Member aktif sesuai daftar Member.
  - Tidak ada grafik.
- PRD: §9.1, §9.2, §9.3

**UAT-I2 — Stok menipis**
- Langkah:
  1. Pastikan tidak ada Pesanan Menunggu Pembayaran, lalu lihat daftar "Stok menipis".
  2. Ubah Ambang stok menipis menjadi 3 di pengaturan toko.
- Hasil:
  - Langkah 1: daftar memuat Netflix Premium 3 Bulan (stok 4), YouTube Premium 1 Bulan (stok 0), YouTube Premium 3 Bulan (stok 3), dan Spotify Premium (stok 0). Netflix Premium 1 Bulan tidak masuk karena stoknya di atas 5. Uji Bayar masuk hanya bila stoknya 5 atau kurang.
  - Langkah 2: Netflix Premium 3 Bulan keluar dari daftar, sedangkan YouTube Premium 3 Bulan tetap ada.
  - Kembalikan ambangnya ke 5.
- PRD: §9.4, §9.8

**UAT-I3 — Daftar dan detail Pesanan**
- Langkah:
  1. Saring daftar Pesanan dengan status Selesai dan tanggal hari ini.
  2. Cari dengan Email A, lalu dengan sebagian Email A dalam huruf besar, misalnya bagian sebelum tanda @, lalu dengan sebuah Nomor Pesanan.
  3. Buka satu detail Pesanan.
- Hasil:
  - Kolom daftar sesuai §9.5.
  - Nomor Pesanan berbentuk `MIWE-` diikuti 6 karakter, tanpa O, 0, I, dan 1.
  - Pencarian dengan sebagian Email A menemukan Pesanan Email A.
  - Detail menampilkan rincian nominal, Item stok, dan riwayat perubahan status.
- PRD: §9.5, §9.6

**UAT-I4 — Daftar Item stok**
- Langkah:
  1. Mulai checkout Netflix Premium 1 Bulan dengan Email A tanpa membayar.
  2. Sebagai Admin, buka halaman Varian itu dan saring per status. Setelah itu batalkan Pesanan Email A.
- Hasil:
  - Ada Item stok Tersedia.
  - Ada satu Item stok Ditahan dengan Nomor Pesanannya.
  - Item stok Terkirim tampil dengan Nomor Pesanan penerimanya.
- PRD: §9.7

**UAT-I5 — Pengaturan toko**
- Langkah:
  1. Ubah nomor WhatsApp menjadi `0812-3456-7890`, lalu ubah teks Syarat & Ketentuan.
  2. Buka halaman Produk dan footer toko.
  3. Coba simpan nomor WhatsApp `+1 555 0100`.
- Hasil:
  - Pengaturan toko menampilkan nomor tersimpan `6281234567890`.
  - Tombol WhatsApp membuka `https://wa.me/6281234567890`.
  - Langkah 3 ditolak dengan pesan bahwa nomor harus nomor Indonesia.
  - Halaman Syarat & Ketentuan menampilkan teks baru.
  - Kebijakan Privasi tertaut di footer.
  - Tidak ada menu log aktivitas, ekspor CSV, atau notifikasi email Admin.
- PRD: §9.8, §9.9

## J. Email (§10)

**UAT-J1 — Tiga jenis email**
- Langkah: periksa email yang masuk selama skenario F, G1, G3, dan G5.
- Hasil:
  - Hanya ada email Pesanan selesai, Kode verifikasi, dan Atur ulang password.
  - Pengirimnya "MIWE Digital Store".
  - Semua berbahasa Indonesia.
  - Setiap email punya footer WhatsApp dengan nomor dari pengaturan toko.
  - Tidak ada email pengingat pembayaran.
- PRD: §10.1, §10.2

## K. Tampilan (§11)

**UAT-K1 — Navigasi ponsel dan desktop**
- Langkah:
  1. Di ponsel, sebagai Tamu, buka keempat tab navigasi bawah.
  2. Login sebagai Member, lalu buka tab Riwayat dan Akun.
  3. Buka toko di laptop.
  4. Buka dasbor admin di ponsel.
- Hasil:
  - Tab Riwayat untuk Tamu menampilkan ajakan login dan penjelasan tentang Tautan Pesanan.
  - Untuk Member, tab Riwayat menampilkan Riwayat Pesanan, dan tab Akun menampilkan dasbor Member.
  - Di laptop tampil navbar atas tanpa navigasi bawah.
  - Dasbor admin di ponsel memakai menu lipat.
  - Tidak ada gulir ke samping di layar selebar 360 piksel.
- PRD: §11.1

**UAT-K2 — Animasi navbar (M3)**
- Langkah:
  1. Di ponsel, gulir beranda ke bawah lalu ke atas, dan pindah antar-tab.
  2. Nyalakan "kurangi gerakan" di pengaturan ponsel, lalu ulangi.
- Hasil:
  - Navbar atas mengecil dan berbayang.
  - Navigasi bawah bersembunyi saat menggulir ke bawah dan muncul saat menggulir ke atas.
  - Penanda tab bergeser halus.
  - Dengan "kurangi gerakan", semua animasi berhenti.
- PRD: §11.2

**UAT-K3 — Mode gelap (M3)**
- Langkah:
  1. Ubah ponsel ke mode gelap, lalu buka toko.
  2. Di tab Akun, ganti ke mode terang, tutup browser, lalu buka lagi.
- Hasil:
  - Langkah 1: toko tampil gelap.
  - Langkah 2: toko tetap terang setelah dibuka lagi.
- PRD: §11.3

**UAT-K4 — Pasang seperti aplikasi (M3)**
- Langkah: di ponsel, pilih "Tambahkan ke layar utama", lalu buka dari ikonnya.
- Hasil:
  - Toko terbuka dengan ikon dan layar pembuka sendiri, tanpa bilah alamat.
  - Dalam mode pesawat, toko tidak bisa dipakai.
- PRD: §11.4

**UAT-K5 — Sesuai sistem desain**
- Langkah: bandingkan beberapa halaman dengan `docs/DESIGN.md`.
- Hasil: warna, huruf, dan komponen sesuai `docs/DESIGN.md`.
- PRD: §11.5

## L. Server dan data (§12)

**UAT-L1 — HTTPS dan cadangan**
- Langkah:
  1. Buka toko lewat `http://`.
  2. Setelah aplikasi berjalan 8 hari di VPS, minta pengelola server menunjukkan folder cadangan.
- Hasil:
  - Langkah 1 dialihkan ke `https://`.
  - Folder cadangan berisi tepat 7 cadangan harian terakhir.
- PRD: §12

## M. Milestone (§13)

Jalankan skenario sesuai milestone yang sedang diuji:

| Milestone | Skenario |
|---|---|
| M1 | A1, B1, B2, C1–C6, D1–D3, E1, E2, E4–E7, F1, F2, I3, I4, I5, K1, K5, L1. Lewati bagian yang memakai Voucher atau Member: langkah Voucher di E3, pengecekan Riwayat Pesanan di C6, langkah 2 di B1, langkah 2 di K1, dan isian Ambang stok menipis. Di E6, ganti pengecekan kartu "Bermasalah" dengan jumlah Pesanan Bermasalah di daftar Pesanan dasbor admin. Di K1, tab Riwayat untuk Tamu cukup menjelaskan Tautan Pesanan tanpa ajakan login, dan tab Akun berisi tombol WhatsApp serta tautan Syarat & Ketentuan dan Kebijakan Privasi (PRD §11.1) |
| M2 | B3, E3, G1–G7, H1–H5, I1, I2, J1 |
| M3 | K2, K3, K4 |

PRD: §13
