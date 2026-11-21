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

▶ Keputusan 2026-11-15 (#121): UAT M1 di server produksi dijalankan **tanpa data seed**.
- Alasannya, Produk sungguhan sudah diisi di produksi. Bila database dikosongkan sesudah seed, Produk itu ikut terhapus.
- Admin dibuat dengan `pnpm admin:buat` mengikuti `docs/DEPLOY.md`, bukan Admin seed.
- Pemilik menyiapkan data uji sendiri lewat dasbor admin, termasuk Produk "Uji Bayar" dengan satu Varian Rp 1.000 dan beberapa Item stok. Nama dan harga Produk seed di skenario bisa diganti dengan Produk milik pemilik yang punya sifat sama, misalnya Produk dengan dua Varian, atau Varian tanpa Item stok.
- UAT-E6 membutuhkan Pesanan Bermasalah dari seed. Skenario ini dijalankan saat ada Pesanan Bermasalah sungguhan, atau ditunda.

▶ Keputusan 2026-11-17 (#128): UAT M2 di server produksi juga dijalankan **tanpa data seed**, sama seperti M1.
- **Voucher uji.** Buat sendiri lewat dasbor admin enam Voucher yang syaratnya sama dengan Voucher seed di atas: `HEMAT5`, `HEMAT10`, `MEMBER20`, `SATUKALI`, `LAMA`, dan `MATI`. Untuk `LAMA`, isi waktu berakhir dengan waktu yang sudah lewat.
- **Member uji.** Daftarkan lewat halaman Daftar sebuah email yang bisa Anda buka sendiri, selain Email A dan Email B, lalu pakai email itu di setiap skenario yang menyebut `member@miwe.example`. Skenario G3 dan G4 butuh email baru lagi. Bila Anda memakai Gmail, alamat seperti `nama+uji3@gmail.com` masuk ke kotak surat yang sama tetapi dihitung sebagai email lain oleh toko.
- **Pesanan Selesai dengan `HEMAT5`** untuk UAT-H4 langkah 5 dibuat dengan pembelian sungguhan (bayar). Ubah sementara Harga jual Uji Bayar menjadi Rp 2.000, beli dengan email Member uji dan `HEMAT5`, lalu kembalikan Harga jualnya ke Rp 1.000. Potongannya dipangkas menjadi Rp 1.000, jadi Anda membayar Rp 1.000 ditambah Kode unik (PRD §8.3).
- **Seed lokal.** `pnpm db:seed` tetap dilengkapi Member dan Voucher sesuai daftar di atas, untuk dicoba di komputer lokal.

▶ Keputusan 2026-11-17 (#174): Nilai Voucher seed yang tidak disebut di daftar di atas, juga untuk Voucher uji di produksi:
- Batas per email semua Voucher seed adalah 1, nilai bawaan PRD §8.4.
- `LAMA` dan `MATI` memberi potongan nominal Rp 5.000.
- Waktu berakhir `LAMA` adalah waktu seed dijalankan dikurangi 24 jam, dibulatkan ke bawah ke menit.
- Database lokal yang diisi seed sebelum M2 masih menyimpan Pesanan Selesai tanpa voucher. Kosongkan database lokal, lalu jalankan `pnpm db:seed` lagi sebelum UAT M2.

▶ Keputusan 2026-11-20 (#204): Persiapan M4
- **Seed lokal.** `pnpm db:seed` juga mengisi data berikut, semuanya bertanda `[CONTOH]`:
  - Harga modal: Netflix Premium 1 Bulan Rp 35.000, Netflix Premium 3 Bulan Rp 100.000, YouTube Premium 1 Bulan Rp 14.000, YouTube Premium 3 Bulan Rp 40.000, dan Spotify Premium 1 Bulan Rp 18.000. Pesanan seed Netflix Premium 1 Bulan ikut tercatat dengan Harga modal Rp 35.000.
  - Uji Bayar sengaja belum punya Harga modal, supaya UAT-N3 bisa menguji pengisian Harga modal pertama.
  - Satu Biaya operasional "Sewa server" Rp 150.000, bertanggal 1 pada bulan seed dijalankan.
  - Biaya transaksi memakai nilai awal PRD §14.3, yaitu 0,7% untuk Total bayar Rp 100.000 ke atas.
- **Produksi.** UAT M4 di server produksi juga dijalankan tanpa data seed. Saat fitur ini tayang, Varian sungguhan belum punya Harga modal. Biarkan Harga modal Uji Bayar kosong sampai UAT-N3. Varian lain boleh diisi kapan saja, kecuali yang dipakai di UAT-N1, yang diisi saat menjalankan skenario itu.

▶ Keputusan 2026-11-20 (#226): Persiapan M5
- **Seed lokal.** `pnpm db:seed` juga mengisi data berikut, semuanya bertanda `[CONTOH]`:
  - Saldo `member@miwe.example` Rp 100.000, dengan satu baris Riwayat saldo "Ditambah Admin" berketerangan "Saldo awal seed";
  - Saldo `nonaktif@miwe.example` Rp 20.000;
  - satu Top up Berhasil milik `member@miwe.example`: Nominal top up Rp 100.000, Kode unik Rp 77, dan Total bayar Rp 100.077;
  - satu Top up Bermasalah milik `member@miwe.example`: Nominal top up Rp 50.000, Total bayar Rp 50.123, dan nominal diterima Rp 50.000.
- **Produksi.** UAT M5 di server produksi juga dijalankan tanpa data seed. Member uji memulai dengan Saldo Rp 0. Top up sungguhan memakai nominal minimal Rp 10.000 ditambah Kode unik, dan saldonya dipakai untuk membeli Uji Bayar. Setelah UAT, Admin mengurangi sisa saldo Member uji dengan keterangan "Selesai UAT", atau membiarkannya sebagai saldo pemilik sendiri.
- **Top up Bermasalah.** Top up kurang bayar tidak bisa dibuat dengan QRIS sungguhan, jadi UAT-O5 dijalankan di seed lokal.

▶ Keputusan 2026-11-21 (#240): Seed lokal diselaraskan dengan §15.2. Top up Berhasil seed juga punya satu baris Riwayat saldo jenis Top up +Rp 100.000 dengan Nomor Top up-nya, di atas baris "Saldo awal seed". Karena itu Saldo `member@miwe.example` di seed lokal menjadi Rp 200.000. Data seed lainnya tidak berubah.

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
  1. Di ponsel, login sebagai `member@miwe.example`.
  2. Di laptop, sebagai Admin, buka daftar Member dan cari dengan "MEMBER". Lalu nonaktifkan `member@miwe.example`.
  3. Muat ulang toko di ponsel.
  4. Coba login lagi sebagai Member itu dengan password yang benar.
  5. Sebagai Tamu, coba checkout dengan email itu.
  6. Aktifkan kembali Member itu, lalu login lagi.
- Hasil:
  - Daftar Member menampilkan email, tanggal daftar, jumlah Pesanan Selesai, total belanja, dan status Aktif atau Nonaktif.
  - Pencarian "MEMBER" menemukan `member@miwe.example`.
  - Langkah 3: Member di ponsel sudah keluar.
  - Langkah 4 ditolak dengan "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp." beserta tombol WhatsApp.
  - Langkah 5 ditolak dengan "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp."
  - Setelah diaktifkan kembali, login berhasil.
  - Admin tidak pernah melihat password Member.
- PRD: §2.3, §5.2, §7.5

▶ Keputusan 2026-11-17 (#174): Di langkah 5, pesan penolakan checkout tampil beserta tombol WhatsApp, sama seperti di langkah 4 (PRD §5.2).

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

Pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan." (§5.8 ▶ Keputusan 2026-11-12) diuji lewat test otomatis, karena pembayaran yang masuk tepat saat membatalkan sulit dibuat dengan sengaja. Test itu juga mencakup Pesanan yang sudah Selesai saat "Batalkan" diproses, dan Pesanan yang berakhir Bermasalah tanpa pesan itu (§5.8 ▶ Keputusan 2026-11-12, #99).

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
  - Rinciannya: Harga jual Rp 50.000, "Potongan voucher (HEMAT5)" − Rp 5.000, Kode unik antara Rp 1 dan Rp 499, dan Total bayar yang sama dengan nominal di aplikasi e-wallet.
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
  - Koreksi email Pesanan pertama tersimpan tanpa mengirim email, dan panel "Koreksi email" menyatakan bahwa belum ada email yang dikirim.
  - Pesanan pertama menjadi Selesai, mendapat satu Item stok dari Varian yang sama, dan email "Pesanan selesai" terkirim ke Email A.
  - Kedua aksi meminta penegasan sebelum dijalankan. Kalimat penegasannya menyebut akibat aksi dan bahwa aksi itu tidak bisa dibatalkan. Penegasan "Kirim Item stok" menyebut Email A sebagai tujuan email. Tidak ada yang berubah bila Anda memilih Batal.
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
  - Setelah Kode verifikasi benar, Anda langsung masuk sebagai Member dan dibawa ke Riwayat Pesanan, tanpa login lagi.
  - Riwayat Pesanan memuat semua Pesanan Email B dari skenario sebelumnya, termasuk yang Kedaluwarsa dan Dibatalkan, dengan yang terbaru di atas.
- PRD: §7.1, §7.3, §7.4

**UAT-G2 — Email yang sudah Member (bayar)**
- Langkah:
  1. Tanpa login, beli Uji Bayar dengan email `member@miwe.example`.
  2. Login sebagai Member itu, lalu buka Halaman Pesanan tadi lagi.
  3. Keluar, login sebagai Member Email B dari UAT-G1, lalu buka Halaman Pesanan yang sama.
- Hasil:
  - Langkah 1: Halaman Pesanan menampilkan "Login untuk melihat riwayat", bukan form buat akun.
  - Setelah login, Pesanan itu ada di Riwayat Pesanan.
  - Langkah 2: Halaman Pesanan menampilkan tautan "Lihat Riwayat Pesanan".
  - Langkah 3: Item stok tetap tampil, tanpa ajakan apa pun.
- PRD: §7.1, §7.4

**UAT-G3 — Daftar tanpa membeli**
- Langkah:
  1. Buka tab Akun, pilih Daftar, lalu isi email baru dengan password 7 karakter.
  2. Isi password 8 karakter. Jangan masukkan kodenya dulu: tutup tab, lalu coba login dengan email dan password itu.
  3. Tunggu 60 detik, daftar lagi dengan email yang sama dan password lain, lalu masukkan kode dari email pertama.
  4. Masukkan kode dari email kedua.
  5. Keluar, lalu daftar dengan email `member@miwe.example`.
- Hasil:
  - Langkah 1 ditolak karena password kurang dari 8 karakter.
  - Langkah 2: login ditolak dengan "Email atau password salah. Periksa keduanya, lalu coba masuk lagi."
  - Langkah 3: kode pertama ditolak.
  - Langkah 4: akun aktif, Anda langsung masuk, dan password yang berlaku adalah password kedua.
  - Langkah 5 ditolak dengan "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya."
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

▶ Keputusan 2026-11-17 (#174): Setelah langkah 3, tekan "Kirim ulang kode". Pesan kode hangus langsung hilang, dan yang tampil hanya "Kode verifikasi baru sudah kami kirim ke <email>." (PRD §7.3).

**UAT-G5 — Lupa password (tunggu)**
- Langkah:
  1. Di laptop, login sebagai `member@miwe.example`.
  2. Di ponsel, minta atur ulang password untuk `member@miwe.example`, lalu langsung minta lagi.
  3. Pakai tautan dari email untuk membuat password baru.
  4. Muat ulang toko di laptop.
  5. Buka tautan yang sama sekali lagi.
  6. Minta atur ulang password untuk email yang tidak pernah mendaftar.
  7. Minta tautan baru untuk `member@miwe.example`, tunggu 31 menit, lalu buka.
- Hasil:
  - Langkah 2 dan 6 menampilkan pesan yang sama: "Bila email ini terdaftar sebagai Member, tautan atur ulang password sudah kami kirim. Periksa juga folder spam."
  - Langkah 2 hanya mengirim satu email, dan langkah 6 tidak mengirim email.
  - Langkah 3 berhasil. Halaman Masuk lalu menampilkan "Password sudah diganti. Masuk dengan password baru."
  - Langkah 4: laptop sudah keluar.
  - Langkah 5 ditolak karena tautan sudah dipakai.
  - Langkah 7 ditolak karena tautan kedaluwarsa.
- PRD: §7.5

▶ Keputusan 2026-11-17 (#174): Langkah tambahan setelah langkah 7.
- Langkah:
  8. Minta tautan baru untuk `member@miwe.example`. Sebelum membukanya, nonaktifkan Member itu sebagai Admin, lalu buka tautannya.
  9. Aktifkan kembali Member itu, lalu login dengan password dari langkah 3.
- Hasil:
  - Langkah 8 menampilkan "Akun Member ini dinonaktifkan, jadi password tidak bisa diganti. Hubungi kami di WhatsApp." beserta tombol WhatsApp, tanpa form password.
  - Langkah 9 berhasil, karena password tidak berubah di langkah 8.
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
  1. Login sebagai Member di ponsel. Di laptop, login sebagai Member yang sama dengan email yang diketik `Member@MIWE.example`.
  2. Di laptop, buka tab Riwayat, lalu buka satu Pesanan Selesai.
  3. Buka tab Akun. Ganti password dengan password lama yang salah, lalu dengan password lama yang benar.
  4. Muat ulang toko di ponsel.
- Hasil:
  - Login berhasil, dan bilah atas menampilkan "member", yaitu bagian email sebelum "@".
  - Langkah 2 membuka Halaman Pesanan itu, dan Item stoknya bisa disalin.
  - Password lama yang salah ditolak dengan "Password lama salah, jadi password tidak diganti."
  - Dengan password lama yang benar, password diganti dan laptop tetap masuk.
  - Langkah 4: ponsel sudah keluar.
  - Tab Akun tidak punya isian untuk mengganti email, tidak punya tombol hapus akun, dan tidak menampilkan Riwayat Pesanan.
- PRD: §7.4, §7.6, §11.1

▶ Keputusan 2026-11-17 (#174) (tunggu): Langkah tambahan setelah langkah 4.
- Langkah:
  5. Di laptop, ganti password dengan password lama yang salah 5 kali berturut-turut, lalu sekali lagi dengan password lama yang benar.
  6. Keluar, lalu login lagi dengan password yang sekarang.
  7. Tunggu sampai jam di pesan kunci, lalu ganti password dengan password lama yang benar.
- Hasil:
  - Langkah 5: percobaan keenam ditolak dengan "Password lama salah 5 kali berturut-turut, jadi ganti password dikunci 15 menit. Coba lagi mulai pukul HH.MM WIB.", walaupun password lamanya benar.
  - Langkah 6 berhasil. Kunci ganti password tidak memengaruhi login.
  - Langkah 7 berhasil.
- PRD: §7.6

## H. Voucher (§8)

Pada skenario voucher, cukup lihat rincian di halaman bayar, lalu batalkan Pesanannya. Aturan pembayaran telat untuk Voucher (§8.6) diuji lewat test otomatis, karena butuh kabar pembayaran yang datang setelah QRIS kedaluwarsa.

**UAT-H1 — Menghitung potongan voucher**
- Langkah:
  1. Checkout Netflix Premium 1 Bulan dengan `HEMAT5`.
  2. Checkout Netflix Premium 3 Bulan dengan `hemat10`, ditulis huruf kecil.
- Hasil:
  - Langkah 1: tombol "Pakai" menampilkan "HEMAT5 dipakai: potongan Rp 5.000", dan Halaman bayar menampilkan "Potongan voucher (HEMAT5)" − Rp 5.000.
  - Langkah 2: potongan voucher Rp 10.000, karena 10% dari Rp 135.000 adalah Rp 13.500 dan dibatasi maksimal Rp 10.000.
- PRD: §8.1, §8.2, §8.3

**UAT-H2 — Batas bawah Rp 1.000**
- Langkah:
  1. Sebagai Admin, ubah sementara Harga jual Netflix Premium 1 Bulan menjadi Rp 3.000. Checkout Varian itu dengan Email A dan `HEMAT5`.
  2. Batalkan Pesanan, lalu kembalikan Harga jualnya ke Rp 50.000.
  3. Checkout Uji Bayar dengan `HEMAT5`.
- Hasil:
  - Langkah 1: potongan voucher dipangkas menjadi Rp 2.000, sehingga Total bayar Rp 1.000 ditambah Kode unik.
  - Langkah 3: Voucher ditolak dengan pesan "Voucher tidak memberi potongan untuk produk ini", dan Pesanan tidak dibuat.
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
  | `MEMBER20` sebagai Tamu | "Voucher khusus Member, silakan login", dengan tautan Masuk. Setelah login, Anda kembali ke Checkout yang sama |
  | `MEMBER20` setelah login Member | Diterima, potongan voucher Rp 10.000 untuk Netflix Premium 1 Bulan |

  Lalu, sebagai Admin, batasi `HEMAT5` hanya untuk Kategori Musik. Checkout Netflix Premium dengan `HEMAT5`. Pesannya: "Voucher tidak berlaku untuk produk ini". Setelah itu kembalikan cakupan `HEMAT5` ke semua Produk.
- PRD: §8.4, §8.7

▶ Keputusan 2026-11-17 (#174): Pada baris `MEMBER20` sebagai Tamu, setelah login lewat tautan Masuk, isian kode voucher di Checkout sudah berisi `MEMBER20` tanpa diketik ulang (PRD §8.7).

**UAT-H4 — Kuota dan Batas per email**
- Langkah:
  1. Checkout Netflix Premium 1 Bulan dengan Email A dan `SATUKALI`, lalu biarkan di halaman bayar.
  2. Di browser lain, checkout Varian yang sama dengan Email B dan `SATUKALI`.
  3. Batalkan Pesanan Email A, lalu ulangi langkah 2.
  4. Sebagai Admin, lihat pemakaian `SATUKALI`, lalu batalkan Pesanan Email B.
  5. Checkout Netflix Premium 1 Bulan dengan email `MEMBER@miwe.example` dan `HEMAT5`.
  6. Di browser pertama, isi Email A dan `SATUKALI`, lalu tekan "Pakai". Di browser kedua, checkout dengan Email B dan `SATUKALI` sampai halaman bayar. Kembali ke browser pertama, lalu tekan "Bayar dengan QRIS". Setelah itu batalkan Pesanan Email B.
- Hasil:
  - Langkah 2: "Kuota voucher habis".
  - Langkah 3: diterima.
  - Langkah 4: pemakaian `SATUKALI` tercatat "1 dari 1" sebelum Pesanan Email B dibatalkan, lalu "0 dari 1" sesudahnya.
  - Langkah 5: ditolak dengan "Anda sudah memakai voucher ini", karena email itu sudah punya Pesanan Selesai yang memakai `HEMAT5`.
  - Langkah 6: "Pakai" menerima `SATUKALI`, tetapi "Bayar dengan QRIS" ditolak dengan "Kuota voucher habis", dan Pesanan Email A tidak dibuat.
- PRD: §8.5, §8.8

**UAT-H5 — Kelola voucher**
- Langkah:
  1. Sebagai Admin, buat Voucher baru `COBA` dengan masa berlaku berakhir 2 menit lagi.
  2. Pakai di checkout, lalu batalkan.
  3. Tunggu sampai lewat menit berakhirnya, lalu coba lagi.
  4. Coba hapus `COBA` dan `HEMAT5`.
  5. Buat Voucher `HAPUS` tanpa memakainya, lalu hapus.
  6. Nonaktifkan `HEMAT5`, lalu aktifkan kembali.
  7. Coba buat Voucher baru dengan kode `hemat5`, lalu dengan kode `HEMAT-10`.
  8. Buka form ubah `COBA`.
- Hasil:
  - Langkah 2 diterima.
  - Langkah 3 ditolak dengan "Voucher sudah berakhir".
  - Langkah 4 ditolak. `COBA` pernah tercatat di Pesanan walaupun Pesanannya Dibatalkan, dan `HEMAT5` pernah dipakai.
  - Langkah 5 berhasil.
  - `HEMAT5` bisa dinonaktifkan dan diaktifkan kembali.
  - Langkah 7: `hemat5` ditolak karena kodenya sudah dipakai, dan `HEMAT-10` ditolak karena kode hanya boleh berisi huruf dan angka.
  - Langkah 8: kode `COBA` tidak bisa diubah.
- PRD: §8.4, §8.8

## I. Dasbor admin (§9)

**UAT-I1 — Ringkasan dan Pendapatan**
- Langkah: setelah skenario bertanda (bayar) selesai, buka dasbor admin. Jumlahkan sendiri Total bayar semua Pesanan Selesai hari ini di daftar Pesanan.
- Hasil:
  - Pendapatan hari ini sama dengan hasil penjumlahan Anda, termasuk Kode unik.
  - Pesanan Bermasalah dan Dana Dikembalikan tidak ikut dihitung.
  - Pesanan Selesai hari ini sama dengan jumlah Pesanan Selesai yang dibayar hari ini.
  - Jumlah Member aktif sama dengan jumlah Member berstatus Aktif di daftar Member.
  - Kartu Pesanan Bermasalah membuka daftar Pesanan yang sudah disaring ke status Bermasalah.
  - Tidak ada grafik.
- PRD: §9.1, §9.2, §9.3

**UAT-I2 — Stok menipis**
- Langkah:
  1. Pastikan tidak ada Pesanan Menunggu Pembayaran, lalu lihat daftar "Stok menipis".
  2. Ubah Ambang stok menipis menjadi 3 di pengaturan toko.
  3. Coba simpan Ambang stok menipis 1000.
- Hasil:
  - Daftar "Stok menipis" ada di Ringkasan, di bawah kartu angka. Stok Varian terkecil di atas, dan setiap baris membuka halaman Varian.
  - Langkah 1: daftar memuat Netflix Premium 3 Bulan (stok 4), YouTube Premium 1 Bulan (stok 0), YouTube Premium 3 Bulan (stok 3), dan Spotify Premium (stok 0). Netflix Premium 1 Bulan tidak masuk karena stoknya di atas 5. Uji Bayar masuk hanya bila stoknya 5 atau kurang.
  - Langkah 2: Netflix Premium 3 Bulan keluar dari daftar, sedangkan YouTube Premium 3 Bulan tetap ada.
  - Langkah 3 ditolak, karena Ambang stok menipis hanya boleh 0 sampai 999.
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
  - Email Kode verifikasi bersubjek "Kode verifikasi: <kode>", dan email Atur ulang password bersubjek "Atur ulang password". Keduanya menyebut masa berlakunya dan meminta Anda mengabaikan email bila tidak memintanya.
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
  - Bilah atas menampilkan tombol "Masuk" untuk Tamu.
  - Tab Riwayat untuk Tamu menampilkan ajakan login dan penjelasan tentang Tautan Pesanan.
  - Tab Akun untuk Tamu menampilkan tombol "Masuk" dan "Daftar", tombol WhatsApp, serta tautan Syarat & Ketentuan dan Kebijakan Privasi.
  - Untuk Member, tab Riwayat menampilkan Riwayat Pesanan. Tab Akun menampilkan email Member, form ganti password, tombol "Keluar", tombol WhatsApp, dan kedua tautan tadi.
  - Di laptop tampil navbar atas tanpa navigasi bawah.
  - Dasbor admin di ponsel memakai menu lipat.
  - Tidak ada gulir ke samping di layar selebar 360 piksel.
- PRD: §11.1

▶ Keputusan 2026-11-20: Tautan Syarat & Ketentuan dan Kebijakan Privasi di tab Akun kini datang dari footer toko, tidak lagi diulang di isi tab (PRD §11.1). Hasil yang diperiksa: kedua tautan tampil satu kali di tab Akun, di footer setelah tombol WhatsApp.

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

▶ Keputusan 2026-11-18 (#188): Pilihan mode ada di bagian "Tampilan" tab Akun, sebelum tombol WhatsApp, untuk Tamu dan Member.
- Langkah tambahan: pilih "Perangkat", lalu ubah ponsel ke mode gelap. Hasil: toko kembali mengikuti ponsel dan tampil gelap.
- Langkah tambahan: pilih "Gelap" di tab Akun, lalu buka dasbor admin di browser yang sama. Hasil: dasbor admin juga tampil gelap.

**UAT-K4 — Pasang seperti aplikasi (M3)**
- Langkah: di ponsel, pilih "Tambahkan ke layar utama", lalu buka dari ikonnya.
- Hasil:
  - Toko terbuka dengan ikon dan layar pembuka sendiri, tanpa bilah alamat.
  - Dalam mode pesawat, toko tidak bisa dipakai.
- PRD: §11.4

▶ Keputusan 2026-11-18 (#188): Hasil UAT-K4 dipertegas.
- Di bawah ikon tertulis "MIWE Digital", dan ikonnya logo MIWE dengan foto senja.
- Layar pembuka berlatar ungu langit dengan logo di tengah dan nama "MIWE Digital Store", di Android dan iPhone.
- Bilah status ponsel berwarna ungu langit.
- Dalam mode pesawat, yang tampil adalah halaman galat bawaan browser.
- Toko tidak punya tombol "Pasang aplikasi".

▶ Keputusan 2026-11-20: Warna di hasil UAT-K4 mengikuti tema coretan tangan (PRD §11.4).
- Ikonnya tetap logo MIWE dengan foto senja. Di ponsel yang memotong ikon menjadi bulat, latar di sekitar logo berwarna kertas, bukan ungu.
- Layar pembuka berlatar kertas dengan logo di tengah dan nama "MIWE Digital Store" bertulisan tangan, di Android dan iPhone.
- Di Android, bilah status berwarna kertas di mode terang dan arang di mode gelap. Di iPhone, bilah status terang dengan teks gelap.

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

▶ Keputusan 2026-11-15 (#121): Setelah T33-b terpasang, folder cadangan berisi tepat 7 cadangan database dan 7 cadangan folder unggahan dari hari-hari terakhir.

## M. Milestone (§13)

Jalankan skenario sesuai milestone yang sedang diuji:

| Milestone | Skenario |
|---|---|
| M1 | A1, B1, B2, C1–C6, D1–D3, E1, E2, E4–E7, F1, F2, I3, I4, I5, K1, K5, L1. Lewati bagian yang memakai Voucher atau Member: langkah Voucher di E3, pengecekan Riwayat Pesanan di C6, langkah 2 di B1, langkah 2 di K1, dan isian Ambang stok menipis. Di E6, ganti pengecekan kartu "Bermasalah" dengan jumlah Pesanan Bermasalah di daftar Pesanan dasbor admin. Di K1, tab Riwayat untuk Tamu cukup menjelaskan Tautan Pesanan tanpa ajakan login, dan tab Akun berisi tombol WhatsApp serta tautan Syarat & Ketentuan dan Kebijakan Privasi (PRD §11.1) |
| M2 | B3, E3, G1–G7, H1–H5, I1, I2, J1 |
| M3 | K2, K3, K4 |
| M4 | N1–N10, lalu ulangi I1 untuk memastikan Pendapatan dan Pesanan Selesai tidak berubah |
| M5 | O1–O9, lalu ulangi I1 dan N4 untuk memastikan kartu lain tidak berubah selain dua kartu saldo |

PRD: §13

## N. Keuangan toko (§14)

Skenario bagian ini dijalankan berurutan, karena N3 sampai N8 memakai Pesanan dari N2.

**UAT-N1 — Harga modal di form Varian**
- Langkah:
  1. Buka form Varian Netflix Premium 1 Bulan. Kosongkan Harga modal, lalu simpan.
  2. Isi Harga modal −1, lalu simpan.
  3. Ketik Harga modal 35000 sambil memperhatikan tulisan di bawah isian, lalu simpan.
  4. Ubah Harga modal menjadi 60000 dan simpan, lalu kembalikan ke 35000.
  5. Buka halaman Produk Netflix Premium.
- Hasil:
  - Langkah 1 dan 2 ditolak dengan pesan di bawah isian Harga modal.
  - Langkah 3: "Laba kotor per Pesanan: Rp 15.000" berubah langsung saat Anda mengetik, dan Harga modal tersimpan.
  - Langkah 4 diterima, dengan "Laba kotor per Pesanan: −Rp 10.000".
  - Langkah 5: daftar Varian menampilkan Harga jual, Harga modal, dan Laba kotor per Pesanan, yaitu Rp 50.000, Rp 35.000, dan Rp 15.000.
  - Harga modal tidak tampil di Halaman Produk toko.
- PRD: §3.2, §14.1

**UAT-N2 — Biaya transaksi (bayar)**
- Langkah:
  1. Buka pengaturan toko dan lihat isian Biaya transaksi.
  2. Coba simpan persen 10,01, lalu persen 0,755.
  3. Simpan persen 1 dan minimal Total bayar 0.
  4. Beli Uji Bayar dengan Email A sampai Selesai, lalu buka detail Pesanan itu di dasbor admin.
  5. Kembalikan pengaturan ke persen 0,7 dan minimal Rp 100.000, lalu buka lagi detail Pesanan itu.

  Di produksi, jalankan langkah 3 sampai 5 tanpa jeda. Pesanan sungguhan yang dibayar selama pengaturan masih 1% ikut tercatat dengan Biaya transaksi 1%.
- Hasil:
  - Langkah 1: nilai awalnya persen 0,7 dan minimal Rp 100.000.
  - Langkah 2 ditolak dua kali dengan pesan.
  - Langkah 4: Biaya transaksi sama dengan 1% Total bayar, dibulatkan ke atas ke rupiah. Contoh: Total bayar Rp 1.123 memberi Biaya transaksi Rp 12.
  - Langkah 5: Biaya transaksi Pesanan itu tidak berubah, karena dicatat saat pembayaran masuk.
  - Halaman Pesanan di toko tidak menampilkan Biaya transaksi.
- PRD: §9.8, §14.3

**UAT-N3 — Harga modal pertama untuk Pesanan lama**
- Langkah:
  1. Pastikan Uji Bayar belum punya Harga modal. Buka Ringkasan dan detail Pesanan dari UAT-N2.
  2. Isi Harga modal Uji Bayar 800.
  3. Buka lagi detail Pesanan itu dan Ringkasan.
  4. Ubah Harga modal Uji Bayar menjadi 900, lalu buka lagi detail Pesanan itu. Setelah itu kembalikan ke 800.
- Hasil:
  - Langkah 1: kartu laba menampilkan "N Pesanan Selesai belum dihitung labanya, karena Harga modal Varian-nya belum diisi." Detail Pesanan menampilkan Harga modal "—" dengan keterangan "Harga modal Varian ini belum diisi".
  - Langkah 3: detail Pesanan menampilkan Harga modal Rp 800 dan Laba kotor Rp 200. Angka N di peringatan Ringkasan berkurang, atau peringatannya hilang bila tidak ada lagi Pesanan Selesai tanpa Harga modal.
  - Langkah 4: Harga modal Pesanan itu tetap Rp 800.
- PRD: §14.1, §14.2

**UAT-N4 — Kartu Ringkasan**
- Langkah:
  1. Mulai checkout Netflix Premium 1 Bulan dengan Email B tanpa membayar, lalu buka Ringkasan.
  2. Ketuk setiap kartu satu per satu, lalu kembali ke Ringkasan. Setelah itu batalkan Pesanan Email B.
- Hasil:
  - Ada 11 kartu dengan urutan Pendapatan, Total Harga modal, Laba kotor, Laba bersih, Pesanan Selesai, Pesanan Menunggu Pembayaran, Pesanan Bermasalah, Member aktif, Item stok Tersedia, Item stok Terkirim, dan Varian stok menipis.
  - Kartu uang dan kartu Pesanan Selesai menampilkan hari ini, bulan ini, dan sepanjang waktu.
  - Laba kotor hari ini sama dengan jumlah (Harga jual − Harga modal) Pesanan Selesai hari ini yang punya Harga modal.
  - Pesanan Menunggu Pembayaran berisi setidaknya 1, yaitu Pesanan Email B.
  - Kartu Member aktif menulis "dari N Member terdaftar", dan N sama dengan jumlah baris daftar Member.
  - Item stok Tersedia sama dengan jumlah Stok Varian semua Varian aktif dari Produk aktif.
  - Kartu uang membuka Laporan keuangan. Kartu Pesanan Selesai dan Menunggu Pembayaran membuka daftar Pesanan yang sudah disaring ke status itu. Kartu Member aktif membuka daftar Member, dan kartu Item stok membuka menu Item stok.
  - Ringkasan tetap tanpa grafik.
- PRD: §9.2

**UAT-N5 — Biaya operasional dan Laba bersih**
- Langkah:
  1. Catat angka Laba bersih hari ini di Ringkasan.
  2. Dari Laporan keuangan, buka halaman Biaya operasional. Tambah biaya bertanggal hari ini dengan keterangan "Uji biaya" dan nominal 10000.
  3. Coba simpan biaya bertanggal besok, biaya dengan keterangan kosong, dan biaya dengan nominal 0.
  4. Buka Ringkasan lagi.
  5. Ubah nominal "Uji biaya" menjadi 12000, lalu hapus biaya itu.
- Hasil:
  - Langkah 2: biaya tampil paling atas di daftar bulan ini, dan total bulan ini bertambah Rp 10.000.
  - Langkah 3 ditolak tiga kali, masing-masing dengan pesan di isiannya.
  - Langkah 4: Laba bersih hari ini turun tepat Rp 10.000 dari angka langkah 1.
  - Langkah 5: penghapusan ditegaskan lebih dulu di tempat. Setelah dihapus, Laba bersih hari ini kembali ke angka langkah 1.
- PRD: §14.4, §14.5

**UAT-N6 — Laporan keuangan: rincian, saringan, dan periode**
- Langkah:
  1. Lihat menu samping dasbor admin, lalu buka Laporan keuangan.
  2. Ubah rentang menjadi hari ini saja.
  3. Saring Kategori Streaming, lalu Produk Uji Bayar.
  4. Isi tanggal akhir sebelum tanggal mulai.
  5. Pilih periode Mingguan, Bulanan, lalu Tahunan.
- Hasil:
  - Langkah 1: menu samping berurutan Ringkasan, Laporan keuangan, Pesanan, Member, Kategori, Produk, Item stok, Voucher, lalu Pengaturan toko. Laporan keuangan terbuka dengan periode Harian dan rentang 30 hari terakhir sampai hari ini.
  - Langkah 2: rincian tersusun dari Pendapatan sampai Laba bersih. Pendapatan, Pesanan Selesai, Laba kotor, dan Laba bersih sama dengan angka hari ini di Ringkasan. Laba bersih sama dengan Laba kotor − potongan voucher + Kode unik − Biaya transaksi − Biaya operasional, bila Anda hitung sendiri.
  - Langkah 3: baris Biaya operasional diganti keterangan "Laba bersih ini belum dikurangi Biaya operasional, karena saringan Produk atau Kategori sedang aktif." Pilihan Produk hanya berisi Produk Kategori Streaming.
  - Langkah 4 ditolak dengan pesan "Tanggal akhir tidak boleh sebelum tanggal mulai."
  - Langkah 5: rentang awalnya berganti menurut PRD §14.6. Mingguan dimulai hari Senin 12 minggu lalu, Bulanan dimulai tanggal 1 dari 12 bulan lalu, dan Tahunan dimulai 1 Januari tahun Pesanan Selesai pertama.
- PRD: §11.1, §14.5, §14.6

**UAT-N7 — Grafik**
- Langkah:
  1. Di Laporan keuangan, kembalikan saringan ke "Semua" dan periode ke Harian.
  2. Pilih periode Mingguan.
  3. Buka Laporan keuangan di ponsel selebar 360 piksel, lalu dalam mode gelap.
- Hasil:
  - Ada lima grafik: Pendapatan, Laba kotor dan Laba bersih, jumlah Pesanan Selesai, Produk terlaris, dan Pendapatan per Kategori.
  - Hari tanpa Pesanan Selesai tampil dengan nilai 0.
  - Langkah 2: setiap kelompok mencakup Senin sampai Minggu, kecuali kelompok terakhir yang berakhir hari ini.
  - Produk terlaris memuat paling banyak 10 Produk, diurutkan menurut jumlah Pesanan Selesai, dengan Pendapatan di sebelahnya.
  - Langkah 3: grafik terbaca tanpa gulir halaman ke samping, juga dalam mode gelap.
- PRD: §14.7

**UAT-N8 — Tabel Pesanan di Laporan keuangan**
- Langkah:
  1. Lihat tabel di bawah grafik.
  2. Cari dengan sebagian Email A dalam huruf besar, lalu dengan teks yang tidak ada di Pesanan mana pun.
  3. Kosongkan pencarian, lalu ketuk baris Pesanan dari UAT-N2.
- Hasil:
  - Kolomnya Nomor Pesanan, waktu bayar, Produk dan Varian, Harga jual, Harga modal, Laba kotor, potongan voucher, Kode unik, Biaya transaksi, dan Total bayar. Pesanan terbaru ada di atas.
  - Langkah 2: tabel hanya memuat Pesanan Email A, sedangkan rincian angka dan grafik tidak berubah. Teks yang tidak ada menampilkan "Tidak ada Pesanan yang cocok dengan pencarian ini."
  - Langkah 3 membuka detail Pesanan itu di dasbor admin.
- PRD: §14.8

**UAT-N9 — Menu Item stok**
- Langkah:
  1. Buka menu Item stok, lalu pilih Varian Uji Bayar.
  2. Tempel teks berikut tanpa menekan simpan. Baris keempat sengaja kosong, dan baris kelima sama dengan baris pertama:

     ```
     UJI-M4-001
     UJI-M4-002
     UJI-M4-003

     UJI-M4-001
     ```

  3. Simpan.
  4. Ketuk baris Netflix Premium 3 Bulan di daftar Varian.
  5. Buka halaman Varian Uji Bayar dari menu Produk, lalu tempel satu baris di kotak tempelnya tanpa menyimpan.
- Hasil:
  - Langkah 1: halaman menampilkan Format Item stok `Kode`, contoh satu baris tempelan, dan Stok Varian Uji Bayar.
  - Langkah 2: tertulis "4 baris akan diproses".
  - Langkah 3: hasilnya "3 tersimpan, 1 ditolak", dan baris 5 ditolak sebagai baris kembar. Jumlah Tersedia Uji Bayar di daftar Varian bertambah 3.
  - Daftar Varian memuat semua Varian, termasuk yang nonaktif dengan tanda Nonaktif, diurutkan menurut nama Produk lalu Varian, beserta jumlah Tersedia, Ditahan, dan Terkirim.
  - Langkah 4 memilih Netflix Premium 3 Bulan, dan Format Item stok berganti menjadi `Email`, `Password`, `Profil`.
  - Langkah 5: kotak tempel halaman Varian juga menampilkan "1 baris akan diproses".
- PRD: §4.2

**UAT-N10 — Salin semua**
- Langkah:
  1. Buka Halaman Pesanan dari UAT-N2 lewat email "Pesanan selesai" di Email A. Tekan "Salin semua", lalu tempel di aplikasi catatan.
  2. Ulangi dengan Pesanan Selesai sebuah Produk yang Format Item stok-nya punya lebih dari satu kolom. Di seed lokal, pakai Pesanan Netflix Premium milik `member@miwe.example` dari tab Riwayat.
- Hasil:
  - Langkah 1: yang tertempel adalah satu baris "Kode: …".
  - Langkah 2: yang tertempel adalah satu baris untuk setiap kolom, misalnya "Email: …", "Password: …", dan "Profil: …", dengan urutan yang sama seperti di layar.
  - Tombol "Salin" per kolom tetap ada.
- PRD: §6.1

## O. Saldo Member (§15)

Skenario bagian ini dijalankan berurutan, karena O2 sampai O8 memakai saldo dari skenario sebelumnya. Pakai Member uji (`member@miwe.example` di seed lokal).

**UAT-O1 — Admin menambah dan mengurangi saldo**
- Langkah:
  1. Di dasbor admin, buka Member, lalu ketuk email Member uji.
  2. Tekan "Tambah saldo", isi nominal 5000 tanpa keterangan, lalu simpan.
  3. Isi keterangan "Uji tambah saldo", simpan, lalu batalkan penegasannya.
  4. Ulangi langkah 3, lalu setujui penegasannya.
  5. Tekan "Kurangi saldo" dengan nominal Rp 1 lebih besar dari saldo sekarang dan keterangan "Uji kurangi".
  6. Kurangi Rp 2.000 dengan keterangan "Uji kurangi".
  7. Login sebagai Member uji, lalu buka tab Akun dan Riwayat saldo.
- Hasil:
  - Langkah 2 ditolak karena keterangan wajib diisi.
  - Langkah 3 tidak mengubah saldo.
  - Langkah 4: penegasan berbunyi "Tambah Rp 5.000 ke saldo <email>?", lalu saldo bertambah Rp 5.000.
  - Langkah 5 ditolak dengan "Saldo tidak cukup untuk dikurangi Rp … Saldo <email> sekarang Rp …", dan saldo tidak berubah.
  - Langkah 6: saldo berkurang Rp 2.000.
  - Daftar Member menampilkan kolom Saldo dengan angka yang sama.
  - Langkah 7: tab Akun menampilkan "Saldo Rp …" di bawah email. Riwayat saldo menampilkan baris "Dikurangi Admin" −Rp 2.000 di atas baris "Ditambah Admin" +Rp 5.000, beserta keterangan dan saldo sesudahnya.
- PRD: §15.1, §15.2, §15.6, §15.10

**UAT-O2 — Top up (bayar)**
- Langkah:
  1. Sebagai Member uji, tekan "Top up" di tab Akun.
  2. Coba bayar dengan nominal 9999, lalu 499001.
  3. Tekan tombol cepat Rp 50.000, lalu ganti nominalnya menjadi 10000 dan tekan "Bayar dengan QRIS".
  4. Bayar QRIS-nya dari ponsel.
- Hasil:
  - Langkah 2 ditolak dengan "Nominal top up minimal Rp 10.000." dan "Nominal top up maksimal Rp 499.000."
  - Langkah 3: tombol cepat mengisi 50000. Halaman bayar Top up menampilkan QR, hitung mundur, dan rincian Nominal top up Rp 10.000, Kode unik, serta Total bayar.
  - Langkah 4: halaman berpindah sendiri ke Riwayat saldo dengan pesan "Top up Rp 10.000 berhasil. Saldo sekarang Rp …". Setelah halaman itu dimuat ulang, pesannya tidak muncul lagi.
  - Saldo bertambah tepat Rp 10.000, bukan Total bayar, dan baris Top up menyebut Nomor Top up `TOPUP-…`.
  - Tidak ada email yang masuk untuk top up.
- PRD: §15.3, §15.5

**UAT-O3 — Satu Top up menunggu, batal, dan kedaluwarsa (tunggu)**
- Langkah:
  1. Mulai top up Rp 10.000 tanpa membayar, lalu kembali ke tab Akun.
  2. Buka Top up lagi dan tekan "Bayar dengan QRIS" dengan nominal 20000.
  3. Tekan "Batalkan".
  4. Mulai top up lagi tanpa membayar, lalu tunggu 15 menit.
- Hasil:
  - Langkah 1: tab Akun menampilkan "Top up Rp 10.000 menunggu pembayaran" dengan tombol "Lanjutkan bayar".
  - Langkah 2 membuka Halaman bayar Top up Rp 10.000 yang masih menunggu, bukan membuat Top up baru.
  - Langkah 3: Member kembali ke tab Akun, dan tulisan menunggu hilang. Saldo tidak berubah.
  - Langkah 4: setelah 15 menit, tulisan menunggu hilang. Top up yang batal dan kedaluwarsa tidak muncul di Riwayat saldo.
- PRD: §15.3, §15.4

**UAT-O4 — Menu Top up di dasbor admin**
- Langkah:
  1. Buka menu Top up di dasbor admin.
  2. Saring status Berhasil, lalu cari sebagian email Member uji dengan huruf besar.
  3. Buka Top up dari UAT-O2.
- Hasil:
  - Menu Top up ada tepat di bawah Member.
  - Daftar memuat Top up dari UAT-O2 dan UAT-O3 dengan status Berhasil, Dibatalkan, dan Kedaluwarsa, yang terbaru di atas.
  - Saringan dan pencarian hanya menampilkan Top up yang cocok.
  - Detail Top up menampilkan Nominal top up, Kode unik, Total bayar, nominal diterima, Biaya transaksi Rp 0, riwayat status dengan pelaku "Member" dan "Qrispy", serta tautan ke halaman Member.
- PRD: §15.4, §15.9

**UAT-O5 — Top up Bermasalah (seed lokal)**
- Langkah:
  1. Di seed lokal, buka Ringkasan, lalu ketuk kartu Top up Bermasalah.
  2. Buka Top up Bermasalah milik `member@miwe.example`, lalu tekan "Tambahkan ke saldo" dan setujui penegasannya.
  3. Kosongkan database lokal, lalu jalankan `pnpm db:seed` lagi. Selesaikan Top up yang sama dengan "Tandai Dana Dikembalikan".
- Hasil:
  - Langkah 1: kartu ditonjolkan dengan warna Bermasalah dan membuka menu Top up yang sudah disaring ke Bermasalah.
  - Langkah 2: Top up menjadi Berhasil, dan saldo Member bertambah Rp 50.000. Riwayat saldo mencatat baris Top up, dan riwayat status mencatat pelaku "Admin".
  - Langkah 3: Top up menjadi Dana Dikembalikan, dan saldo tidak berubah.
- PRD: §15.4, §15.9

**UAT-O6 — Bayar dengan saldo (bayar)**
- Langkah:
  1. Pastikan saldo Member uji paling sedikit Rp 1.000. Login sebagai Member uji, lalu buka Checkout Uji Bayar.
  2. Bayar dengan tombol saldo.
  3. Sebagai Admin, kurangi saldo Member uji sampai Rp 0, lalu buka lagi Checkout Uji Bayar sebagai Member uji.
  4. Buka Checkout yang sama sebagai Tamu di jendela penyamaran.
- Hasil:
  - Langkah 1: pilihan "Saldo (Rp …)" terpilih, dan tombolnya berbunyi "Bayar Rp 1.000 dengan saldo".
  - Langkah 2: Halaman Pesanan Selesai langsung tampil dengan Item stok, tanpa QRIS. Rinciannya tanpa baris Kode unik dan bertuliskan "Dibayar dengan saldo". Email "Pesanan selesai" masuk dengan rincian yang sama.
  - Riwayat saldo mencatat baris Pembelian −Rp 1.000 dengan Nomor Pesanan-nya.
  - Detail Pesanan di dasbor admin menampilkan Metode Saldo, Biaya transaksi Rp 0, dan riwayat status "Selesai" dengan pelaku "Pembeli (saldo)".
  - Langkah 3: pilihan Saldo tidak bisa dipilih dan bertuliskan "Saldo kurang Rp 1.000. Top up dulu.", dan pilihan awalnya QRIS.
  - Langkah 4: Tamu hanya melihat QRIS.
- PRD: §5.2, §15.7

**UAT-O7 — Saldo dengan Voucher dan Pesanan menunggu (seed lokal)**
- Langkah:
  1. Di seed lokal, login sebagai `member@miwe.example` dengan saldo Rp 45.000. Atur saldonya lewat "Kurangi saldo".
  2. Buka Checkout Netflix Premium 1 Bulan.
  3. Isi `HEMAT10`, lalu tekan "Pakai".
  4. Mulai checkout YouTube Premium 3 Bulan dengan QRIS tanpa membayar, lalu buka lagi Checkout Netflix Premium 1 Bulan dan bayar dengan saldo.
- Hasil:
  - Langkah 2: pilihan Saldo tidak bisa dipilih dan bertuliskan "Saldo kurang Rp 5.000. Top up dulu."
  - Langkah 3: potongan Rp 5.000 membuat saldo cukup, dan tombolnya berbunyi "Bayar Rp 45.000 dengan saldo".
  - Langkah 4: Member diarahkan ke Pesanan YouTube yang masih menunggu, dan saldo tidak berubah. Batalkan Pesanan itu sesudahnya.
- PRD: §5.4, §8.7, §15.7

**UAT-O8 — Kartu saldo di Ringkasan**
- Langkah:
  1. Buka Ringkasan.
  2. Ketuk kartu Total saldo Member.
- Hasil:
  - Ada 13 kartu. Kartu Total saldo Member dan Top up Bermasalah ada tepat setelah Member aktif.
  - Total saldo Member sama dengan jumlah kolom Saldo di daftar Member, termasuk Member nonaktif, dan kartunya berketerangan "Saldo milik Member yang belum dibelanjakan. Ini uang Member, bukan Pendapatan."
  - Langkah 2 membuka daftar Member.
  - Pendapatan hari ini tidak bertambah karena top up di UAT-O2, tetapi bertambah Rp 1.000 karena pembelian dengan saldo di UAT-O6.
- PRD: §9.2, §15.8

**UAT-O9 — Saringan Metode di Laporan keuangan**
- Langkah:
  1. Buka Laporan keuangan dengan rentang hari ini.
  2. Pilih Metode Saldo, lalu QRIS.
  3. Kembalikan Metode ke Semua, lalu pilih Produk Uji Bayar.
- Hasil:
  - Langkah 1: rincian angka memuat baris "+ Kode unik Top up" dan "− Biaya transaksi Top up" sesudah Biaya operasional, serta baris "Top up Berhasil: N, Rp X (uang Member, bukan Pendapatan)" di bawah Laba bersih. Tabel Pesanan punya kolom Metode.
  - Langkah 2: rincian, grafik, dan tabel hanya berisi Pesanan dengan Metode itu. Baris Biaya operasional, baris Top up, dan baris informasi Top up hilang, dan tampil keterangan "Laba bersih ini belum dikurangi Biaya operasional dan Top up, karena saringan Produk, Kategori, atau Metode sedang aktif."
  - Langkah 3: keterangan yang sama tampil.
- PRD: §14.5, §14.6, §15.8
