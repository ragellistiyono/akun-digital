# PRD Akun Digital

<!-- Diisi lewat /tiket:rencanakan-produk. Aturan penulisannya:
- Setiap area punya bagian bernomor (§1, §2, §2.1, …), supaya tiket bisa merujuk "PRD §2.1".
- Keputusan pemilik ditulis sebagai blok "▶ Keputusan YYYY-MM-DD: …", tepat di bawah teks yang diubah atau ditegaskannya. Blok ▶ Keputusan mengalahkan teks di atasnya.
- Rumus, angka, dan ambang ditulis lengkap beserta contoh hitungannya. Contoh itu juga dimasukkan ke tests/golden/.
- Hal yang belum diputuskan tidak ditulis sebagai aturan. Catat di docs/OPEN-DECISIONS.md.
- Istilah ditulis persis seperti di GLOSSARY.md. -->

## 1. Tujuan dan batas

### 1.1 Masalah

MIWE Digital Store menjual Produk digital, misalnya akun premium aplikasi dan game. Tanpa sistem, setiap penjualan dikerjakan tangan pemilik: membalas Pembeli, mengecek uang sudah masuk, lalu mengirim detailnya satu per satu. Cara itu lambat, tidak bisa melayani 24 jam, rawan salah kirim, dan riwayatnya tercecer.

### 1.2 Tujuan

1. Pembeli melihat katalog per kategori, membayar dengan QRIS lewat Qrispy, lalu langsung menerima Item stok di layar dan lewat email, tanpa menunggu Admin.
2. Checkout cukup memakai email. Setelah membayar, Pembeli diarahkan membuat akun Member, supaya bisa melihat Riwayat Pesanan dan memakai Voucher khusus Member.
3. Admin mengelola katalog, Item stok, Voucher, dan Member dari satu dasbor admin.
4. Di layar ponsel, web terasa seperti aplikasi: navbar beranimasi dan navigasi bawah.
5. Biaya operasional rendah. Skala yang dilayani di bawah 1000 Pesanan per hari, dan aplikasi berjalan di satu server.

### 1.3 Yang sengaja tidak dibangun

- Aplikasi ponsel Android atau iOS.
- Top-up game langsung ke ID pemain, file unduhan, dan jasa yang dikerjakan manual. Yang dijual hanya barang berupa teks dari Item stok: data login akun, kode lisensi, dan kode redeem.
- Produk yang diproses manual oleh Admin. Semua pengiriman berjalan otomatis dari Item stok yang diisi Admin lebih dulu.
- Klaim garansi dan penggantian Item stok di dalam sistem. Halaman Produk hanya menampilkan teks ketentuan garansi yang ditulis Admin dan tombol kontak WhatsApp. Klaim diurus di luar sistem.
- Cara bayar selain QRIS lewat Qrispy, seperti transfer manual dengan unggah bukti, e-wallet lain, atau saldo/deposit di toko.
- Harga berbeda per Pembeli, misalnya harga reseller atau harga per level Member.
- Mata uang selain rupiah dan bahasa selain Indonesia.

▶ Keputusan 2026-11-20 (#204): Pemilik ingin menambah saldo Member, yaitu top up oleh Member dan pengelolaan saldo oleh Admin. Fitur ini direncanakan sebagai M5 dan aturannya diputuskan tersendiri. Sampai keputusan M5 masuk PRD, butir "saldo/deposit di toko" di atas tetap berlaku, dan QRIS lewat Qrispy tetap satu-satunya cara bayar.

▶ Keputusan 2026-11-20 (#226): Saldo Member dibangun di M5 menurut §15. Butir "saldo/deposit di toko" di atas tidak berlaku lagi.
- Member membayar Pesanan dengan QRIS lewat Qrispy atau dengan saldo. Tamu tetap hanya membayar dengan QRIS.
- Top up saldo hanya dibayar dengan QRIS lewat Qrispy.
- Cara bayar lain, seperti transfer manual dan e-wallet lain, tetap tidak dibangun. Saldo tidak bisa ditarik menjadi uang atau dipindah ke Member lain.

## 2. Pengguna dan peran

### 2.1 Peran

| Peran | Siapa | Yang boleh dilakukan |
|---|---|---|
| Tamu | Pengunjung yang belum login | Melihat katalog dan checkout. |
| Member | Pembeli yang sudah login | Semua yang boleh dilakukan Tamu, ditambah melihat Riwayat Pesanan dan mengelola profilnya. |
| Admin | Pengelola toko | Mengelola katalog, Item stok, voucher, Pesanan, dan Member lewat dasbor admin. |

Semua Admin punya hak yang sama. Tidak ada peran staf dengan hak terbatas.

▶ Keputusan 2026-11-20 (#226): Member juga boleh top up saldo dan membayar Pesanan dengan saldo (§15.3, §15.7). Admin juga mengelola saldo Member dan Top up (§15.6, §15.9).

### 2.2 Akun Admin

- Akun Admin dibuat lewat perintah di server. Tidak ada halaman untuk mendaftar atau mengelola Admin.
- Admin login di `/admin`, terpisah dari login Member.
- Boleh ada lebih dari satu Admin.
- Aturan keamanan login di §7.7 juga berlaku untuk Admin.

▶ Keputusan 2026-11-11: Admin tetap login selama 12 jam sejak login. Setelah itu Admin diminta login ulang, walaupun sedang aktif memakai dasbor admin. (Sebelumnya OD-2.)

▶ Keputusan 2026-11-11 (#53):
- Password Admin minimal 8 karakter, sama dengan password Member (§7.5). Perintah pembuat Admin menolak password yang lebih pendek dan menampilkan pesan.
- Tepat 12 jam setelah login, sesi Admin sudah berakhir. Contoh: Admin login pukul 08.00. Pukul 19.59.59 sesinya masih berlaku, dan mulai pukul 20.00.00 Admin diminta login ulang.
- Halaman depan dasbor admin adalah Ringkasan (§9.2), di `/admin/ringkasan`. Admin yang masih login dan membuka `/admin` langsung dibawa ke sana. Halaman login berjudul "Masuk ke dasbor admin" dengan tombol "Masuk".
- Email yang tidak terdaftar dan password yang salah ditolak dengan pesan yang sama: "Email atau password salah. Periksa keduanya, lalu coba masuk lagi." Pesan yang sama itu tidak membocorkan email mana yang terdaftar sebagai Admin.

▶ Keputusan 2026-11-17 (#174): Email dan password Member yang benar di halaman login Admin ditolak dengan pesan password salah yang sama. Email Member diperlakukan seperti email yang tidak terdaftar sebagai Admin, cerminan aturan login Member (§7.5).

### 2.3 Kewenangan Admin atas Member

- Daftar Member menampilkan email, tanggal daftar, jumlah Pesanan Selesai, dan total belanja. Total belanja dihitung seperti Pendapatan (§9.3), dari Pesanan Member itu saja.
- Admin bisa membuka Riwayat Pesanan setiap Member.
- Admin bisa menonaktifkan Member dan mengaktifkannya kembali. Member nonaktif tidak bisa login, dan checkout baru dengan emailnya ditolak.
- Admin tidak bisa melihat atau mengubah password Member.

▶ Keputusan 2026-11-17 (#128):
- Daftar Member hanya memuat Member yang sudah memasukkan Kode verifikasi yang benar. Pendaftar (§7.2) tidak tampil. Member terbaru di atas, dan setiap baris menampilkan status Aktif atau Nonaktif.
- Admin bisa mencari Member dengan sebagian email, tanpa membedakan huruf besar dan kecil, sama seperti pencarian daftar Pesanan (§9.5). Contoh: "budi" dan "BUDI" menemukan `budi@mail.com`.
- Riwayat Pesanan seorang Member di dasbor admin berisi Pesanan yang sama dengan §7.4. Setiap Pesanan menaut ke detail Pesanan di dasbor admin (§9.5).
- Begitu Admin menonaktifkan Member, Member itu langsung keluar di semua perangkat. Setelah diaktifkan kembali, Member login lagi seperti biasa.
- Member aktif adalah Member yang sudah diverifikasi dan tidak nonaktif. Jumlah inilah yang tampil di Ringkasan (§9.2).

▶ Keputusan 2026-11-17 (#174):
- Tanggal daftar di daftar Member adalah waktu Kode verifikasi yang benar dimasukkan, yaitu saat Pendaftar menjadi Member (§7.3). Waktu pertama kali mengisi form Daftar tidak disimpan.
- Riwayat Pesanan Member di dasbor admin dibuka dengan mengetuk email Member di daftar Member. Halamannya berisi tautan kembali "Member", judul "Riwayat Pesanan", email Member beserta pil Aktif atau Nonaktif, dan jumlah Pesanan. Semua Pesanan tampil tanpa dibagi per halaman, sama seperti Riwayat Pesanan di toko.

## 3. Katalog

### 3.1 Kategori

- Kategori hanya satu tingkat, tanpa subkategori. Setiap Produk masuk tepat satu Kategori.
- Kategori punya nama dan gambar ikon.
- Kategori yang tidak berisi Produk aktif tidak tampil di toko.
- Kategori yang masih berisi Produk, termasuk Produk nonaktif, tidak bisa dihapus. Admin memindahkan Produknya ke Kategori lain dulu.

▶ Keputusan 2026-11-11 (#53):
- Nama Kategori harus unik. Nama dibandingkan tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir, sama seperti nama kolom Format Item stok (§4.1). Contoh: bila sudah ada Kategori "Streaming", Kategori baru bernama "streaming" ditolak dengan pesan. Mengganti nama Kategori menjadi nama Kategori lain yang sudah ada juga ditolak.
- Kategori tampil di toko bila berisi setidaknya satu Produk yang tampil di katalog, yaitu Produk aktif dengan setidaknya satu Varian aktif. Kategori yang hanya berisi Produk tanpa Varian aktif tidak tampil, sehingga tidak ada Kategori yang membuka daftar kosong.

### 3.2 Produk dan Varian

- Setiap Produk punya satu Varian atau lebih. Setiap Varian punya nama, Harga jual, Harga normal yang opsional, dan Item stok sendiri.
- Contoh: Produk "Netflix Premium" punya Varian "1 Bulan" seharga Rp 50.000 dan Varian "3 Bulan" seharga Rp 135.000.
- Produk yang hanya punya satu Varian tidak menampilkan pilihan Varian ke Pembeli.
- Harga jual minimal Rp 1.000 dan berupa rupiah bulat, tanpa sen.
- Format Item stok ditetapkan per Produk dan berlaku untuk semua Variannya (§4.1).

▶ Keputusan 2026-11-11: Harga jual maksimal Rp 499.000. Form Admin menolak Harga jual di atasnya dan menampilkan pesan.
- Alasannya, Qrispy hanya membuat QRIS sampai Rp 499.000 untuk merchant standar. Transaksi di atas itu juga dikenai biaya 0,7% yang ditambahkan ke tagihan Pembeli, padahal biaya itu tidak ada di rumus Total bayar (§5.5). Rinciannya ada di `docs/referensi/qrispy-api.md`.
- Harga normal tidak dibatasi maksimum, karena hanya untuk tampilan (§3.5).
- Contoh: Harga jual Rp 499.000 diterima, dan Rp 499.001 ditolak.

▶ Keputusan 2026-11-11 (#53): Admin boleh menyimpan Produk sebelum menambah Variannya, dan boleh menonaktifkan semua Varian sebuah Produk. Produk tanpa Varian aktif tidak tampil di toko. Tidak ada aturan yang melarang Produk aktif tanpa Varian aktif.

▶ Keputusan 2026-11-20 (#204): Setiap Varian juga punya Harga modal, yang diisi di form Varian di samping Harga jual. Aturannya ada di §14.1.

### 3.3 Halaman Produk

Halaman Produk menampilkan:
- nama dan Kategori;
- hingga 5 foto. Foto pertama menjadi sampul di katalog;
- deskripsi;
- teks ketentuan garansi yang ditulis Admin;
- tombol kontak WhatsApp;
- daftar Varian beserta Harga jual, Harga normal bila ada, dan Stok Varian.

▶ Keputusan 2026-11-11 (#53):
- Teks ketentuan garansi wajib diisi Admin. Produk yang tidak bergaransi, misalnya kode lisensi, tetap diisi teks, misalnya "Tanpa garansi".
- Foto Produk diunggah di halaman ubah Produk setelah Produk disimpan, bukan di form tambah Produk.
- Produk boleh aktif tanpa foto. Di katalog, Produk tanpa foto tampil dengan petak pengganti (`docs/DESIGN.md`, Foto Produk).

### 3.4 Stok Varian

- Stok Varian tampil sebagai angka, misalnya "Stok 12".
- Varian dengan Stok Varian 0 tampil "Habis" dan tidak bisa dipilih.
- Produk yang semua Variannya habis tampil "Habis" di katalog dan tidak bisa dibeli.
- Cara menghitung Stok Varian ada di §5.3.

### 3.5 Harga normal dan persen hemat

- Harga normal opsional per Varian. Bila diisi, Harga normal tampil dicoret di samping Harga jual, bersama label "Hemat N%".
- Harga normal harus lebih besar dari Harga jual. Bila tidak, form Admin menolaknya dan menampilkan pesan.
- N = (Harga normal − Harga jual) ÷ Harga normal × 100, dibulatkan ke bawah ke bilangan bulat.
- Contoh: Harga normal Rp 75.000 dan Harga jual Rp 50.000. (75.000 − 50.000) ÷ 75.000 × 100 = 33,33…, jadi tampil "Hemat 33%".
- Harga normal hanya untuk tampilan dan tidak ikut hitungan pembayaran.

▶ Keputusan 2026-11-12 (#87):
- Label "Hemat N%" tetap tampil walaupun hasilnya 0%. Contoh: Harga normal Rp 60.000 dan Harga jual Rp 59.999 tampil "Hemat 0%" (`tests/golden/persen-hemat.json`).
- Di Halaman Produk, Varian yang habis tetap menampilkan Harga normal yang dicoret dan "Hemat N%", lalu "Habis" menggantikan "Stok N". Kartu Produk Unggulan berbeda: Varian habis di sana hanya menampilkan label Habis (`docs/DESIGN.md`, Cards / Containers).

### 3.6 Beranda

Urutan isi beranda dari atas:
1. kotak cari nama Produk;
2. deret Kategori;
3. bagian Produk Unggulan;
4. semua Produk aktif, yang bisa disaring per Kategori.

Tidak ada banner promo.

▶ Keputusan 2026-11-11 (#53):
- Bila tidak ada Produk Unggulan yang tampil, bagian Produk Unggulan tidak ditampilkan. Bila tidak ada Produk sama sekali, bagian semua Produk menampilkan "Belum ada Produk yang dijual saat ini."
- Pencarian dan saringan Kategori saling menggantikan. Memilih Kategori mengosongkan kata cari, dan mencari mengembalikan saringan ke semua Kategori. Contoh: Pembeli mengetik "netflix", lalu memilih Kategori Musik. Yang tampil adalah semua Produk Musik, misalnya Spotify Premium.
- Selama Pembeli mencari atau menyaring, bagian Produk Unggulan tidak ditampilkan. Judul daftar berganti menjadi nama Kategori yang dipilih atau "Hasil pencarian".

### 3.7 Nonaktif dan hapus

- Produk atau Varian yang dinonaktifkan hilang dari katalog dan tidak bisa dibeli. Pesanan lamanya tetap tampil utuh di riwayat.
- Produk atau Varian yang sudah pernah dipesan tidak bisa dihapus, hanya dinonaktifkan. "Pernah dipesan" berarti tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan.

▶ Keputusan 2026-11-11 (#53): Produk dan Varian baru sudah aktif saat dibuat, dan Admin bisa menonaktifkannya di form. Produk baru tidak langsung terlihat Pembeli, karena Produk tanpa Varian aktif tidak tampil di toko (§3.2).

▶ Keputusan 2026-11-12 (#87): Tombol hapus Produk dan Varian di dasbor admin selalu tampil, juga untuk yang sudah pernah dipesan. Bila sudah pernah dipesan, server menolak penghapusan dan pesannya menyarankan menonaktifkan.

### 3.8 Harga di kartu Produk

- Kartu Produk di katalog menampilkan foto sampul, nama, dan harga.
- Bila Produk punya lebih dari satu Varian aktif, harganya tampil "Mulai Rp X". X adalah Harga jual termurah di antara Varian aktif yang Stok Varian-nya lebih dari 0.
- Bila Produk hanya punya satu Varian aktif, Harga jual Varian itu tampil langsung, tanpa kata "Mulai".
- Bila semua Varian aktif habis, kartu menampilkan label "Habis" (§3.4). Harganya diambil dari Harga jual termurah di antara semua Varian aktif, dan kata "Mulai" tetap dipakai bila Varian aktifnya lebih dari satu.
- Contoh: Varian "1 Bulan" Rp 50.000 dengan stok 0, dan Varian "3 Bulan" Rp 135.000 dengan stok 4. Kartu menampilkan "Mulai Rp 135.000".

## 4. Item stok

### 4.1 Format Item stok

- Admin menetapkan Format Item stok per Produk, berupa daftar nama kolom. Contohnya `Email`, `Password`, `Profil` untuk akun Netflix, atau satu kolom `Kode` untuk kode lisensi.
- Semua Varian dalam satu Produk memakai Format Item stok yang sama.
- Nama kolom boleh diganti kapan saja.
- Kolom hanya boleh ditambah atau dihapus bila Produk itu tidak punya Item stok yang Tersedia atau Ditahan.
- Item stok yang sudah Terkirim tetap tampil dengan kolom lamanya.

▶ Keputusan 2026-11-11 (#53): Nama kolom Format Item stok tidak boleh kosong atau kembar. Nama kolom dianggap kembar tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir. Contoh: `Email` dan `email` kembar, begitu pula `Email` dan ` Email `. Dari kolom yang kembar, kolom pertama dipertahankan dan kolom berikutnya ditolak dengan menyebut nomornya. Contoh lengkapnya ada di `tests/golden/format-item-stok.json`.

▶ Keputusan 2026-11-12 (#87): Bila tambah atau hapus kolom ditolak, pesannya berbunyi: "Kolom tidak bisa ditambah atau dihapus, karena Produk ini masih punya Item stok Tersedia atau Ditahan: N Tersedia dan M Ditahan. Kolom bisa ditambah atau dihapus setelah semua Item stok Produk ini Terkirim, atau setelah Item stok Tersedia-nya dihapus di halaman Varian. Nama kolom tetap bisa diganti kapan saja." Kata kerja di awal pesan mengikuti perubahan yang ditolak: "ditambah", "dihapus", atau "ditambah atau dihapus".

### 4.2 Mengisi Item stok

Admin mengisi Item stok sebuah Varian dengan dua cara:
- lewat form, satu Item stok setiap kali;
- dengan menempel banyak sekaligus: satu baris untuk satu Item stok, dan kolomnya dipisah `|`. Contoh baris untuk format `Email`, `Password`, `Profil`: `budi@mail.com|rahasia123|Profil 2`.

Saat menempel banyak baris:
- baris yang jumlah kolomnya tidak sama dengan Format Item stok ditolak;
- baris yang sama persis dengan Item stok yang sudah ada di Varian itu, terkirim maupun belum, ditolak. Begitu pula baris kembar di dalam tempelan yang sama: baris pertama disimpan, baris berikutnya ditolak;
- baris yang salah satu kolomnya kosong ditolak;
- baris kosong diabaikan dan tidak dihitung;
- baris yang benar tetap disimpan;
- Admin melihat ringkasan, misalnya "48 tersimpan, 2 ditolak", beserta daftar baris yang ditolak dan alasannya.

▶ Keputusan 2026-11-11 (#53):
- Spasi di awal dan akhir setiap kolom dibuang sebelum Item stok disimpan dan dibandingkan, baik dari form maupun dari tempelan. Contoh: `a | b` dan `a|b` dianggap sama persis. Kolom yang hanya berisi spasi dianggap kosong.
- Setelah tempelan diproses, kotak tempel dikosongkan. Baris yang ditolak tampil di daftar beserta nomor baris, isi baris, dan alasannya, supaya Admin bisa memperbaiki lalu menempelnya lagi.
- Item stok boleh diisi ke Varian atau Produk yang nonaktif, supaya Admin bisa menyiapkan stok sebelum Produk dibuka untuk Pembeli.

▶ Keputusan 2026-11-20 (#204): Menu Item stok
- Dasbor admin punya menu samping "Item stok", tepat di bawah menu Produk (§11.1). Halamannya berisi:
  - **pilihan Varian:** daftar Produk lalu Variannya, termasuk Produk dan Varian nonaktif;
  - **keterangan Varian terpilih:** Format Item stok Produknya, contoh satu baris tempelan untuk format itu, dan Stok Varian saat ini;
  - **kotak tempel:** cara mengisi dan aturan tolaknya sama persis dengan tempelan di bagian ini, termasuk ringkasan "48 tersimpan, 2 ditolak" beserta daftar baris yang ditolak;
  - **daftar semua Varian:** nama Produk, nama Varian, status Aktif atau Nonaktif, serta jumlah Item stok Tersedia, Ditahan, dan Terkirim. Daftar diurutkan menurut nama Produk lalu nama Varian, A sampai Z. Mengetuk sebuah baris memilih Varian itu untuk diisi.
- Di bawah kotak tempel tampil "N baris akan diproses", yang berubah langsung saat Admin menempel atau mengetik, sebelum menekan simpan. N adalah jumlah baris yang tidak kosong. Baris kosong dan baris yang hanya berisi spasi tidak dihitung, karena keduanya diabaikan saat disimpan. Dengan begitu N sama dengan jumlah tersimpan ditambah jumlah ditolak. Contoh lengkapnya ada di `tests/golden/hitungan-baris-tempel.json`.
- Kotak tempel di halaman Varian (§9.7) tetap ada dan ikut menampilkan hitungan yang sama. Form satu Item stok tetap hanya ada di halaman Varian.

▶ Keputusan 2026-11-20 (#224): Menu Item stok
- Contoh satu baris tempelan berupa nama kolom Format Item stok yang disambung `|`, misalnya `Email|Password|Profil`.
- Di daftar Varian, status Aktif atau Nonaktif adalah status Varian itu sendiri. Bila Produknya nonaktif, baris itu juga diberi teks "Produk nonaktif".
- Saat menu dibuka tanpa Varian terpilih, halaman hanya menampilkan pilihan Varian, petunjuk, dan daftar Varian. Keterangan Varian dan kotak tempel muncul setelah Admin memilih Varian, supaya Item stok tidak tertempel ke Varian yang salah.

### 4.3 Satu Item stok untuk satu Pesanan

- Setiap Item stok dikirim ke tepat satu Pesanan, lalu tidak bisa dipakai lagi.
- Untuk akun sharing, misalnya satu akun Netflix untuk 5 profil, Admin memasukkan 5 Item stok, satu per profil.

### 4.4 Mengubah dan menghapus Item stok

- Item stok yang Tersedia boleh diubah atau dihapus.
- Item stok yang Ditahan atau Terkirim tidak bisa diubah atau dihapus. Item stok Ditahan sudah disisihkan untuk Pesanan yang sedang menunggu pembayaran (§5.3).

## 5. Checkout dan pembayaran

### 5.1 Pesanan

- Satu Pesanan berisi satu Varian dengan jumlah 1, sehingga mendapat tepat satu Item stok. Pembeli yang ingin lebih dari satu melakukan checkout berulang.
- Harga jual dan potongan voucher dicatat di Pesanan saat checkout. Perubahan harga sesudahnya tidak mengubah Pesanan yang sudah ada.

### 5.2 Form checkout

- Form berisi email (wajib) dan kode voucher (opsional), dengan pengingat "Pastikan email benar, detail pesanan dikirim ke sini". Tidak ada isian nomor WhatsApp.
- Bila Member sedang login, emailnya sudah terisi dan tidak bisa diubah.
- Checkout ditolak bila email itu milik Member nonaktif (§2.3) atau Stok Varian-nya 0.
- Bila email itu masih punya Pesanan Menunggu Pembayaran, berlaku §5.4.
- Form menampilkan kalimat kecil "Dengan membayar, Anda menyetujui Syarat & Ketentuan", dengan tautan ke halaman itu, tanpa kotak centang.

▶ Keputusan 2026-11-12 (#87): Checkout yang ditolak karena Stok Varian 0 menampilkan pesan "Stok Varian ini sudah habis, jadi Pesanan tidak dibuat. Pilih Varian lain, atau Produk lain di Beranda." Bila email itu juga masih punya Pesanan Menunggu Pembayaran, §5.4 didahulukan.

▶ Keputusan 2026-11-17 (#128):
- Checkout dengan email Member nonaktif ditolak dengan pesan "Email ini milik Member yang dinonaktifkan, jadi Pesanan tidak dibuat. Hubungi kami di WhatsApp."
- Pemeriksaan checkout berjalan berurutan, dan pemeriksaan pertama yang menolak menentukan hasilnya:
  1. Produk atau Varian tidak dijual (§3.7);
  2. email milik Member nonaktif;
  3. email masih punya Pesanan Menunggu Pembayaran (§5.4);
  4. Stok Varian 0;
  5. Voucher (§8.7).
- Contoh: email Andi masih punya Pesanan Menunggu Pembayaran. Andi checkout lagi dari browser yang sama dengan Voucher yang sudah berakhir. Ia diarahkan ke Pesanannya, bukan melihat "Voucher sudah berakhir".
- Contoh: Admin menonaktifkan Member Budi saat Budi masih punya Pesanan Menunggu Pembayaran. Checkout baru dengan email Budi ditolak dengan pesan Member nonaktif, sedangkan Pesanan yang sudah ada tetap berjalan seperti biasa.

▶ Keputusan 2026-11-17 (#174): Pesan penolakan checkout karena email milik Member nonaktif tampil beserta tombol WhatsApp, sama seperti di login Member nonaktif (§7.5). Bila nomor WhatsApp toko belum diisi (§9.8), hanya pesannya yang tampil.

▶ Keputusan 2026-11-20 (#226): Bayar dengan saldo (§15.7)
- Member yang login memilih cara bayar "Saldo (Rp X)" atau "QRIS" di form checkout. Tamu hanya melihat QRIS.
- Urutan pemeriksaan di atas mendapat langkah keenam, yang hanya berlaku bila Member memilih Saldo:
  6. saldo kurang dari Harga jual − potongan voucher.
- Batas Pesanan menunggu (langkah 3, §5.4) juga berlaku saat Member memilih Saldo.

### 5.3 Penahanan Item stok

- Begitu Pesanan dibuat dan QRIS-nya terbit, satu Item stok Varian itu ditahan untuk Pesanan tersebut.
- Stok Varian = jumlah Item stok Varian yang belum terkirim dan tidak sedang ditahan.
- Contoh: sebuah Varian punya 10 Item stok yang belum terkirim, dan 2 di antaranya sedang ditahan. Stok Varian tampil 8.
- Item stok dilepas lagi bila Pesanannya Kedaluwarsa atau Dibatalkan.

### 5.4 Batas Pesanan menunggu

- Satu email hanya boleh punya 1 Pesanan Menunggu Pembayaran.
- Bila Pembeli checkout lagi dengan email yang sama, ia diarahkan ke Pesanan yang masih menunggu. Ia boleh membatalkannya dulu, lalu checkout lagi.

▶ Keputusan 2026-11-11: Pembeli hanya diarahkan ke Pesanan yang masih menunggu bila ia checkout dari browser tempat Pesanan itu dibuat. Alasannya, Item stok hanya boleh terlihat oleh orang yang membuat Pesanan.
- Di browser lain, checkout ditolak dengan pesan "Email ini masih punya Pesanan yang menunggu pembayaran sampai pukul HH.MM WIB. Lanjutkan dari perangkat tempat Anda memesan, atau checkout lagi setelah waktu itu."
- Pesan itu tidak memuat tautan ke Pesanan dan tidak punya tombol batal.
- Setelah Pesanan itu Kedaluwarsa, paling lama 15 menit kemudian, email itu boleh checkout lagi dari browser mana pun.
- Contoh: Andi checkout pukul 10.00 di ponselnya, dan QRIS-nya kedaluwarsa pukul 10.15. Pukul 10.05 Andi checkout lagi dari tab baru di ponsel yang sama, lalu diarahkan ke Pesanannya. Pukul 10.06 seseorang checkout dengan email Andi dari laptop lain, lalu melihat pesan "… sampai pukul 10.15 WIB …" tanpa tautan.

▶ Keputusan 2026-11-12 (#87):
- Jam di pesan "… sampai pukul HH.MM WIB …" dibulatkan ke atas ke menit berikutnya, supaya jam yang tertulis tidak pernah lebih awal dari waktu kedaluwarsa. Contoh: waktu kedaluwarsa 10.15.20 tertulis "10.16", sedangkan 10.15.00 tetap "10.15".
- Aturan bagian ini didahulukan sebelum penolakan karena Stok Varian 0 (§5.2). Contoh: Item stok terakhir Netflix Premium 1 Bulan sedang ditahan Pesanan Andi. Bila Andi checkout lagi Varian itu dari browser yang sama, ia diarahkan ke Pesanannya, bukan melihat pesan stok habis. Di browser lain, ia melihat pesan "… sampai pukul HH.MM WIB …".

### 5.5 Total bayar dan Kode unik

- Qrispy menambahkan Kode unik Rp 1–499 ke setiap tagihan. Kode unik dibayar Pembeli dan masuk saldo toko.
- Total bayar = Harga jual − potongan voucher + Kode unik.
- Contoh:

  | Rincian | Nominal |
  |---|---|
  | Harga jual | Rp 50.000 |
  | Potongan voucher | − Rp 5.000 |
  | Kode unik | Rp 123 |
  | **Total bayar** | **Rp 45.123** |

- Pesanan mencatat Harga jual, potongan voucher, dan Kode unik secara terpisah. Rincian ini tampil di halaman bayar, di email, dan di riwayat.

### 5.6 Halaman bayar

Halaman bayar menampilkan:
- gambar QR;
- hitung mundur sampai QRIS kedaluwarsa;
- rincian nominal sesuai §5.5;
- tombol "Simpan gambar QR", supaya Pembeli di ponsel bisa membuka gambar itu dari aplikasi e-wallet;
- tombol "Batalkan".

Begitu pembayaran masuk, halaman berpindah sendiri ke halaman Pesanan.

### 5.7 Status Pesanan

| Status | Arti |
|---|---|
| Menunggu Pembayaran | QRIS sudah terbit dan belum dibayar. |
| Selesai | Sudah dibayar, dan Item stok sudah dikirim. |
| Kedaluwarsa | Masa berlaku QRIS lewat tanpa pembayaran. |
| Dibatalkan | Dibatalkan Pembeli sebelum membayar. |
| Bermasalah | Sudah dibayar, tetapi Item stok belum bisa dikirim (§5.9). |
| Dana Dikembalikan | Pesanan Bermasalah yang uangnya sudah dikembalikan Admin di luar sistem. |

Perpindahan status yang boleh terjadi:
- Menunggu Pembayaran → Selesai, Kedaluwarsa, Dibatalkan, atau Bermasalah;
- Kedaluwarsa atau Dibatalkan → Selesai atau Bermasalah, hanya bila kabar pembayaran datang terlambat (§5.9);
- Bermasalah → Selesai atau Dana Dikembalikan, oleh Admin.

Satu Pesanan hanya pernah mendapat satu Item stok, walaupun kabar pembayarannya datang berulang kali.

▶ Keputusan 2026-11-12 (#87): Riwayat status Pesanan mencatat pelaku setiap perubahan:
- "Pembeli": Pesanan dibuat saat checkout, atau dibatalkan Pembeli;
- "Qrispy": perubahan karena kabar pembayaran;
- "Sistem": Kedaluwarsa otomatis;
- "Admin": Pesanan Bermasalah diselesaikan Admin.

▶ Keputusan 2026-11-20 (#226): Pesanan yang dibayar dengan saldo (§15.7) dibuat langsung berstatus Selesai, tanpa melewati Menunggu Pembayaran. Riwayat statusnya mencatat satu perubahan "Selesai" dengan pelaku "Pembeli (saldo)". Pesanan itu tidak pernah Bermasalah dan tidak bisa dibatalkan. Perpindahan status di atas tetap berlaku untuk Pesanan QRIS.

### 5.8 Pembatalan dan kedaluwarsa

- Pembeli bisa membatalkan Pesanan yang masih Menunggu Pembayaran. QRIS-nya ikut dibatalkan di Qrispy, lalu Item stok dan kuota voucher dilepas.
- Bila Qrispy menolak pembatalan karena tagihan sudah dibayar, Pesanan diproses sebagai sudah dibayar.
- Masa berlaku QRIS ditentukan Qrispy, yaitu 15 menit, dan Qrispy memberi waktu kedaluwarsanya. Pesanan yang belum dibayar menjadi Kedaluwarsa begitu waktu itu tercapai, lalu Item stok dan kuota voucher dilepas. Pembeli boleh checkout lagi dari awal.
- Contoh: QRIS terbit pukul 10.00.00 dengan waktu kedaluwarsa 10.15.00. Pukul 10.14.59 Pesanan masih Menunggu Pembayaran. Pukul 10.15.00 Pesanan sudah Kedaluwarsa.

▶ Keputusan 2026-11-12 (#87):
- Tombol "Batalkan" langsung membatalkan, tanpa dialog konfirmasi. Setelah itu Pembeli tetap di Tautan Pesanan dan melihat Halaman Pesanan Dibatalkan, beserta tautan "Checkout lagi".
- Bila Qrispy menolak pembatalan karena tagihan sudah dibayar, Pembeli melihat Halaman Pesanan Selesai disertai pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan."
- Saat waktu kedaluwarsa tercapai, toko memeriksa status QRIS ke Qrispy sekali. Bila pemeriksaan itu gagal, misalnya Qrispy tidak menjawab, Pesanan tetap menjadi Kedaluwarsa tepat waktu. Pembayaran yang ternyata sudah masuk diproses belakangan sebagai kabar terlambat (§5.9).

▶ Keputusan 2026-11-12 (#99):
- Pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan." hanya tampil di Halaman Pesanan Selesai, tepat setelah Pembeli menekan "Batalkan". Bila pembayaran itu membuat Pesanan menjadi Bermasalah, misalnya karena nominalnya kurang, Pembeli melihat Halaman Pesanan Bermasalah tanpa pesan itu (§6.2).
- Pesan yang sama juga tampil bila Pesanan sudah Selesai saat "Batalkan" diproses, misalnya karena pembayarannya tercatat beberapa detik lebih dulu. Pesanan itu tidak dibatalkan.

### 5.9 Pembayaran bermasalah

1. **Kabar bayar datang untuk Pesanan yang sudah Kedaluwarsa atau Dibatalkan.** Bila Varian itu masih punya Stok Varian, Item stok dikirim seperti biasa dan Pesanan menjadi Selesai. Bila stok habis, Pesanan menjadi Bermasalah.
2. **Nominal yang diterima kurang dari Total bayar.** Pesanan menjadi Bermasalah, Item stok tidak dikirim, dan Item stok yang ditahan Pesanan itu dilepas. Nominal yang sama dengan atau lebih dari Total bayar diproses seperti pembayaran biasa.

Pesanan Bermasalah tampil menonjol di dasbor admin. Admin menyelesaikannya dengan salah satu cara:
- menekan "Kirim Item stok". Sistem mengambil satu Item stok Tersedia dari Varian yang sama, lalu Pesanan menjadi Selesai. Bila stok Varian itu habis, Admin mengisi stok dulu. Item stok dari Varian lain tidak bisa dipakai;
- menandai Pesanan sebagai Dana Dikembalikan, setelah uangnya dikembalikan di luar sistem.

▶ Keputusan 2026-11-12 (#87):
- Bila Admin menekan "Kirim Item stok" saat Stok Varian 0, pesannya berbunyi: "Item stok tidak dikirim, karena Stok Varian Pesanan ini 0, jadi Pesanan tetap Bermasalah. Isi Item stok Varian itu dulu di menu Produk, lalu tekan "Kirim Item stok" lagi. Item stok dari Varian lain tidak bisa dipakai."
- Kedua cara penyelesaian ditegaskan lebih dulu sebelum dijalankan, karena keduanya tidak bisa dibatalkan (`docs/DESIGN.md`, Navigation).

## 6. Pengiriman Item stok

### 6.1 Tempat Item stok tampil

Item stok sebuah Pesanan Selesai tampil di tiga tempat:
1. halaman Pesanan, langsung setelah pembayaran masuk;
2. email "Pesanan selesai";
3. Riwayat Pesanan di dasbor Member.

Setiap kolom Item stok di web punya tombol "Salin".

▶ Keputusan 2026-11-20 (#204): Tombol "Salin semua"
- Di atas Item stok Halaman Pesanan Selesai ada tombol "Salin semua" yang menyalin seluruh Item stok sekaligus. Tombol "Salin" per kolom tetap ada. Riwayat Pesanan membuka halaman yang sama (§7.4), jadi tombol ini juga tersedia bagi Member.
- Teks yang disalin berisi satu baris untuk setiap kolom, dengan urutan kolom Format Item stok, dalam bentuk "Nama kolom: isi". Item stok yang dikirim dengan kolom lama memakai nama kolom lamanya (§4.1). Contoh untuk format `Email`, `Password`, `Profil`:

  ```
  Email: budi@mail.com
  Password: rahasia123
  Profil: Profil 2
  ```

- Contoh lengkapnya ada di `tests/golden/teks-salin-semua.json`.

### 6.2 Tautan Pesanan

- Email "Pesanan selesai" berisi Tautan Pesanan, yaitu alamat acak dan panjang yang tidak bisa ditebak.
- Siapa pun yang memegang Tautan Pesanan bisa membuka halaman Pesanan beserta Item stoknya tanpa login. Dengan begitu Tamu yang sudah menutup tab tetap bisa membuka Pesanannya lagi.

▶ Keputusan 2026-11-12 (#87): Halaman Pesanan Bermasalah menampilkan pil status, kalimat "Pembayaran Anda sudah kami terima, tetapi Item stok belum bisa dikirim. Hubungi kami lewat WhatsApp.", tombol WhatsApp, serta Produk dan Varian beserta rincian nominal (§5.5).

### 6.3 Email "Pesanan selesai"

Email berisi Item stok, rincian nominal sesuai §5.5, dan Tautan Pesanan.

▶ Keputusan 2026-11-12 (#87):
- Subjek email: "Pesanan selesai: <Nomor Pesanan>", misalnya "Pesanan selesai: MIWE-7K3P9Q".
- Isi email dibuka dengan "Pembayaran Pesanan <Nomor Pesanan> sudah kami terima. Berikut Item stok Anda.", lalu bagian "Item stok Anda" dan "Rincian pembayaran", lalu kalimat "Buka Pesanan ini kapan saja tanpa login lewat Tautan Pesanan berikut:" beserta Tautan Pesanan.

### 6.4 Kirim ulang dan koreksi email

- Admin bisa mengirim ulang email "Pesanan selesai" dari dasbor admin.
- Admin bisa mengoreksi email Pesanan yang salah ketik, lalu mengirim ulang. Pembeli meminta koreksi ini lewat WhatsApp.
- Bila pengiriman email gagal, Pesanan tetap Selesai. Sistem mencoba mengirim ulang sendiri beberapa kali, dan Admin melihat tanda "Email gagal" pada Pesanan itu.
- Pembeli tidak punya tombol kirim ulang email.

▶ Keputusan 2026-11-12 (#87):
- Untuk Pesanan Selesai, koreksi email dan kirim ulang dijalankan bersama oleh satu tombol "Simpan dan kirim ulang", supaya email yang sudah dikoreksi selalu ikut dikirim.
- Email Pesanan Bermasalah juga bisa dikoreksi, supaya alamatnya benar sebelum Admin menekan "Kirim Item stok". Untuk Pesanan Bermasalah, koreksi hanya menyimpan email baru. Email "Pesanan selesai" dikirim begitu Pesanan itu menjadi Selesai (§5.9).

## 7. Member

### 7.1 Membuat akun setelah membayar

- Halaman Pesanan Selesai selalu menampilkan Item stok, baik Pembeli membuat akun maupun tidak.
- Bila email Pesanan belum milik Member, di bawah Item stok tampil ajakan menonjol "Buat akun untuk menyimpan riwayat", berisi isian password. Emailnya diambil dari Pesanan.
- Bila email Pesanan sudah milik Member yang sedang tidak login, Pesanan itu otomatis masuk Riwayat Pesanan Member tersebut. Halaman Pesanan menampilkan "Login untuk melihat riwayat", bukan form buat akun.

▶ Keputusan 2026-11-17 (#128): Yang tampil di bawah Item stok Halaman Pesanan Selesai bergantung pada siapa yang membukanya.
- Tidak ada yang login, dan email Pesanan belum milik Member: ajakan "Buat akun untuk menyimpan riwayat". Email Pendaftar (§7.2) dan email Admin juga dianggap belum milik Member. Untuk email Admin, pendaftarannya ditolak menurut §7.2.
- Tidak ada yang login, dan email Pesanan milik Member, aktif maupun nonaktif: "Login untuk melihat riwayat".
- Member yang sedang login membuka Pesanan dengan emailnya sendiri: tautan "Lihat Riwayat Pesanan".
- Member yang sedang login membuka Pesanan dengan email lain: tidak ada ajakan apa pun.

### 7.2 Daftar tanpa membeli

Orang boleh mendaftar Member dari halaman Daftar tanpa membeli lebih dulu. Caranya sama: membuat password, lalu memasukkan Kode verifikasi (§7.3).

▶ Keputusan 2026-11-17 (#128):
- Orang yang sudah membuat password tetapi belum memasukkan Kode verifikasi yang benar disebut Pendaftar. Pendaftar belum menjadi Member: ia tidak bisa login, tidak tampil di daftar Member, dan emailnya dianggap belum milik Member.
- Pendaftar boleh mengulang pendaftaran kapan saja, lewat halaman Daftar atau ajakan di Halaman Pesanan. Password baru menggantikan password lama, Kode verifikasi lama tidak berlaku lagi, dan Kode verifikasi baru dikirim.
- Jeda 60 detik (§7.7) juga berlaku untuk pendaftaran ulang. Pendaftaran ulang sebelum 60 detik sejak kode terakhir dikirim ditolak dengan pesan "Kode verifikasi baru bisa dikirim lagi dalam N detik.", dan tidak ada yang berubah.
- Contoh: Sinta membuat password pukul 10.00.00, lalu menutup tab. Pukul 10.00.30 ia mendaftar lagi dan ditolak dengan "… dalam 30 detik.". Pukul 10.20 ia mendaftar lagi dengan password lain. Kode baru dikirim, kode pukul 10.00 tidak berlaku lagi, dan password yang dipakai adalah password terakhir.
- Pendaftaran dengan email yang sudah dipakai Member, aktif maupun nonaktif, atau dipakai Admin, ditolak dengan pesan "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya." Pesannya sama untuk ketiganya.
- Satu email hanya bisa menjadi Admin atau Member, tidak keduanya. Admin yang ingin berbelanja sebagai Member memakai email lain.
- Email dibandingkan menurut §7.4.

▶ Keputusan 2026-11-17 (#174): Halaman Daftar dan halaman verifikasi
- Pengantar halaman Daftar: "Buat password untuk akun Member Anda. Kami kirim Kode verifikasi ke email itu." Isian password diberi teks bantuan "Minimal 8 karakter."
- Halaman verifikasi berjudul "Kode verifikasi" dan berbunyi "Kode verifikasi 6 digit sudah kami kirim ke <email>. Kode berlaku 10 menit. Periksa juga folder spam."
- Setelah "Kirim ulang kode" berhasil, tampil "Kode verifikasi baru sudah kami kirim ke <email>."
- Pendaftaran ulang yang ditolak karena jeda 60 detik menampilkan pesannya di halaman Daftar, dan isian email tetap terisi.

### 7.3 Kode verifikasi

- Setelah password dibuat, sistem mengirim Kode verifikasi 6 digit ke email itu.
- Kode verifikasi berlaku 10 menit sejak dikirim. Tepat 10 menit setelah dikirim, kode sudah tidak berlaku.
- Akun Member baru aktif, dan Riwayat Pesanannya baru tertaut, setelah Kode verifikasi yang benar dimasukkan. Sebelum itu akun Member tidak bisa dipakai login.
- Contoh: kode dikirim pukul 10.00. Kode masih diterima pukul 10.09, dan ditolak pukul 10.11.

▶ Keputusan 2026-11-17 (#128): Begitu Kode verifikasi yang benar dimasukkan, akun Member aktif, dan Pendaftar langsung masuk sebagai Member lalu dibawa ke Riwayat Pesanan. Ini berlaku untuk pendaftaran dari halaman Daftar maupun dari Halaman Pesanan (§7.1). Lama sesinya sama dengan login Member biasa, yaitu 30 hari (§7.5).

▶ Keputusan 2026-11-17 (#174): Memasukkan Kode verifikasi
- Isian kode punya teks bantuan "Kode 6 angka di email terakhir dari kami." dan tombol "Verifikasi". Isian ini berada di atas tombol "Kirim ulang kode".
- Kode yang dimasukkan setelah masa 10 menitnya habis selalu ditolak dengan pesan kedaluwarsa, apa pun isinya, dan tidak menambah hitungan salah (§7.7). Kode yang hangus sekaligus kedaluwarsa juga mendapat pesan kedaluwarsa.
- Isian yang kosong atau bukan 6 angka ditolak di bawah isian dan tidak dihitung sebagai salah: "Kode verifikasi belum diisi. Ketik kode 6 angka di email terakhir dari kami." atau "Kode verifikasi terdiri dari 6 angka. Periksa lagi kode di email terakhir dari kami." Spasi di awal dan akhir isian dibuang.
- Email yang dijadikan Admin (§2.2) selagi masih Pendaftar ditolak saat kodenya dimasukkan, dengan pesan "Email ini sudah terdaftar. …" (§7.2). Akun Member tidak dibuat.
- Setelah "Kirim ulang kode" berhasil, pesan penolakan kode sebelumnya, misalnya pesan kode hangus, langsung hilang. Yang tampil hanya kabar bahwa kode baru sudah dikirim.

### 7.4 Riwayat Pesanan

- Riwayat Pesanan Member berisi semua Pesanan yang emailnya sama dengan email Member, termasuk Pesanan yang dibuat sebelum ia menjadi Member.
- Email dianggap sama tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir. Contoh: `Budi@Mail.com` sama dengan `budi@mail.com`.
- Semua status Pesanan tampil, dengan Pesanan terbaru di atas.

▶ Keputusan 2026-11-17 (#128): Setiap baris Riwayat Pesanan membuka Halaman Pesanan yang sama dengan Tautan Pesanan (§6.2). Pesanan Menunggu Pembayaran membuka Halaman bayar, lengkap dengan tombol "Batalkan" (§5.6). Item stok tidak dibuka di dalam daftar Riwayat Pesanan.

### 7.5 Login dan lupa password

- Member login dengan email dan password. Password minimal 8 karakter.
- Untuk lupa password, sistem mengirim tautan atur ulang ke email. Tautan itu berlaku 30 menit sejak dikirim dan hanya bisa dipakai sekali. Tepat 30 menit setelah dikirim, tautan sudah tidak berlaku.
- Tidak ada login dengan Google atau layanan lain.

▶ Keputusan 2026-11-11: Member tetap login selama 30 hari sejak login. Setelah itu Member diminta login ulang. (Sebelumnya OD-2.)

▶ Keputusan 2026-11-17 (#128): Login Member
- Pesan password salah dan pesan kunci 15 menit sama dengan login Admin (§2.2, §7.7). Pesan password salahnya: "Email atau password salah. Periksa keduanya, lalu coba masuk lagi."
- Di login Member, email Pendaftar (§7.2) dan email Admin diperlakukan seperti email yang tidak terdaftar.
- Member nonaktif yang memasukkan password benar melihat "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp." beserta tombol WhatsApp. Bila password-nya salah, ia melihat pesan password salah biasa, dan kesalahan itu dihitung ke batas salah password (§7.7).
- Member yang login lewat tautan Masuk di Checkout kembali ke Checkout Varian yang sama (§8.7). Login dari bilah atas atau tab Akun membuka Riwayat Pesanan.

▶ Keputusan 2026-11-17 (#128): Lupa password
- Setelah email diisi, halaman selalu menampilkan "Bila email ini terdaftar sebagai Member, tautan atur ulang password sudah kami kirim. Periksa juga folder spam.", apa pun emailnya.
- Tautan atur ulang password hanya dikirim ke Member aktif. Pendaftar, Member nonaktif, Admin, dan email yang tidak terdaftar tidak menerima email apa pun.
- Tautan baru untuk email yang sama paling cepat dikirim 60 detik setelah tautan sebelumnya, sama seperti Kode verifikasi (§7.7). Permintaan yang lebih cepat tidak mengirim email, tetapi pesannya tetap sama. Contohnya ada di `tests/golden/kirim-tautan-atur-ulang-password.json`.
- Tautan baru membuat tautan sebelumnya tidak berlaku lagi, walaupun 30 menitnya belum habis (`tests/golden/tautan-atur-ulang-password.json`).
- Password baru minimal 8 karakter.
- Setelah password baru disimpan lewat tautan:
  - Member keluar dari semua perangkat;
  - kunci login 15 menit untuk email itu dicabut, dan hitungan kesalahannya kembali ke 0 (§7.7);
  - Member dibawa ke halaman Masuk dengan pesan "Password sudah diganti. Masuk dengan password baru."

▶ Keputusan 2026-11-17 (#174): Halaman Masuk, Keluar, dan Daftar
- Member yang masih login lalu membuka halaman Masuk langsung dibawa ke Riwayat Pesanan. Bila alamatnya membawa alamat kembali dari Checkout (§8.7), Member dibawa ke alamat itu.
- Setelah menekan "Keluar" di tab Akun, Pembeli tetap di tab Akun, yang kini tampil untuk Tamu.
- Halaman Masuk menampilkan "Belum punya akun? Daftar" di bawah tautan "Lupa password?", dan halaman Daftar menampilkan "Sudah punya akun? Masuk". Hanya kata "Daftar" dan "Masuk" yang menjadi tautan.

▶ Keputusan 2026-11-17 (#174): Tautan atur ulang password
- Bila sebuah tautan tidak berlaku karena lebih dari satu alasan, pesannya dipilih berurutan: sudah dipakai, lalu sudah diganti tautan baru, lalu kedaluwarsa. Contoh: tautan yang sudah dipakai lalu dibuka lagi 40 menit kemudian menampilkan pesan "sudah dipakai".
- Alamat atur ulang yang tidak dikenal membuka halaman "Tautan tidak ditemukan" dengan teks "Tautan atur ulang password ini tidak dikenal. Periksa lagi alamatnya, atau minta tautan baru di halaman Lupa password." dan tombol "Minta tautan baru".
- Selama Member nonaktif (§2.3), tautan atur ulang password miliknya tidak bisa dipakai, walaupun dikirim saat Member masih aktif dan 30 menitnya belum habis. Membuka tautan itu menampilkan "Akun Member ini dinonaktifkan, jadi password tidak bisa diganti. Hubungi kami di WhatsApp." beserta tombol WhatsApp, dan password tidak berubah.
- Contoh: tautan dikirim ke Budi pukul 10.00. Pukul 10.05 Admin menonaktifkan Budi. Pukul 10.10 Budi membuka tautan itu dan melihat pesan nonaktif. Password Budi tetap yang lama.

▶ Keputusan 2026-11-18 (#186): Alasan nonaktif berada paling atas dalam urutan alasan tautan tidak berlaku. Tautan milik Member nonaktif yang juga sudah dipakai, sudah diganti tautan baru, atau kedaluwarsa tetap menampilkan pesan Member nonaktif beserta tombol WhatsApp, bukan pesan alasan lain dengan tombol "Minta tautan baru". Lupa password tidak mengirim tautan ke Member nonaktif, jadi tombol itu tidak berguna baginya.

### 7.6 Dasbor Member

- Dasbor Member berisi Riwayat Pesanan, dengan Item stok yang bisa dibuka dan disalin; profil untuk mengganti password; dan tombol keluar.
- Email Member tidak bisa diganti, karena email itulah yang menautkan Pesanan.
- Tidak ada fitur hapus akun.

▶ Keputusan 2026-11-17 (#128): Ganti password di profil
- Member mengisi password lama dan password baru. Password baru minimal 8 karakter (§7.5).
- Bila password lama salah, password tidak diganti, dan Member melihat "Password lama salah, jadi password tidak diganti."
- Setelah password diganti, Member keluar di semua perangkat lain dan tetap masuk di perangkat yang sedang dipakai.
- Letak profil dan Riwayat Pesanan di navigasi toko diatur di §11.1.

▶ Keputusan 2026-11-17 (#174): Ganti password di profil
- Setelah password diganti, sesi di perangkat yang sedang dipakai tetap sesi yang sama. Batas 30 harinya tetap dihitung sejak login semula, tidak dimulai ulang (§7.5).
- Pesan isian: "Password lama belum diisi. Ketik password yang Anda pakai sekarang.", "Password baru belum diisi. Buat password baru dengan minimal 8 karakter.", dan "Password baru kurang dari 8 karakter. Buat password baru dengan minimal 8 karakter."
- Password lama yang salah dibatasi seperti login (§7.7), tetapi hitungannya terpisah dari hitungan salah password login:
  - bila password lama salah 5 kali berturut-turut, ganti password untuk Member itu dikunci 15 menit sejak kesalahan kelima, walaupun password lamanya kemudian benar;
  - pesannya: "Password lama salah 5 kali berturut-turut, jadi ganti password dikunci 15 menit. Coba lagi mulai pukul HH.MM WIB." Jamnya dibulatkan ke atas ke menit berikutnya, seperti pesan kunci login;
  - ganti password yang berhasil mengembalikan hitungan ke 0, dan setelah 15 menit hitungan juga mulai lagi dari 0;
  - kunci ini tidak memengaruhi login. Member tetap bisa login dan tetap masuk di perangkat yang sedang dipakai.
- Contoh: Member salah memasukkan password lama untuk kelima kalinya pukul 10.00. Pukul 10.14 ganti password ditolak dengan pesan kunci walaupun password lamanya benar. Pukul 10.15 ganti password dengan password lama yang benar berhasil. Contoh lengkapnya ada di `tests/golden/batas-ganti-password.json`.

▶ Keputusan 2026-11-18 (#186): Kesalahan password lama yang kelima langsung menampilkan pesan kunci 15 menit, bukan "Password lama salah, jadi password tidak diganti.", sama seperti pesan kunci login yang tampil sejak kesalahan kelima (§7.7).

### 7.7 Keamanan Kode verifikasi dan login

- Kode verifikasi baru boleh diminta paling cepat 60 detik setelah kode sebelumnya dikirim. Contoh: kode dikirim pukul 10.00.00. Permintaan pukul 10.00.59 ditolak, dan permintaan pukul 10.01.00 diterima.
- Kode verifikasi hangus setelah 5 kali salah dimasukkan. Pendaftar lalu harus meminta kode baru.
- Bila password salah 5 kali berturut-turut untuk satu email, email itu tidak bisa login selama 15 menit sejak kesalahan kelima. Login yang berhasil mengembalikan hitungan kesalahan ke 0. Setelah 15 menit itu lewat, hitungan kesalahan juga mulai lagi dari 0.
- Contoh: kesalahan kelima terjadi pukul 10.00. Login pukul 10.14 ditolak walaupun password-nya benar. Login pukul 10.15 dengan password benar diterima.
- Aturan login ini berlaku untuk Member dan Admin.

▶ Keputusan 2026-11-11 (#53):
- Sejak kesalahan kelima, halaman login langsung menampilkan pesan kunci, bukan pesan password salah.
- Teks pesan kunci: "Password salah 5 kali berturut-turut, jadi login dengan email ini dikunci 15 menit. Coba masuk lagi mulai pukul HH.MM WIB." Pesan yang sama tampil di setiap percobaan selama kunci berlaku.
- Jam coba lagi dibulatkan ke atas ke menit berikutnya, supaya jam yang tampil tidak pernah lebih awal dari saat login boleh dicoba lagi. Contoh: kunci berakhir pukul 10.15.30, dan pesannya menulis "10.16".

▶ Keputusan 2026-11-17 (#174): Member nonaktif yang memasukkan password benar tidak mengubah hitungan salah login: hitungannya tidak naik dan tidak kembali ke 0. Hanya login yang berhasil dan berakhirnya kunci yang mengembalikan hitungan ke 0.

## 8. Voucher

### 8.1 Voucher

- Voucher adalah kode yang diketik Pembeli di form checkout untuk mendapat potongan voucher.
- Setiap Pesanan memakai paling banyak satu Voucher, dan Voucher tidak bisa digabung.
- Kode Voucher tidak membedakan huruf besar dan kecil. Contoh: `hemat10` sama dengan `HEMAT10`.
- Tidak ada daftar Voucher di dasbor Member.

### 8.2 Jenis potongan

Admin memilih satu jenis potongan untuk setiap Voucher:
- **Nominal tetap**, misalnya Rp 5.000.
- **Persen**, misalnya 10%, dengan batas maksimum yang opsional. Hasil persen dibulatkan ke bawah ke rupiah.

### 8.3 Menghitung potongan voucher

1. Potongan dasar:
   - jenis nominal tetap: nilai nominalnya;
   - jenis persen: Harga jual × persen ÷ 100, dibulatkan ke bawah ke rupiah. Bila ada batas maksimum, diambil yang lebih kecil antara hasil itu dan batas maksimum.
2. Potongan voucher = yang lebih kecil antara potongan dasar dan (Harga jual − Rp 1.000). Dengan begitu, Harga jual dikurangi potongan voucher tidak pernah kurang dari Rp 1.000, dan tidak ada Pesanan gratis.

Varian dengan Harga jual tepat Rp 1.000 mendapat potongan voucher Rp 0. Apakah Voucher dalam keadaan itu ditolak atau tetap tercatat dipakai belum diputuskan (OD-3).

▶ Keputusan 2026-11-17 (#128): Voucher yang potongan vouchernya Rp 0 ditolak dengan pesan "Voucher tidak memberi potongan untuk produk ini", dan tidak tercatat di Pesanan. (Sebelumnya OD-3.)
- Keadaan ini hanya terjadi pada Varian dengan Harga jual tepat Rp 1.000, karena nominal tetap, persen, dan batas maksimum selalu minimal Rp 1 atau 1% (§8.4).
- Pesan ini paling bawah dalam urutan §8.7. Bila ada syarat lain yang tidak terpenuhi, pesan syarat itulah yang tampil.
- Contoh: `HEMAT5` untuk Varian Rp 1.000 ditolak dengan "Voucher tidak memberi potongan untuk produk ini". `HEMAT10`, yang mensyaratkan minimal Harga jual Rp 50.000, untuk Varian yang sama ditolak dengan "Minimal pembelian Rp 50.000". Contoh lengkapnya ada di `tests/golden/penerapan-voucher.json`.

Contoh:

| Harga jual | Voucher | Potongan voucher | Harga jual − potongan |
|---|---|---|---|
| Rp 50.000 | Nominal Rp 5.000 | Rp 5.000 | Rp 45.000 |
| Rp 135.000 | 10%, maksimal Rp 10.000 | Rp 10.000 (10% = Rp 13.500) | Rp 125.000 |
| Rp 33.333 | 15%, tanpa batas | Rp 4.999 (15% = Rp 4.999,95) | Rp 28.334 |
| Rp 30.000 | Nominal Rp 50.000 | Rp 29.000 (dipangkas) | Rp 1.000 |

### 8.4 Syarat voucher

Setiap syarat berikut opsional dan diatur Admin per Voucher:
- **masa berlaku**: waktu mulai dan waktu berakhir, diisi sampai menit dalam zona waktu toko (§9.1). Voucher berlaku bila waktu checkout tidak lebih awal dari waktu mulai dan tidak melewati menit berakhir. Contoh: waktu berakhir 30 November 23.59. Checkout pukul 23.59.40 diterima, dan checkout 1 Desember 00.00.00 ditolak;
- **Kuota voucher**: berapa kali Voucher boleh dipakai oleh semua Pembeli;
- **Batas per email**: berapa kali Voucher boleh dipakai oleh satu email. Nilai bawaannya 1;
- **minimal Harga jual**;
- **cakupan**: berlaku untuk semua Produk, atau hanya untuk Produk atau Kategori tertentu;
- **khusus Member**: Pembeli harus login sebagai Member untuk memakainya.

Syarat diperiksa saat Pesanan dibuat.

▶ Keputusan 2026-11-17 (#128): Isian Voucher di dasbor admin
- **Kode:** hanya huruf A–Z dan angka 0–9, 3 sampai 20 karakter. Spasi di awal dan akhir dibuang, lalu kode disimpan dalam huruf besar. Kode harus unik tanpa membedakan huruf besar dan kecil. Contoh: bila sudah ada `HEMAT5`, Voucher baru `hemat5` ditolak. Kode tidak bisa diubah setelah Voucher dibuat.
- **Nominal tetap** dan **batas maksimum:** rupiah bulat, minimal Rp 1.
- **Persen:** bilangan bulat 1 sampai 100.
- **Kuota voucher** dan **Batas per email:** bilangan bulat minimal 1. Isian kosong berarti tanpa batas. Saat form Voucher baru dibuka, Batas per email sudah terisi 1.
- **Minimal Harga jual:** rupiah bulat minimal Rp 1, atau kosong.
- **Masa berlaku:** waktu mulai dan waktu berakhir boleh diisi salah satu, keduanya, atau tidak sama sekali. Bila keduanya diisi, waktu berakhir harus setelah waktu mulai.
- **Cakupan:** semua Produk, satu Produk atau lebih, atau satu Kategori atau lebih. Produk dan Kategori tidak dicampur dalam satu Voucher. Cakupan Kategori memakai Kategori Produk pada saat checkout.
- Contoh lengkapnya ada di `tests/golden/kode-voucher.json` dan `tests/golden/isian-voucher.json`.

▶ Keputusan 2026-11-17 (#174):
- Form Voucher baru dibuka dengan jenis potongan "Nominal tetap" terpilih, status Aktif tercentang, dan Batas per email 1.
- Bila semua Produk atau Kategori dalam cakupan sebuah Voucher sudah dihapus, Voucher tetap bercakupan Produk atau Kategori dengan daftar kosong. Voucher itu tidak berlaku untuk Produk apa pun, dan tidak berubah menjadi berlaku untuk semua Produk. Form ubah Voucher meminta Admin memilih lagi atau memilih semua Produk.
- Di Checkout, spasi di awal dan akhir kode voucher dibuang sebelum dicocokkan. Email yang hanya berisi spasi dianggap kosong, jadi Batas per email belum diperiksa (§8.7).

### 8.5 Menghitung pemakaian

- Pemakaian Voucher dihitung dari Pesanan berstatus Menunggu Pembayaran, Selesai, atau Bermasalah yang memakai Voucher itu.
- Pesanan Kedaluwarsa, Dibatalkan, dan Dana Dikembalikan tidak dihitung, sehingga kuotanya kembali.
- Kuota voucher dan Batas per email sama-sama memakai hitungan ini. Batas per email menghitung Pesanan dengan email yang sama menurut §7.4.
- Contoh: Kuota voucher tersisa 1, dan Pesanan Andi yang memakai Voucher itu sedang Menunggu Pembayaran. Budi ditolak dengan pesan "Kuota voucher habis". Bila Pesanan Andi menjadi Kedaluwarsa, Budi bisa memakai Voucher itu.

▶ Keputusan 2026-11-17 (#174): Bila Member sedang login, Batas per email dihitung dengan email Member dari sesinya, karena email Pesanan Member memang email akunnya (§5.2).

### 8.6 Pembayaran telat dan voucher

Bila Pesanan yang sudah Kedaluwarsa atau Dibatalkan ternyata tetap dibayar (§5.9), potongan voucher tetap berlaku, karena Pembeli sudah membayar harga setelah potongan. Akibatnya pemakaian Voucher bisa melebihi Kuota voucher.

### 8.7 Pesan penolakan

Bila Voucher ditolak, Pembeli melihat alasannya:
- "Kode voucher tidak ditemukan" (termasuk Voucher yang dinonaktifkan);
- "Voucher belum berlaku" atau "Voucher sudah berakhir";
- "Kuota voucher habis";
- "Anda sudah memakai voucher ini";
- "Minimal pembelian Rp X";
- "Voucher tidak berlaku untuk produk ini";
- "Voucher khusus Member, silakan login".

Bila lebih dari satu syarat tidak terpenuhi, yang tampil adalah pesan yang paling atas dalam daftar ini.

▶ Keputusan 2026-11-17 (#128): Voucher di Checkout
- Pesan "Voucher tidak memberi potongan untuk produk ini" (§8.3) berada di urutan paling bawah daftar di atas.
- Tombol "Pakai" di samping isian kode voucher langsung memeriksa kode itu.
  - Bila diterima, tampil "<KODE> dipakai: potongan Rp X", misalnya "HEMAT5 dipakai: potongan Rp 5.000", dan Perkiraan bayar dihitung ulang.
  - Bila ditolak, tampil pesan penolakannya.
  - Batas per email baru diperiksa bila email sudah diisi. Bila email masih kosong saat "Pakai" ditekan, syarat itu diperiksa saat Pesanan dibuat.
- Saat Pesanan dibuat, semua syarat diperiksa sekali lagi (§8.4), termasuk kode yang diisi tanpa menekan "Pakai".
  - Bila Voucher ditolak saat itu, Pesanan tidak dibuat, pesan penolakannya tampil, dan isian kode tetap berisi. Pembeli bisa menghapus kode, lalu membayar tanpa Voucher.
  - Pesanan tidak pernah dibuat tanpa Voucher bila Pembeli mengisi kode.
  - Contoh: Pembeli menekan "Pakai" untuk `SATUKALI`, dan Voucher diterima. Sebelum ia menekan "Bayar dengan QRIS", Pembeli lain memakai kuota terakhirnya. Pesanan tidak dibuat, dan Pembeli melihat "Kuota voucher habis".
- Pesan "Voucher khusus Member, silakan login" punya tautan Masuk. Setelah login, Member kembali ke Checkout Varian yang sama.

▶ Keputusan 2026-11-17 (#174):
- Hasil "Pakai" hanya berlaku untuk kode yang diperiksa. Begitu isian kode diubah, hasil itu hilang, dan rincian kembali tanpa potongan sampai "Pakai" ditekan lagi.
- Setelah login lewat tautan Masuk dari pesan "Voucher khusus Member, silakan login", Member kembali ke Checkout Varian yang sama dengan isian kode voucher sudah berisi kode yang tadi diketik. Member lalu menekan "Pakai" atau langsung membayar.
- Contoh: Tamu mengetik `member20` di Checkout Netflix Premium 1 Bulan dan menekan "Pakai". Ia mengetuk tautan Masuk, lalu login. Ia kembali ke Checkout Netflix Premium 1 Bulan dengan isian kode berisi `MEMBER20`.

▶ Keputusan 2026-11-18 (#186): Kode yang terisi setelah login ditulis dalam huruf kapital tanpa spasi di awal atau akhir (kode tidak membedakan huruf besar dan kecil, §8.1), bukan persis seperti yang diketik. Contoh: `member20` terisi sebagai `MEMBER20`.

### 8.8 Kelola voucher

- Admin bisa membuat, mengubah, menonaktifkan, dan mengaktifkan kembali Voucher.
- Admin melihat jumlah pemakaian setiap Voucher menurut §8.5.
- Voucher yang pernah tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan, tidak bisa dihapus, hanya dinonaktifkan.
- Mengubah syarat Voucher tidak mengubah Pesanan yang sudah dibuat.

▶ Keputusan 2026-11-17 (#128):
- Daftar Voucher di dasbor admin menampilkan kode, potongan, masa berlaku, pemakaian, dan status Aktif atau Nonaktif, dengan Voucher terbaru di atas.
  - Potongan ditulis seperti "Rp 5.000", "10%", atau "10%, maks Rp 10.000".
  - Pemakaian dihitung menurut §8.5. Bila Voucher punya Kuota voucher, pemakaian ditulis "3 dari 10". Bila tidak, cukup "3".
- Pesanan yang memakai Voucher mencatat kode Voucher-nya. Di setiap rincian nominal (§5.5), baris potongannya ditulis "Potongan voucher (HEMAT5)": di Checkout, Halaman bayar, Halaman Pesanan, email "Pesanan selesai", dan detail Pesanan di dasbor admin. Pesanan tanpa Voucher tetap menulis "Potongan voucher".

▶ Keputusan 2026-11-17 (#174):
- Masa berlaku di daftar Voucher ditulis dengan tanggal dan jam WIB: "1 Des 2026 00.00 – 31 Des 2026 23.59", "Mulai 1 Des 2026 00.00", "Sampai 30 Nov 2026 23.59", atau "Tanpa batas waktu".
- Voucher dihapus dari panel "Hapus Voucher" di bawah halaman ubah Voucher, dengan penegasan di tempat. Panel ini selalu tampil, juga untuk Voucher yang sudah pernah dipakai, lalu server menolak penghapusannya dengan pesan yang menyarankan menonaktifkan. Baris daftar Voucher tidak punya tombol hapus.

## 9. Dasbor admin

### 9.1 Zona waktu toko

- Zona waktu toko adalah WIB (UTC+7). Semua tanggal dan jam di toko, email, dan dasbor admin memakai zona ini.
- "Hari ini" berarti pukul 00.00.00 sampai 23.59.59 WIB tanggal berjalan. "Bulan ini" berarti sejak tanggal 1 pukul 00.00.00 WIB sampai sekarang.

### 9.2 Ringkasan

Halaman depan dasbor admin menampilkan kartu angka:
- Pendapatan hari ini dan bulan ini (§9.3);
- jumlah Pesanan Selesai hari ini dan bulan ini;
- jumlah Member aktif;
- jumlah Pesanan Bermasalah, ditampilkan menonjol karena perlu tindakan;
- jumlah Varian yang stoknya menipis (§9.4).

Ringkasan hanya berupa angka, tanpa grafik.

▶ Keputusan 2026-11-17 (#128):
- Pesanan Selesai hari ini dan bulan ini dihitung menurut waktu pembayaran, sama seperti Pendapatan (§9.3). Pesanan Bermasalah yang kemudian diselesaikan Admin dihitung pada tanggal pembayarannya. Contohnya ada di `tests/golden/jumlah-pesanan-selesai.json`.
- Member aktif mengikuti §2.3 (▶ Keputusan 2026-11-17).
- Kartu Pesanan Bermasalah membuka daftar Pesanan yang sudah disaring ke status Bermasalah (§9.5).
- Daftar Stok menipis (§9.4) tampil di halaman Ringkasan, di bawah kartu angka.

▶ Keputusan 2026-11-17 (#174):
- Urutan kartu: Pendapatan, Pesanan Selesai, Member aktif, Pesanan Bermasalah, lalu Varian stok menipis.
- Kartu Pendapatan, Pesanan Selesai, dan Member aktif masing-masing punya satu kalimat keterangan tentang cara hitungnya. Contoh kartu Member aktif: "Member yang sudah diverifikasi dan tidak nonaktif, sama dengan Member berstatus Aktif di daftar Member. Pendaftar tidak dihitung."
- Kartu Pesanan Bermasalah ditonjolkan dengan warna status Bermasalah, ikon peringatan, dan teks "Perlu tindakan. Buka daftar Pesanan Bermasalah".

▶ Keputusan 2026-11-20 (#204): Kartu Ringkasan diperluas. Keputusan ini menggantikan daftar dan urutan kartu di atas, sedangkan aturan "Ringkasan hanya berupa angka, tanpa grafik" tetap berlaku. Grafik ada di Laporan keuangan (§14.6).
- Urutan kartu dan isinya:
  1. **Pendapatan:** hari ini, bulan ini, dan sepanjang waktu (§9.3).
  2. **Total Harga modal:** hari ini, bulan ini, dan sepanjang waktu (§14.2).
  3. **Laba kotor:** hari ini, bulan ini, dan sepanjang waktu (§14.2).
  4. **Laba bersih:** hari ini, bulan ini, dan sepanjang waktu (§14.5). Biaya operasional yang dikurangkan adalah biaya bertanggal hari ini, bulan ini, atau semua biaya.
  5. **Pesanan Selesai:** hari ini, bulan ini, dan sepanjang waktu, menurut waktu pembayaran.
  6. **Pesanan Menunggu Pembayaran:** jumlah Pesanan yang berstatus Menunggu Pembayaran saat Ringkasan dibuka.
  7. **Pesanan Bermasalah:** jumlah saat ini, tetap ditonjolkan seperti di atas.
  8. **Member aktif:** jumlah Member aktif, dengan keterangan "dari N Member terdaftar". Member terdaftar adalah semua Member, aktif maupun nonaktif, tanpa Pendaftar (§7.2).
  9. **Item stok Tersedia:** jumlah Item stok Tersedia di Varian aktif dari Produk aktif, yaitu Item stok yang bisa dibeli sekarang. Item stok Ditahan tidak dihitung. Item stok di Varian atau Produk nonaktif tidak dihitung, tetapi tetap terlihat di menu Item stok (§4.2).
  10. **Item stok Terkirim:** jumlah semua Item stok Terkirim sepanjang waktu.
  11. **Varian stok menipis** (§9.4).
- "Sepanjang waktu" berarti semua Pesanan sejak toko dibuka, tanpa batas tanggal.
- Kartu 2 sampai 4 hanya menghitung Pesanan yang punya Harga modal (§14.2). Bila ada Pesanan Selesai tanpa Harga modal dalam rentang itu, kartu menampilkan "N Pesanan Selesai belum dihitung labanya, karena Harga modal Varian-nya belum diisi."
- Setiap kartu bisa diketuk:
  - kartu 1 sampai 4 membuka Laporan keuangan;
  - kartu 5 dan 6 membuka daftar Pesanan yang sudah disaring ke status Selesai atau Menunggu Pembayaran;
  - kartu 7 tetap membuka daftar Pesanan Bermasalah;
  - kartu 8 membuka daftar Member;
  - kartu 9 dan 10 membuka menu Item stok (§4.2);
  - kartu 11 tetap seperti sekarang.
- Contoh hitungan kartu uang ada di `tests/golden/laba.json`.

▶ Keputusan 2026-11-20 (#224):
- Seperti kartu lama (▶ Keputusan 2026-11-17, #174), setiap kartu baru punya satu kalimat keterangan tentang cara hitungnya, yang diambil dari teks PRD. Contoh kartu Item stok Tersedia: "Item stok yang bisa dibeli sekarang, di Varian aktif dari Produk aktif. Item stok Ditahan tidak dihitung."
- Peringatan Pesanan tanpa Harga modal tampil satu kali untuk kartu 2 sampai 4. Letaknya diatur `docs/DESIGN.md`.

▶ Keputusan 2026-11-20 (#226): Dua kartu saldo dipasang tepat setelah kartu Member aktif, sehingga Ringkasan berisi 13 kartu. Urutan dan aturan kartu lain tidak berubah.
- Kartu baru:
  - **Total saldo Member:** jumlah saldo semua Member saat ini, aktif maupun nonaktif (§15.1). Keterangannya: "Saldo milik Member yang belum dibelanjakan. Ini uang Member, bukan Pendapatan." Kartu ini membuka daftar Member.
  - **Top up Bermasalah:** jumlah Top up Bermasalah saat ini (§15.4). Kartu ini ditonjolkan seperti kartu Pesanan Bermasalah dan membuka menu Top up yang sudah disaring ke status Bermasalah (§15.9).
- Urutan lengkapnya:
  1. Pendapatan
  2. Total Harga modal
  3. Laba kotor
  4. Laba bersih
  5. Pesanan Selesai
  6. Pesanan Menunggu Pembayaran
  7. Pesanan Bermasalah
  8. Member aktif
  9. Total saldo Member
  10. Top up Bermasalah
  11. Item stok Tersedia
  12. Item stok Terkirim
  13. Varian stok menipis
- Kartu Laba bersih ikut menghitung Kode unik Top up dan Biaya transaksi Top up (§15.8).

### 9.3 Pendapatan

- Pendapatan adalah jumlah Total bayar dari Pesanan Selesai, dikelompokkan menurut waktu pembayarannya.
- Kode unik ikut dihitung. Biaya Qrispy tidak dipotong.
- Pesanan Bermasalah dan Dana Dikembalikan tidak dihitung. Pesanan Bermasalah yang kemudian diselesaikan Admin dihitung pada tanggal pembayarannya.
- Contoh: hari ini ada Pesanan Selesai dengan Total bayar Rp 45.123, Rp 50.010, dan Rp 135.499, ditambah satu Pesanan Bermasalah Rp 50.200. Pendapatan hari ini Rp 45.123 + Rp 50.010 + Rp 135.499 = Rp 230.632.

### 9.4 Stok menipis

- Varian aktif dari Produk aktif yang Stok Varian-nya sama dengan atau kurang dari Ambang stok menipis masuk daftar "Stok menipis" di dasbor admin.
- Ambang stok menipis diatur di pengaturan toko, dengan nilai awal 5.
- Contoh dengan ambang 5: Varian dengan Stok Varian 5 atau 0 masuk daftar. Varian dengan Stok Varian 6 tidak masuk.
- Tidak ada email peringatan ke Admin.

▶ Keputusan 2026-11-17 (#128):
- Daftar Stok menipis menampilkan nama Produk, nama Varian, dan Stok Varian, dengan Stok Varian terkecil di atas. Setiap baris membuka halaman Varian di dasbor admin (§9.7).
- Bila tidak ada Varian yang menipis, daftar itu berbunyi "Tidak ada Varian yang stoknya menipis."
- Ambang stok menipis berupa bilangan bulat 0 sampai 999. Isian di luar itu ditolak dengan pesan. Contohnya ada di `tests/golden/ambang-stok-menipis.json`.

### 9.5 Daftar dan detail Pesanan

- Daftar Pesanan menampilkan Nomor Pesanan, waktu dibuat, email, Produk dan Varian, Total bayar, status, dan tanda "Email gagal" bila ada.
- Admin bisa menyaring menurut status dan rentang tanggal, serta mencari menurut email atau Nomor Pesanan.
- Detail Pesanan menampilkan rincian nominal (§5.5), Item stok, dan riwayat perubahan status.
- Aksi di detail Pesanan: kirim ulang email dan koreksi email (§6.4), serta menyelesaikan Pesanan Bermasalah (§5.9).

▶ Keputusan 2026-11-12 (#87):
- Saringan rentang tanggal memakai waktu Pesanan dibuat, yaitu waktu yang tampil di daftar.
- Pencarian boleh berisi sebagian email atau sebagian Nomor Pesanan, tanpa membedakan huruf besar dan kecil. Contoh: "budi" dan "BUDI" menemukan Pesanan `budi@mail.com`. Nomor Pesanan lengkap tetap menemukan tepat Pesanan itu.

▶ Keputusan 2026-11-20 (#204): Rincian nominal di detail Pesanan dasbor admin mendapat baris tambahan, sesudah rincian §5.5:
- **Harga modal**, yaitu Harga modal yang tercatat di Pesanan (§14.1). Bila belum ada, baris ini menampilkan "—" beserta keterangan "Harga modal Varian ini belum diisi".
- **Laba kotor** Pesanan itu (§14.2), atau "—" bila Harga modal belum ada.
- **Biaya transaksi** (§14.3). Baris ini hanya tampil bila Pesanan sudah dibayar.

Baris tambahan ini hanya ada di dasbor admin. Pembeli tidak pernah melihat Harga modal, laba, maupun Biaya transaksi.

▶ Keputusan 2026-11-20 (#226): Detail Pesanan dasbor admin menampilkan Metode, yaitu QRIS atau Saldo. Rincian nominal Pesanan yang dibayar dengan saldo mengikuti §15.7: tanpa baris Kode unik, diikuti "Dibayar dengan saldo", dengan Biaya transaksi Rp 0.

### 9.6 Nomor Pesanan

- Nomor Pesanan berbentuk `MIWE-` diikuti 6 karakter acak, misalnya `MIWE-7K3P9Q`.
- Karakter acaknya huruf besar dan angka, tanpa karakter yang mirip: O, 0, I, dan 1.
- Nomor Pesanan tidak berurutan, supaya orang luar tidak bisa menebak jumlah penjualan.

### 9.7 Daftar Item stok

- Halaman Varian di dasbor admin menampilkan semua Item stok Varian itu beserta statusnya:
  - Tersedia;
  - Ditahan, dengan Nomor Pesanan yang menahannya;
  - Terkirim, dengan Nomor Pesanan penerimanya.
- Admin bisa menyaring menurut status dan melihat isi lengkap setiap Item stok.

### 9.8 Pengaturan toko

- Admin bisa mengubah nomor WhatsApp untuk tombol kontak, Ambang stok menipis, teks halaman Syarat & Ketentuan, dan teks halaman Kebijakan Privasi.
- Halaman Syarat & Ketentuan dan Kebijakan Privasi ditautkan di footer toko.
- Nama toko dan logo ditetapkan di kode dan desain, bukan di pengaturan.

▶ Keputusan 2026-11-11 (#53): Admin boleh menulis nomor WhatsApp dalam bentuk yang biasa dipakai di Indonesia, lalu toko merapikannya sebelum menyimpan. Nomor toko dianggap selalu nomor Indonesia.
- Toko membuang spasi, tanda hubung, dan tanda `+`, lalu mengganti angka 0 di depan dengan 62.
- Hasilnya harus berupa angka saja, diawali 62, dan paling banyak 15 angka. Bila tidak, isian ditolak dengan pesan yang menyebut sebabnya.
- Contoh: `0812-3456-7890`, `+62 812 3456 7890`, dan `6281234567890` semuanya disimpan sebagai `6281234567890`, dan tombol WhatsApp membuka `https://wa.me/6281234567890`.
- Isian yang dikosongkan berarti nomor belum diisi, dan tombol WhatsApp tidak tampil.
- Contoh lengkapnya ada di `tests/golden/nomor-whatsapp.json`.

▶ Keputusan 2026-11-20 (#204): Pengaturan toko juga memuat dua isian Biaya transaksi: persen biaya transaksi dan minimal Total bayar yang dikenai biaya. Aturan dan nilai awalnya ada di §14.3.

### 9.9 Yang tidak dibuat di dasbor admin

Log aktivitas Admin, ekspor CSV, dan notifikasi email ke Admin.

## 10. Email

### 10.1 Layanan dan pengirim

- Email dikirim lewat Resend. Toko mulai di paket gratis, yang dibatasi 100 email per hari dan 3.000 per bulan. Pemilik menaikkan ke paket berbayar bila rata-rata email harian sudah di atas sekitar 80.
- Email dikirim dari domain toko yang sudah diverifikasi di Resend. Pengirimnya tampil sebagai `MIWE Digital Store <no-reply@domain-toko>`. Nama domainnya masih keputusan terbuka (OD-1).
- Email tidak bisa dibalas.

▶ Keputusan 2026-11-15 (#115): Domain toko adalah `akun.miwedigital.store`, dan domain ini sudah terverifikasi di Resend. Email dikirim dari `MIWE Digital Store <no-reply@akun.miwedigital.store>`.

### 10.2 Jenis email

Toko hanya mengirim tiga jenis email, semuanya berbahasa Indonesia:

| Email | Dikirim saat | Isi |
|---|---|---|
| Pesanan selesai | Pesanan menjadi Selesai, atau dikirim ulang Admin | Sesuai §6.3 |
| Kode verifikasi | Pendaftar membuat password atau meminta kode baru | Kode verifikasi dan masa berlakunya (§7.3) |
| Atur ulang password | Member meminta atur ulang password | Tautan atur ulang dan masa berlakunya (§7.5) |

- Setiap email punya footer "Butuh bantuan? Hubungi kami di WhatsApp" dengan nomor dari pengaturan toko (§9.8).
- Toko tidak mengirim email lain, misalnya pengingat pembayaran atau notifikasi ke Admin.

▶ Keputusan 2026-11-12 (#87): Selama nomor WhatsApp belum diisi di pengaturan toko, footer WhatsApp tidak ditampilkan, sama seperti tombol WhatsApp di toko (§9.8). Bila nomor sudah diisi, footer berbunyi "Butuh bantuan? Hubungi kami di WhatsApp +62…", dengan nomor yang menaut ke WhatsApp.

▶ Keputusan 2026-11-17 (#128): Isi dua email Member
- **Kode verifikasi.** Subjeknya "Kode verifikasi: <kode>", misalnya "Kode verifikasi: 482913". Isinya kalimat "Masukkan kode ini untuk menyelesaikan pendaftaran Member MIWE Digital Store. Kode berlaku 10 menit. Abaikan email ini bila Anda tidak mendaftar." beserta kodenya.
- **Atur ulang password.** Subjeknya "Atur ulang password". Isinya kalimat "Buka tautan berikut untuk membuat password baru. Tautan berlaku 30 menit dan hanya bisa dipakai sekali. Abaikan email ini bila Anda tidak memintanya, password Anda tidak berubah." beserta tautannya.
- Keduanya memakai footer WhatsApp yang sama dengan email "Pesanan selesai".

## 11. Tampilan

### 11.1 Responsif dan navigasi

- Toko bisa dipakai dengan nyaman di layar ponsel selebar 360 piksel sampai layar desktop, tanpa gulir ke samping.
- Di layar ponsel, toko punya navigasi bawah dengan 4 tab:

  | Tab | Isi |
  |---|---|
  | Beranda | Beranda toko (§3.6) |
  | Kategori | Daftar Kategori |
  | Riwayat | Riwayat Pesanan untuk Member. Tamu melihat ajakan login dan penjelasan bahwa Tautan Pesanan ada di email mereka |
  | Akun | Login atau Daftar untuk Tamu, dasbor Member untuk Member |

- Di layar lebar, isi yang sama tampil sebagai navbar atas, dan navigasi bawah tidak tampil.
- Dasbor admin memakai menu samping di layar lebar dan menu lipat di ponsel, tanpa navigasi bawah.

▶ Keputusan 2026-11-20 (#204): Urutan menu samping dasbor admin: Ringkasan, Laporan keuangan (§14.6), Pesanan, Member, Kategori, Produk, Item stok (§4.2), Voucher, lalu Pengaturan toko. Halaman Biaya operasional (§14.4) dibuka dari Laporan keuangan dan tidak punya menu sendiri.

▶ Keputusan 2026-11-20 (#226): Menu samping dasbor admin mendapat menu "Top up" (§15.9), tepat di bawah Member. Urutannya menjadi: Ringkasan, Laporan keuangan, Pesanan, Member, Top up, Kategori, Produk, Item stok, Voucher, lalu Pengaturan toko. Tab Akun untuk Member mendapat kotak saldo di bawah email Member dan di atas form ganti password (§15.10).

▶ Keputusan 2026-11-11: Sebelum M2, keempat tab sudah tampil dengan isi berikut.
- **Riwayat:** penjelasan bahwa Tautan Pesanan ada di email "Pesanan selesai", tanpa ajakan login.
- **Akun:** tombol kontak WhatsApp, serta tautan ke halaman Syarat & Ketentuan dan Kebijakan Privasi.
- Bilah atas belum punya tombol Masuk.

Login, Daftar, dan dasbor Member ditambahkan di M2 sesuai tabel di atas.

▶ Keputusan 2026-11-11 (#53):
- Tab Riwayat untuk Tamu berjudul "Riwayat Pesanan" dan berisi kalimat: "Setiap Pesanan Selesai punya Tautan Pesanan di email "Pesanan selesai". Buka tautan itu untuk melihat dan menyalin Item stok tanpa login."
- Tab Kategori berisi daftar Kategori. Setiap Kategori membuka Beranda yang sudah disaring menurut Kategori itu, bukan halaman Kategori tersendiri.

▶ Keputusan 2026-11-17 (#128): Bilah atas dan tab di M2
- **Bilah atas:** Tamu melihat tombol "Masuk". Member tidak punya nama, jadi Member melihat bagian emailnya sebelum "@". Bila bagian itu lebih dari 12 karakter, yang tampil adalah 12 karakter pertamanya diikuti "…". Contoh: `budi@mail.com` tampil "budi", dan `budisantoso2026@mail.com` tampil "budisantoso2…" (`tests/golden/label-member.json`). Tombol itu membuka tab Akun.
- **Tab Akun untuk Tamu:** tombol "Masuk" dan "Daftar", lalu tombol WhatsApp serta tautan Syarat & Ketentuan dan Kebijakan Privasi.
- **Tab Akun untuk Member:** email Member, form ganti password (§7.6), tombol "Keluar", lalu tombol WhatsApp serta tautan yang sama.
- **Tab Riwayat:** Tamu melihat ajakan login beserta penjelasan Tautan Pesanan. Member melihat Riwayat Pesanan (§7.4). Riwayat Pesanan hanya ada di tab Riwayat dan tidak diulang di tab Akun.

▶ Keputusan 2026-11-20: Tautan hukum di tab Akun. Isi tab Akun tidak lagi memuat tautan Syarat & Ketentuan dan Kebijakan Privasi sendiri, karena footer toko sudah menampilkan kedua tautan itu tepat di bawahnya (§9.8), sehingga sebelumnya keduanya tampil dua kali. Tab Akun untuk Tamu berisi tombol "Masuk" dan "Daftar", bagian "Tampilan", lalu tombol WhatsApp. Tab Akun untuk Member berisi email Member, form ganti password, tombol "Keluar", bagian "Tampilan", lalu tombol WhatsApp. Kedua tautan hukum tetap terlihat di tab Akun lewat footer.

### 11.2 Animasi navbar

- Navbar atas mengecil dan mendapat bayangan saat halaman digulir.
- Penanda tab aktif di navigasi bawah bergeser halus saat tab berpindah.
- Navigasi bawah bersembunyi saat halaman digulir ke bawah, dan muncul lagi saat digulir ke atas.
- Semua animasi dimatikan bila perangkat pengguna menyalakan pengaturan "kurangi gerakan".

### 11.3 Mode gelap

- Tampilan mengikuti mode terang atau gelap di perangkat.
- Tab Akun punya tombol untuk mengganti mode. Pilihan itu diingat di perangkat tersebut dan mengalahkan pengaturan perangkat.

▶ Keputusan 2026-11-18 (#188): Pilihan mode
- Tab Akun punya bagian "Tampilan" berisi tiga pilihan: Perangkat, Terang, dan Gelap. Di bawahnya tertulis "Pilihan ini hanya diingat di perangkat ini." Pilihan awalnya Perangkat.
- Bagian itu terletak setelah tombol "Masuk" dan "Daftar" untuk Tamu, atau setelah tombol "Keluar" untuk Member, dan sebelum tombol WhatsApp. Tamu dan Member sama-sama melihatnya.
- Pilihan itu juga berlaku di dasbor admin bila dibuka di browser yang sama. Dasbor admin tidak punya tombol mode sendiri.

### 11.4 Pasang seperti aplikasi

- Pembeli bisa memasang toko lewat "Tambahkan ke layar utama". Setelah dipasang, toko terbuka dengan ikon dan layar pembuka sendiri, tanpa bilah alamat browser.
- Toko tidak bisa dipakai saat offline dan tidak mengirim notifikasi push.

▶ Keputusan 2026-11-18 (#188): Pasang seperti aplikasi
- **Nama.** Di bawah ikon di layar utama tertulis "MIWE Digital". Nama lengkap "MIWE Digital Store" tampil di layar pembuka.
- **Ikon.** Ikon memakai logo asli `docs/input/logo.png` utuh, termasuk foto senja dan tulisan kecilnya. Di ponsel yang memotong ikon menjadi bulat, logo diperkecil di atas warna `langit` (#2A1F4D) supaya huruf MDS tidak terpotong.
- **Layar pembuka.** Latarnya `langit` (#2A1F4D), dengan logo di tengah dan nama "MIWE Digital Store", sama di mode terang dan gelap, di Android dan iPhone. Bilah status ponsel ikut berwarna `langit`.
- **Tanpa internet.** Yang tampil adalah halaman galat bawaan browser. Toko tidak punya halaman offline sendiri.
- **Tidak ada tombol pasang.** Toko tidak punya tombol "Pasang aplikasi". Pembeli memakai menu "Tambahkan ke layar utama" di browser.

▶ Keputusan 2026-11-20: Warna aplikasi terpasang mengikuti tema coretan tangan (`docs/DESIGN.md`). Keputusan ini menggantikan butir Ikon, Layar pembuka, dan warna bilah status di atas. Nama, tanpa internet, dan tanpa tombol pasang tidak berubah.
- **Ikon.** Ikon tetap memakai logo asli `docs/input/logo.png` utuh. Di ponsel yang memotong ikon menjadi bulat, logo diperkecil di atas warna `kertas` (#FDFBF7), bukan lagi `langit` ungu.
- **Layar pembuka.** Latarnya `kertas` (#FDFBF7), dengan logo di tengah dan nama "MIWE Digital Store" bertulisan Kalam tebal berwarna `pensil` (#2D2D2D). Tampilannya sama di mode terang dan gelap, di Android dan iPhone.
- **Bilah status ponsel.** Di Android, bilah status mengikuti mode perangkat: `kertas` (#FDFBF7) di mode terang dan `kertas-gelap` (#1E1C19) di mode gelap. Di iPhone, bilah status memakai gaya bawaan, yaitu latar terang dengan teks gelap, dan tidak lagi tembus di atas bilah atas toko.
- Logo MDS sendiri belum diganti. Logo bergaya coretan tangan, bila dibuat, menjadi keputusan pemilik tersendiri.

### 11.5 Sistem desain

- Warna, logo, huruf, dan gaya komponen ditetapkan di `docs/DESIGN.md`, yang disusun lewat `/impeccable`.

▶ Keputusan 2026-11-19: Tema tampilan diganti ke gaya coretan tangan dengan acuan `docs/design/acuan-coretan-tangan.md`. Acuan itu wajib dibaca untuk setiap perubahan yang menyentuh tampilan, bersama `docs/DESIGN.md`. Mode gelap (§11.3) tetap ada sebagai versi malam dari gaya yang sama.
- `docs/DESIGN.md` wajib selaras dengan PRD ini dan wajib terisi sebelum tiket tampilan pertama dikerjakan.

## 12. Server dan data

- Aplikasi berjalan di satu VPS lewat Docker Compose dan hanya bisa diakses lewat HTTPS.
- Database dicadangkan otomatis setiap hari. Tujuh cadangan terakhir disimpan, dan cadangan yang lebih lama dihapus.
- Isi Item stok disimpan terenkripsi di database.

▶ Keputusan 2026-11-15 (#115): Toko diakses di `https://akun.miwedigital.store`. Alamat ini juga yang dipakai Tautan Pesanan di email.

▶ Keputusan 2026-11-15 (#121):
- **Isi cadangan.** Cadangan harian juga mencakup folder unggahan, yaitu ikon Kategori dan foto Produk. Folder unggahan mengikuti aturan simpan yang sama dengan database: tujuh cadangan terakhir disimpan, dan yang lebih lama dihapus.
- **Tempat cadangan.** Cadangan disimpan di server. Pemilik menyalinnya ke komputer sendiri sesekali, misalnya seminggu sekali, mengikuti `docs/DEPLOY.md`. Penyalinan otomatis ke luar server belum dibuat.
- **Password database.** Password PostgreSQL di server adalah nilai acak dari `openssl rand -hex 32`. Nilai itu disimpan di berkas env produksi sebagai `POSTGRES_PASSWORD`, dan tidak pernah diganti setelah deploy pertama.

▶ Keputusan 2026-11-17 (#126):
- **Arsip unggahan rusak.** Bila arsip unggahan yang dipakai restore rusak, misalnya terpotong saat disalin, restore ditolak sebelum ada yang diubah. Database dan folder unggahan tetap seperti sebelumnya. Pemilik memakai cadangan tanggal lain atau mengganti arsipnya.
- **Arsip unggahan tidak ada.** Bila cadangan database tidak punya arsip unggahan bertanggal sama, database tetap dipulihkan dan folder unggahan tidak disentuh. Pesan restore menyarankan memeriksa ikon dan foto di toko, mengunggah ulang yang hilang lewat dasbor admin, atau memasukkan arsip dari komputer lalu mengulang restore.

## 13. Milestone

| Milestone | Nama | Isi | Bagian PRD |
|---|---|---|---|
| M1 | Toko bisa berjualan | Login Admin; Kategori, Produk, Varian, dan Item stok; beranda dan halaman Produk; checkout dengan QRIS Qrispy; Penahanan dan status Pesanan; Pesanan Bermasalah; halaman Pesanan dan Tautan Pesanan; email Pesanan selesai; daftar Pesanan dan Item stok di dasbor admin; pengaturan toko; tampilan responsif dengan navbar dan navigasi bawah; siap dipasang di VPS | §2.1, §2.2, §3, §4, §5, §6, §7.7 (login Admin), §9.1, §9.5–§9.9, §10, §11.1, §11.5, §12 |
| M2 | Member dan Voucher | Daftar dan Kode verifikasi; login dan lupa password; Riwayat Pesanan; dasbor Member; Admin mengelola Member; Voucher; ringkasan dasbor admin | §2.3, §7, §8, §9.2–§9.4 |
| M3 | Sentuhan aplikasi | Animasi navbar, mode gelap, dan pasang seperti aplikasi | §11.2–§11.4 |
| M4 | Laporan keuangan dan stok | Harga modal; Biaya transaksi dan Biaya operasional; Laba kotor dan Laba bersih; Ringkasan yang lebih lengkap; Laporan keuangan dengan saringan, grafik, dan tabel Pesanan; menu Item stok dengan hitungan baris; tombol "Salin semua" | §4.2, §6.1, §9.2, §9.5, §9.8, §11.1, §14 |
| M5 | Saldo Member | Admin menambah dan mengurangi saldo; Riwayat saldo; top up dengan QRIS; menu Top up dan Top up Bermasalah; bayar Pesanan dengan saldo; kartu saldo di Ringkasan; saringan Metode di Laporan keuangan | §1.3, §5.2, §5.7, §9.2, §9.5, §11.1, §14.5, §14.6, §15 |

Setelah M1, toko sudah bisa dipakai berjualan sungguhan. Sebelum M2, form checkout belum punya isian kode voucher, dan halaman Pesanan belum menampilkan ajakan membuat akun.

▶ Keputusan 2026-11-11: Isi M1 disesuaikan sebagai berikut.
- Isian Ambang stok menipis di pengaturan toko (§9.8) pindah ke M2, bersama daftar Stok menipis (§9.4) yang memakainya.
- M1 juga memuat data seed untuk UAT sesuai "Persiapan bersama" di `docs/UAT.md`, tanpa Member dan Voucher.
- Pemasangan di VPS (§12) dikerjakan lewat dua tiket: penyiapan server, domain, dan akun layanan oleh pemilik, lalu deploy otomatis oleh agent.
- Integrasi Qrispy mengikuti `docs/referensi/qrispy-api.md` dan ADR-0004.

▶ Keputusan 2026-11-17 (#128): Urutan tayang M2. Setiap merge ke `main` langsung tayang di produksi (`docs/DEPLOY.md`), jadi tiket M2 diurutkan supaya pintu masuk yang dilihat Pembeli baru dipasang setelah fitur di belakangnya selesai:
- tombol "Masuk" dan "Daftar" di bilah atas dan tab Akun, serta Riwayat Pesanan di tab Riwayat, dipasang setelah daftar, Kode verifikasi, login, dan lupa password selesai;
- ajakan "Buat akun untuk menyimpan riwayat" di Halaman Pesanan dipasang setelah login Member selesai;
- isian kode voucher di Checkout dipasang setelah Admin bisa membuat Voucher.

Sebelum itu, halaman baru boleh sudah ada di alamatnya, asal belum ditautkan dari halaman mana pun yang dibuka Pembeli.

▶ Keputusan 2026-11-20 (#204): M4 dan urutan tayangnya.
- M4 berisi permintaan pemilik di #204, kecuali saldo Member. Saldo Member, termasuk kartu total saldo dan saringan metode pembayaran di Laporan keuangan, direncanakan sebagai M5 (§1.3).
- Setiap merge tetap langsung tayang, jadi tiket M4 diurutkan sebagai berikut:
  - Harga modal dicatat di Pesanan dan bisa diisi di form Varian sebelum angka laba tampil di mana pun.
  - Kartu Total Harga modal, Laba kotor, dan Laba bersih di Ringkasan dipasang setelah isian Harga modal ada.
  - Menu "Laporan keuangan" ditautkan dari menu samping dan dari kartu Ringkasan setelah halamannya berisi rincian angka, saringan, grafik, dan tabel Pesanan.
  - Menu "Item stok" ditautkan setelah halamannya lengkap.
- Sebelum itu, halaman baru boleh sudah ada di alamatnya, asal belum ditautkan dari menu samping maupun Ringkasan.

▶ Keputusan 2026-11-20 (#226): Urutan tayang M5. Setiap merge tetap langsung tayang, jadi tiket M5 diurutkan sebagai berikut:
1. Saldo, Riwayat saldo, serta "Tambah saldo" dan "Kurangi saldo" oleh Admin. Kotak saldo di tab Akun sudah boleh tampil, tetapi belum berisi tombol "Top up".
2. Halaman Top up, Halaman bayar Top up, dan kabar pembayarannya. Halaman ini boleh sudah ada di alamatnya, asal belum ditautkan dari halaman mana pun yang dibuka Member.
3. Menu Top up di dasbor admin dan penyelesaian Top up Bermasalah.
4. Tombol "Top up" dan "Lanjutkan bayar" di tab Akun dipasang setelah langkah 2 dan 3 selesai, supaya Admin sudah bisa menangani Top up Bermasalah sebelum Member bisa top up.
5. Bayar dengan saldo di Checkout.
6. Kartu saldo di Ringkasan dan saringan Metode di Laporan keuangan.

## 14. Keuangan toko

Bagian ini ditambahkan pada 2026-11-20 (#204) untuk M4. Semua angka di bagian ini hanya terlihat oleh Admin. Pembeli tidak pernah melihat Harga modal, laba, Biaya transaksi, maupun Biaya operasional.

### 14.1 Harga modal

- Harga modal adalah biaya yang dikeluarkan toko untuk mendapat satu Item stok sebuah Varian. Setiap Varian punya satu Harga modal.
- Isian Harga modal ada di form Varian, di samping Harga jual. Aturannya:
  - wajib diisi;
  - rupiah bulat, minimal Rp 0, dan tidak dibatasi maksimum. Rp 0 dipakai untuk Item stok yang didapat toko tanpa biaya;
  - boleh lebih besar dari Harga jual, supaya toko tetap bisa menjual rugi, misalnya untuk promosi. Laba negatif tampil apa adanya.
- Contoh lengkapnya ada di `tests/golden/harga-modal.json`.
- Form Varian menampilkan "Laba kotor per Pesanan: Rp X", yaitu Harga jual − Harga modal, yang berubah langsung saat salah satu harga diketik.
- Daftar Varian di halaman Produk dasbor admin menampilkan Harga jual, Harga modal, dan Laba kotor per Pesanan setiap Varian. Contoh: Rp 50.000, Rp 35.000, dan Rp 15.000.
- Harga modal dicatat di Pesanan saat checkout, sama seperti Harga jual (§5.1). Mengubah Harga modal Varian sesudahnya tidak mengubah Pesanan yang sudah ada.

**Varian dan Pesanan tanpa Harga modal**
- Varian yang dibuat sebelum fitur ini tayang belum punya Harga modal. Checkout Varian itu tetap berjalan, dan Pesanannya tercatat tanpa Harga modal.
- Karena isiannya wajib, Admin yang menyimpan perubahan apa pun pada Varian lama juga harus mengisi Harga modal-nya.
- Saat Admin mengisi Harga modal sebuah Varian untuk pertama kalinya, semua Pesanan Varian itu yang tercatat tanpa Harga modal ikut memakai nilai itu, apa pun statusnya. Perubahan Harga modal sesudahnya hanya berlaku untuk Pesanan baru.
- Contoh: Netflix Premium 1 Bulan sudah punya 40 Pesanan Selesai sebelum fitur ini tayang. Pada 25 November Admin mengisi Harga modal Rp 35.000, sehingga ke-40 Pesanan itu tercatat dengan Harga modal Rp 35.000. Pada 1 Desember Admin mengubahnya menjadi Rp 37.000. Ke-40 Pesanan tadi tetap Rp 35.000, dan hanya Pesanan yang dibuat sesudahnya yang memakai Rp 37.000. Contoh lengkapnya ada di `tests/golden/harga-modal-pesanan.json`.

▶ Keputusan 2026-11-20 (#224):
- Selama Harga jual atau Harga modal di form Varian masih kosong atau ditolak, baris laba berbunyi "Laba kotor per Pesanan: —".
- Di daftar Varian, Varian tanpa Harga modal menampilkan "—" di Harga modal dan juga di Laba kotor per Pesanan.

### 14.2 Laba kotor

- Laba kotor sebuah Pesanan = Harga jual − Harga modal. Jumlah barangnya selalu 1, karena satu Pesanan berisi satu Item stok (§5.1).
- Dalam suatu rentang waktu:
  - Total Harga modal adalah jumlah Harga modal Pesanan yang dihitung;
  - Laba kotor adalah jumlah Laba kotor Pesanan yang dihitung.
- Pesanan yang dihitung adalah Pesanan Selesai yang punya Harga modal, dikelompokkan menurut waktu pembayarannya, sama seperti Pendapatan (§9.3). Pesanan Bermasalah dan Dana Dikembalikan tidak dihitung. Pesanan Bermasalah yang kemudian diselesaikan Admin dihitung pada tanggal pembayarannya.
- Pesanan Selesai tanpa Harga modal tetap dihitung di Pendapatan dan jumlah Pesanan Selesai, tetapi tidak di Total Harga modal, Laba kotor, dan Laba bersih. Selama ada Pesanan seperti itu dalam rentangnya, angka laba disertai peringatan "N Pesanan Selesai belum dihitung labanya, karena Harga modal Varian-nya belum diisi."
- Contoh: Harga modal Rp 800, Harga jual Rp 1.000, dan 100 Pesanan Selesai. Total Harga modal 100 × Rp 800 = Rp 80.000, dan Laba kotor 100 × (Rp 1.000 − Rp 800) = Rp 20.000.
- Contoh lengkapnya ada di `tests/golden/laba.json`.

### 14.3 Biaya transaksi

- Biaya transaksi adalah potongan Qrispy atas pembayaran sebuah Pesanan. Qrispy tidak mengabarkan besarnya untuk setiap Pesanan, dan keterangan resminya belum pasti (`docs/referensi/qrispy-api.md` bagian 3). Karena itu toko menghitungnya dari dua isian di pengaturan toko (§9.8):

  | Isian | Aturan | Nilai awal |
  |---|---|---|
  | Persen biaya transaksi | Angka 0 sampai 10, paling banyak 2 angka di belakang koma, misalnya 0,7 atau 0,75 | 0,7 |
  | Minimal Total bayar yang dikenai biaya | Rupiah bulat, minimal Rp 0. Rp 0 berarti semua Pesanan dikenai biaya | Rp 100.000 |

  Contoh isiannya ada di `tests/golden/isian-biaya-transaksi.json`.
- Biaya transaksi sebuah Pesanan:
  - bila Total bayar sama dengan atau lebih dari minimal: Total bayar × persen ÷ 100, dibulatkan ke atas ke rupiah;
  - bila Total bayar kurang dari minimal: Rp 0.
- Pembulatan ke atas membuat laba tidak pernah tampil lebih besar dari kenyataan.
- Contoh dengan nilai awal:
  - Total bayar Rp 135.499: 135.499 × 0,7 ÷ 100 = 948,49…, jadi Biaya transaksinya Rp 949;
  - Total bayar Rp 100.000: tepat Rp 700;
  - Total bayar Rp 50.010: di bawah Rp 100.000, jadi Rp 0.
  
  Contoh lengkapnya ada di `tests/golden/biaya-transaksi.json`.
- Biaya transaksi dihitung dan dicatat di Pesanan saat pembayarannya masuk. Ini termasuk pembayaran yang membuat Pesanan Bermasalah dan pembayaran yang datang terlambat (§5.9). Mengubah pengaturan sesudahnya tidak mengubah Pesanan yang sudah dibayar.
- Pesanan yang sudah dibayar sebelum fitur ini tayang dihitung sekali dengan nilai awal.
- Pemilik mencocokkan kedua nilai itu dengan potongan yang tampil di saldo Qrispy, lalu mengubahnya di pengaturan toko bila berbeda.

▶ Keputusan 2026-11-20 (#224): Pesan penolakan kedua isian Biaya transaksi mengikuti pola pesan Ambang stok menipis dan Harga modal. Setiap pesan menyebut sebabnya, misalnya isian kosong, persen di luar 0 sampai 10, atau lebih dari 2 angka di belakang koma, lalu langkah berikutnya.

### 14.4 Biaya operasional

- Biaya operasional adalah biaya toko di luar Harga modal dan Biaya transaksi, misalnya sewa server, domain, atau iklan.
- Admin mencatat setiap Biaya operasional dengan isian berikut:
  - **tanggal:** paling lambat hari ini menurut zona waktu toko (§9.1). Tanggal yang akan datang ditolak, supaya salah ketik tahun tidak diam-diam mengubah Laba bersih;
  - **keterangan:** wajib, paling banyak 100 karakter setelah spasi di awal dan akhir dibuang;
  - **nominal:** rupiah bulat, minimal Rp 1.
- Contoh isiannya ada di `tests/golden/isian-biaya-operasional.json`.
- Admin bisa menambah, mengubah, dan menghapus Biaya operasional. Penghapusan ditegaskan lebih dulu di tempat, seperti panel hapus Voucher (§8.8).
- Tidak ada biaya berulang otomatis. Biaya bulanan, misalnya sewa server, dicatat setiap bulan.
- Halaman Biaya operasional dibuka dari Laporan keuangan (§14.6). Isinya:
  - saringan bulan, dengan bulan berjalan sebagai pilihan awal;
  - total Biaya operasional bulan itu;
  - daftar biaya bulan itu, diurutkan menurut tanggal dengan yang terbaru di atas.
- Biaya operasional dikurangkan dari Laba bersih menurut tanggalnya (§14.5).

▶ Keputusan 2026-11-20 (#224): Teks halaman Biaya operasional mengikuti pola halaman Voucher:
- tombol tambah berbunyi "Tambah biaya";
- total ditulis "Total Biaya operasional <Bulan Tahun>", misalnya "Total Biaya operasional November 2026";
- panel hapus berjudul "Hapus Biaya operasional", dengan penegasan "Hapus Biaya operasional "<keterangan>"? Biaya ini terhapus dan tidak bisa dikembalikan."

### 14.5 Laba bersih

- **Laba bersih = Laba kotor − potongan voucher + Kode unik − Biaya transaksi − Biaya operasional**
- Potongan voucher, Kode unik, dan Biaya transaksi diambil dari Pesanan yang sama dengan Laba kotor, yaitu Pesanan Selesai yang punya Harga modal dalam rentang itu (§14.2). Biaya operasional adalah jumlah biaya yang tanggalnya berada dalam rentang itu.
- Bila semua Pesanan Selesai punya Harga modal, Laba bersih sama dengan Pendapatan − Total Harga modal − Biaya transaksi − Biaya operasional.
- Kode unik ditambahkan karena dibayar Pembeli dan masuk saldo toko (§5.5).
- Contoh dalam satu hari, dengan Biaya transaksi nilai awal (§14.3) dan satu Biaya operasional Rp 10.000:

  | Pesanan | Harga jual | Potongan voucher | Kode unik | Total bayar | Harga modal | Biaya transaksi |
  |---|---|---|---|---|---|---|
  | 1 | Rp 50.000 | Rp 5.000 | Rp 123 | Rp 45.123 | Rp 35.000 | Rp 0 |
  | 2 | Rp 50.000 | Rp 0 | Rp 10 | Rp 50.010 | Rp 35.000 | Rp 0 |
  | 3 | Rp 135.000 | Rp 0 | Rp 499 | Rp 135.499 | Rp 100.000 | Rp 949 |

  | Rincian | Nominal |
  |---|---|
  | Pendapatan | Rp 230.632 |
  | Pesanan Selesai | 3 |
  | Total Harga modal | Rp 170.000 |
  | **Laba kotor** | **Rp 65.000** |
  | − Potongan voucher | Rp 5.000 |
  | + Kode unik | Rp 632 |
  | − Biaya transaksi | Rp 949 |
  | − Biaya operasional | Rp 10.000 |
  | **Laba bersih** | **Rp 49.683** |

  Hitungan lewat Pendapatan memberi angka yang sama: 230.632 − 170.000 − 949 − 10.000 = 49.683.
- Saat saringan Produk atau Kategori aktif di Laporan keuangan, Biaya operasional tidak dikurangkan, karena biaya itu bukan milik Produk tertentu. Baris Biaya operasional diganti keterangan "Laba bersih ini belum dikurangi Biaya operasional, karena saringan Produk atau Kategori sedang aktif."
- Laba kotor dan Laba bersih boleh negatif, dan ditulis dengan tanda minus, misalnya "−Rp 12.500".
- Contoh lengkapnya ada di `tests/golden/laba.json`.

▶ Keputusan 2026-11-20 (#224): Saat saringan Produk atau Kategori aktif, baris "− Biaya operasional" dihapus dari rincian angka, dan keterangan "Laba bersih ini belum dikurangi Biaya operasional, …" tampil sebagai catatan di atas rincian, seperti diatur `docs/DESIGN.md`.

▶ Keputusan 2026-11-20 (#226): Laba bersih dengan saldo Member (§15.8)
- **Laba bersih = Laba kotor − potongan voucher + Kode unik − Biaya transaksi − Biaya operasional + Kode unik Top up − Biaya transaksi Top up**
- Kode unik Top up dan Biaya transaksi Top up diambil dari Top up Berhasil yang waktu bayarnya berada dalam rentang itu. Nominal top up tidak ikut dihitung.
- Pesanan yang dibayar dengan saldo dihitung seperti Pesanan lain, dengan Kode unik dan Biaya transaksi Rp 0.
- Bila saringan Kategori, Produk, atau Metode di Laporan keuangan aktif, Biaya operasional, Kode unik Top up, dan Biaya transaksi Top up tidak dikurangkan, karena ketiganya bukan milik Produk atau metode tertentu. Barisnya dihapus dari rincian, dan keterangannya menjadi "Laba bersih ini belum dikurangi Biaya operasional dan Top up, karena saringan Produk, Kategori, atau Metode sedang aktif."
- Contoh: Laba bersih contoh di atas (Rp 49.683), ditambah satu Top up Berhasil pada hari yang sama dengan Kode unik Rp 200 dan Biaya transaksi Rp 1.052, menjadi 49.683 + 200 − 1.052 = Rp 48.831. Pendapatan tetap Rp 230.632. Contoh lengkapnya ada di `tests/golden/laba-top-up.json`.

### 14.6 Laporan keuangan

Laporan keuangan adalah halaman dasbor admin yang berisi rincian angka, grafik, dan tabel Pesanan Selesai dalam satu rentang. Letaknya di menu samping diatur di §11.1, dan halamannya punya tautan ke halaman Biaya operasional (§14.4).

**Saringan**
- **Rentang tanggal:** tanggal mulai dan tanggal akhir, keduanya ikut dihitung, menurut waktu bayar dalam zona waktu toko. Tanggal akhir yang lebih awal dari tanggal mulai ditolak dengan pesan "Tanggal akhir tidak boleh sebelum tanggal mulai."
- **Kategori dan Produk:** masing-masing bisa dipilih satu atau "Semua". Memilih Kategori membatasi pilihan Produk ke Kategori itu, sedangkan Produk boleh dipilih tanpa memilih Kategori. Pilihan Produk juga memuat Produk nonaktif, karena Pesanan lamanya tetap tercatat.
- **Kategori sebuah Pesanan** adalah Kategori Produknya saat Laporan dibuka. Bila Produk dipindah ke Kategori lain, Pesanan lamanya ikut pindah ke Kategori baru.
- **Cari:** kotak cari Nomor Pesanan atau email hanya menyaring tabel Pesanan (§14.8). Rincian angka dan grafik tidak ikut berubah.
- Saringan metode pembayaran belum ada, karena QRIS masih satu-satunya cara bayar. Saringan ini direncanakan bersama saldo Member di M5 (§13).

▶ Keputusan 2026-11-20 (#226): Saringan Metode
- **Metode:** Semua, QRIS, atau Saldo, dengan Semua sebagai pilihan awal. Saringan ini membatasi Pesanan Selesai di rincian angka, grafik, dan tabel Pesanan, sama seperti saringan Kategori dan Produk.
- **Rincian angka** mendapat dua baris sesudah Biaya operasional, yaitu "+ Kode unik Top up" dan "− Biaya transaksi Top up", sebelum Laba bersih (§14.5).
  - Di bawah Laba bersih tampil baris informasi "Top up Berhasil: N, Rp X (uang Member, bukan Pendapatan)" (§15.8).
  - Saat saringan Kategori, Produk, atau Metode aktif, kedua baris Top up, baris Biaya operasional, dan baris informasi Top up tidak tampil, dan keterangan §14.5 yang baru dipakai.
- **Grafik 2** mengurangkan Biaya transaksi Top up dan menambahkan Kode unik Top up pada kelompok periode yang memuat waktu bayar Top up, kecuali saat saringan Kategori, Produk, atau Metode aktif.
- **Tabel Pesanan** (§14.8) mendapat kolom Metode, yaitu QRIS atau Saldo, sesudah kolom waktu bayar.

**Periode**
- Pilihan periode Harian, Mingguan, Bulanan, dan Tahunan menentukan pengelompokan grafik per periode (§14.7).
- Satu minggu dihitung Senin 00.00.00 sampai Minggu 23.59.59 WIB. Bulan dan tahun mengikuti kalender dalam zona waktu toko.
- Kelompok pertama dan terakhir hanya berisi tanggal yang ada di dalam rentang. Contoh: rentang Rabu 4 November sampai Jumat 20 November 2026 dengan periode Mingguan menghasilkan tiga kelompok, yaitu 4–8 November, 9–15 November, dan 16–20 November.
- Kelompok tanpa Pesanan Selesai tampil dengan nilai 0.
- Contoh lengkapnya ada di `tests/golden/kelompok-periode-laporan.json`.

**Rentang awal**
- Halaman dibuka dengan periode Harian. Setiap kali Admin memilih periode, rentangnya kembali ke rentang awal periode itu, lalu Admin bisa mengubahnya.
- Tanggal akhir rentang awal selalu hari ini. Tanggal mulainya:
  - Harian: 30 hari terakhir, termasuk hari ini;
  - Mingguan: Senin dari 12 minggu terakhir, termasuk minggu berjalan;
  - Bulanan: tanggal 1 dari 12 bulan terakhir, termasuk bulan berjalan;
  - Tahunan: 1 Januari tahun waktu bayar Pesanan Selesai pertama, atau 1 Januari tahun berjalan bila belum ada Pesanan Selesai.
- Contoh: hari ini Jumat 20 November 2026, dan Pesanan Selesai pertama dibayar 11 November 2026.
  - Harian: 22 Oktober sampai 20 November 2026.
  - Mingguan: 31 Agustus sampai 20 November 2026.
  - Bulanan: 1 Desember 2025 sampai 20 November 2026.
  - Tahunan: 1 Januari sampai 20 November 2026.
  
  Contoh lengkapnya ada di `tests/golden/rentang-awal-laporan.json`.

**Rincian angka**
- Di atas grafik tampil rincian angka yang mengikuti saringan rentang, Kategori, dan Produk. Rinciannya disusun dari atas ke bawah seperti tabel rincian di §14.5: Pendapatan, Pesanan Selesai, Total Harga modal, Laba kotor, potongan voucher, Kode unik, Biaya transaksi, Biaya operasional, lalu Laba bersih.
- Peringatan Pesanan tanpa Harga modal (§14.2) dan keterangan Biaya operasional saat saringan aktif (§14.5) tampil di rincian ini.

### 14.7 Grafik

- Grafik digambar oleh kode toko sendiri, tanpa pustaka grafik, dan mengikuti `docs/DESIGN.md`.
- Semua grafik mengikuti saringan rentang, Kategori, dan Produk:
  1. **Pendapatan** per kelompok periode, berupa batang.
  2. **Laba kotor dan Laba bersih** per kelompok periode, berupa dua garis. Biaya operasional dikurangkan pada kelompok yang memuat tanggalnya, kecuali saat saringan Produk atau Kategori aktif (§14.5).
  3. **Jumlah Pesanan Selesai** per kelompok periode, berupa batang.
  4. **Produk terlaris:** paling banyak 10 Produk dengan Pesanan Selesai terbanyak dalam rentang, dijumlahkan dari semua Variannya, berupa batang mendatar dengan Pendapatan setiap Produk di sebelahnya. Bila jumlah Pesanan Selesai-nya sama, Produk dengan Pendapatan lebih besar ditaruh lebih atas, lalu nama Produk dari A sampai Z. Contohnya ada di `tests/golden/produk-terlaris.json`.
  5. **Pendapatan per Kategori:** Pendapatan setiap Kategori dalam rentang, berupa batang mendatar beserta jumlah Pesanan Selesai-nya, dengan Pendapatan terbesar di atas. Kategori tanpa Pesanan Selesai dalam rentang itu tidak tampil.
- Grafik 1, 3, 4, dan 5 menghitung semua Pesanan Selesai, termasuk yang belum punya Harga modal, sama seperti Pendapatan. Grafik 2 mengikuti §14.2 dan §14.5.

▶ Keputusan 2026-11-20 (#224): Bila tidak ada Pesanan Selesai dalam saringan, grafik 4 dan 5 tetap tampil, dan kartunya berbunyi "Belum ada Pesanan Selesai dalam rentang ini.", sama dengan pesan tabel (§14.8).

### 14.8 Tabel Pesanan di Laporan keuangan

- Tabel berisi Pesanan Selesai dalam saringan rentang, Kategori, dan Produk. Urutannya menurut waktu bayar dengan yang terbaru di atas, dan setiap halaman memuat 50 Pesanan.
- Kolomnya: Nomor Pesanan, waktu bayar, Produk dan Varian, Harga jual, Harga modal, Laba kotor, potongan voucher, Kode unik, Biaya transaksi, dan Total bayar.
- Pesanan tanpa Harga modal menampilkan "—" di kolom Harga modal dan Laba kotor.
- Setiap baris membuka detail Pesanan di dasbor admin (§9.5).
- Kotak cari menerima sebagian Nomor Pesanan atau sebagian email, tanpa membedakan huruf besar dan kecil, sama seperti daftar Pesanan (§9.5).
- Bila tidak ada Pesanan Selesai dalam saringan, tabel berbunyi "Belum ada Pesanan Selesai dalam rentang ini." Bila pencarian tidak menemukan apa pun, tabel berbunyi "Tidak ada Pesanan yang cocok dengan pencarian ini."

## 15. Saldo Member

Bagian ini ditambahkan pada 2026-11-20 (#226) untuk M5. Sebelumnya saldo termasuk hal yang sengaja tidak dibangun (§1.3).

### 15.1 Saldo

- Setiap Member punya satu Saldo, berupa rupiah bulat yang dimulai dari Rp 0. Saldo tidak pernah negatif.
- Saldo hanya berubah lewat empat jalan: Top up yang Berhasil (§15.3), pembelian dengan saldo (§15.7), serta penambahan dan pengurangan oleh Admin (§15.6).
- Saldo tidak bisa ditarik menjadi uang atau dipindah ke Member lain. Pengembalian uang diurus di luar sistem, lalu Admin mengurangi saldonya (§15.6).
- Saldo adalah uang Member yang belum dibelanjakan, bukan Pendapatan (§15.8).
- Saldo Member nonaktif (§2.3) tetap tersimpan. Saldo itu tidak bisa dipakai, karena Member nonaktif tidak bisa login, tetapi Admin tetap bisa menambah atau menguranginya. Top up yang sedang menunggu tetap diproses bila dibayar.
- Toko tidak mengirim email untuk top up maupun perubahan saldo. Daftar email di §10.2 tidak berubah, dan Member melihat hasilnya di Riwayat saldo.

### 15.2 Riwayat saldo

- Setiap perubahan saldo dicatat sebagai satu baris Riwayat saldo, berisi:
  - waktu;
  - jenis: Top up, Pembelian, Ditambah Admin, atau Dikurangi Admin;
  - nominal dengan tanda + atau −;
  - saldo sesudahnya;
  - rujukan: Nomor Top up, Nomor Pesanan, atau keterangan Admin.
- Contoh:

  | Waktu | Jenis | Nominal | Saldo | Rujukan |
  |---|---|---|---|---|
  | 21 Nov 2026 10.00 | Top up | +Rp 50.000 | Rp 50.000 | TOPUP-7K3P9Q |
  | 21 Nov 2026 10.20 | Pembelian | −Rp 45.000 | Rp 5.000 | MIWE-4H8M2R |
  | 22 Nov 2026 09.00 | Ditambah Admin | +Rp 10.000 | Rp 15.000 | Ganti rugi akun Netflix bermasalah |

- Member melihat Riwayat saldo-nya dari tab Akun (§15.10), termasuk keterangan Admin. Admin melihatnya di halaman Member (§15.6).
- Baris terbaru tampil di atas, dengan 50 baris per halaman.

### 15.3 Top up

- Top up adalah penambahan saldo oleh Member sendiri, dibayar dengan QRIS lewat Qrispy. Hanya Member yang sedang login yang bisa top up, lewat tombol "Top up" di tab Akun.
- Halaman Top up berisi isian nominal dan tiga tombol cepat, yaitu Rp 50.000, Rp 100.000, dan Rp 200.000, yang mengisi isian itu.
- Nominal top up berupa rupiah bulat, minimal Rp 10.000 dan maksimal Rp 499.000. Batas atas ini sama dengan batas QRIS Qrispy untuk merchant standar (§3.2).
  - Nominal di bawah minimal ditolak dengan "Nominal top up minimal Rp 10.000."
  - Nominal di atas maksimal ditolak dengan "Nominal top up maksimal Rp 499.000."
  - Isian kosong atau bukan rupiah bulat ditolak dengan pesan yang menyebut sebabnya, mengikuti pola isian lain (§14.3).
  - Contohnya ada di `tests/golden/isian-top-up.json`.
- Tombol "Bayar dengan QRIS" membuat Top up dan menerbitkan QRIS untuk Nominal top up. Qrispy menambahkan Kode unik, sama seperti Pesanan (§5.5).
- **Total bayar Top up = Nominal top up + Kode unik.** Contoh: Nominal top up Rp 50.000 dan Kode unik Rp 123 menghasilkan Total bayar Rp 50.123. Saldo bertambah Rp 50.000, dan Kode unik masuk toko.
- Halaman bayar Top up sama dengan Halaman bayar Pesanan (§5.6). Isinya gambar QR, hitung mundur, rincian (Nominal top up, Kode unik, dan Total bayar), tombol "Simpan gambar QR", dan tombol "Batalkan".
- Begitu pembayaran masuk, halaman berpindah sendiri ke Riwayat saldo dengan pesan "Top up Rp 50.000 berhasil. Saldo sekarang Rp X."
- **Nomor Top up** berbentuk `TOPUP-` diikuti 6 karakter acak, misalnya `TOPUP-7K3P9Q`. Karakternya mengikuti aturan Nomor Pesanan (§9.6). Contohnya ada di `tests/golden/nomor-top-up.json`.
- **Satu Top up menunggu.** Setiap Member hanya boleh punya 1 Top up Menunggu Pembayaran.
  - Member yang menekan "Bayar dengan QRIS" selagi masih punya Top up menunggu diarahkan ke Halaman bayar Top up itu. Di sana ia boleh membatalkannya, lalu top up lagi.
  - Batas ini terpisah dari batas Pesanan menunggu (§5.4). Seorang Member boleh punya satu Pesanan Menunggu Pembayaran dan satu Top up Menunggu Pembayaran sekaligus.
- **Pembatalan dan kedaluwarsa** mengikuti §5.8:
  - "Batalkan" langsung membatalkan, tanpa dialog konfirmasi. QRIS-nya ikut dibatalkan di Qrispy, lalu Member kembali ke tab Akun.
  - Bila Qrispy menolak pembatalan karena tagihan sudah dibayar, Top up diproses sebagai sudah dibayar.
  - Masa berlaku QRIS 15 menit. Saat waktu kedaluwarsa tercapai, toko memeriksa status QRIS ke Qrispy sekali.
- Top up Kedaluwarsa dan Dibatalkan tidak tampil di mana pun bagi Member, karena saldonya tidak berubah. Riwayat lengkap semua Top up ada di menu Top up dasbor admin (§15.9).

### 15.4 Status Top up

| Status | Arti |
|---|---|
| Menunggu Pembayaran | QRIS sudah terbit dan belum dibayar. |
| Berhasil | Sudah dibayar, dan saldo sudah bertambah. |
| Kedaluwarsa | Masa berlaku QRIS lewat tanpa pembayaran. |
| Dibatalkan | Dibatalkan Member sebelum membayar. |
| Bermasalah | Sudah dibayar, tetapi nominalnya kurang, sehingga saldo belum bertambah (§15.5). |
| Dana Dikembalikan | Top up Bermasalah yang uangnya sudah dikembalikan Admin di luar sistem. |

Perpindahan status yang boleh terjadi:
- Menunggu Pembayaran → Berhasil, Kedaluwarsa, Dibatalkan, atau Bermasalah;
- Kedaluwarsa atau Dibatalkan → Berhasil atau Bermasalah, hanya bila kabar pembayaran datang terlambat;
- Bermasalah → Berhasil atau Dana Dikembalikan, oleh Admin (§15.9).

Saldo bertambah tepat satu kali untuk setiap Top up, yaitu saat Top up menjadi Berhasil, sebesar Nominal top up. Kabar pembayaran yang datang berulang tidak mengubah apa pun.

Riwayat status Top up mencatat pelaku setiap perubahan, seperti Pesanan (§5.7):
- "Member": Top up dibuat atau dibatalkan;
- "Qrispy": perubahan karena kabar pembayaran;
- "Sistem": Kedaluwarsa otomatis;
- "Admin": Top up Bermasalah diselesaikan Admin.

### 15.5 Kabar pembayaran Top up

1. **Nominal yang diterima sama dengan atau lebih dari Total bayar.** Top up menjadi Berhasil, dan saldo bertambah sebesar Nominal top up. Kelebihan bayar tidak ditambahkan ke saldo, sama seperti Pesanan (§5.9).
2. **Nominal yang diterima kurang dari Total bayar.** Top up menjadi Bermasalah, dan saldo tidak berubah.
3. **Kabar bayar datang untuk Top up yang sudah Kedaluwarsa atau Dibatalkan.** Aturan 1 dan 2 tetap berlaku. Top up tidak bergantung pada stok, jadi pembayaran telat yang nominalnya cukup langsung Berhasil.

- Waktu bayar dan nominal yang diterima dicatat di Top up.
- **Biaya transaksi Top up** dihitung dan dicatat saat pembayaran masuk, dengan rumus dan pengaturan yang sama dengan Pesanan (§14.3), dari Total bayar Top up. Contoh dengan nilai awal: Total bayar Rp 150.200 menghasilkan 150.200 × 0,7 ÷ 100 = 1.051,4, jadi Biaya transaksinya Rp 1.052. Total bayar Rp 50.123 di bawah Rp 100.000, jadi Biaya transaksinya Rp 0.
- Contoh lengkapnya ada di `tests/golden/kabar-pembayaran-top-up.json`.

### 15.6 Admin mengubah saldo

- Halaman Member di dasbor admin (§2.3), yang dibuka dengan mengetuk email Member, menampilkan:
  - Saldo;
  - tombol "Tambah saldo" dan "Kurangi saldo";
  - Riwayat saldo (§15.2), di atas Riwayat Pesanan.
- Kedua aksi meminta dua isian:
  - **nominal:** rupiah bulat, minimal Rp 1;
  - **keterangan:** wajib, paling banyak 100 karakter setelah spasi di awal dan akhir dibuang, sama seperti Biaya operasional (§14.4). Keterangan ini terlihat oleh Member di Riwayat saldo-nya.
- Sebelum dijalankan, aksi ditegaskan lebih dulu di tempat, misalnya "Tambah Rp 50.000 ke saldo budi@mail.com?" atau "Kurangi Rp 50.000 dari saldo budi@mail.com?".
- Pengurangan yang melebihi saldo ditolak dengan pesan "Saldo tidak cukup untuk dikurangi Rp Y. Saldo budi@mail.com sekarang Rp X.", dan saldo tidak berubah. Untuk mengosongkan saldo, Admin mengurangi sebesar seluruh saldonya.
- Kedua aksi berlaku untuk Member aktif maupun nonaktif.
- Daftar Member (§2.3) mendapat kolom Saldo. Member tidak punya username, jadi yang tampil tetap email.
- Contoh lengkapnya ada di `tests/golden/ubah-saldo-admin.json`.

### 15.7 Bayar dengan saldo

- Hanya Member yang sedang login yang bisa membayar dengan saldo. Checkout Member menampilkan dua pilihan, yaitu "Saldo (Rp X)" dan "QRIS". Tamu hanya melihat QRIS, seperti sebelumnya.
- **Yang harus dibayar dengan saldo = Harga jual − potongan voucher.** Tidak ada Kode unik dan tidak ada Biaya transaksi. Inilah Total bayar Pesanan yang dibayar dengan saldo.
- Saldo hanya bisa membayar penuh, tidak dicampur dengan QRIS.
- Saldo cukup bila Saldo sama dengan atau lebih dari yang harus dibayar.
  - Bila saldo kurang, pilihan Saldo tidak bisa dipilih, dan di bawahnya tertulis "Saldo kurang Rp X. Top up dulu." X adalah selisihnya, dan kata "Top up" menaut ke halaman Top up.
  - Pilihan awalnya Saldo bila saldo cukup, dan QRIS bila saldo kurang.
  - Kecukupan saldo dihitung ulang setiap kali hasil "Pakai" voucher mengubah potongan (§8.7).
- Tombol bayarnya menyebut nominal, misalnya "Bayar Rp 45.000 dengan saldo", tanpa dialog penegasan. Tombol untuk QRIS tetap "Bayar dengan QRIS".
- Voucher berlaku dengan aturan yang sama persis (§8). Pemakaiannya dihitung menurut §8.5, karena Pesanan itu Selesai.
- Pemeriksaan checkout §5.2 tetap berlaku dengan urutan yang sama, termasuk batas Pesanan menunggu (§5.4). Saldo diperiksa terakhir (▶ Keputusan 2026-11-20 di §5.2).
- Bila saldo ternyata kurang saat Pesanan dibuat, misalnya karena baru dikurangi Admin, Pesanan tidak dibuat. Pembeli melihat "Saldo tidak cukup. Saldo Anda Rp X, sedangkan yang harus dibayar Rp Y. Top up dulu atau bayar dengan QRIS.", dan isian kode voucher tetap berisi.
- Bila berhasil:
  - saldo berkurang sebesar Total bayar, dan Riwayat saldo mencatat baris Pembelian dengan Nomor Pesanan-nya;
  - Pesanan langsung Selesai, tanpa Menunggu Pembayaran dan tanpa QRIS;
  - satu Item stok langsung dikirim;
  - email "Pesanan selesai" dikirim;
  - Pembeli dibawa ke Halaman Pesanan Selesai.
- Pemotongan saldo dan pengiriman Item stok terjadi bersama. Bila salah satunya tidak bisa terjadi, tidak ada yang berubah. Karena itu Pesanan yang dibayar dengan saldo tidak pernah Bermasalah dan tidak bisa dibatalkan.
- Waktu bayar Pesanan itu adalah waktu Pesanan dibuat. Riwayat statusnya mencatat satu perubahan "Selesai" dengan pelaku "Pembeli (saldo)".
- Rincian nominal Pesanan yang dibayar dengan saldo berisi Harga jual, Potongan voucher, dan Total bayar, tanpa baris Kode unik, lalu tulisan "Dibayar dengan saldo". Ini berlaku di Halaman Pesanan, email "Pesanan selesai", Riwayat Pesanan, dan detail Pesanan dasbor admin.
- Contoh: Saldo Rp 50.000, Harga jual Rp 50.000, dan Voucher `HEMAT5` Rp 5.000. Yang harus dibayar Rp 45.000, jadi saldo cukup. Tombolnya "Bayar Rp 45.000 dengan saldo", dan sesudahnya saldo menjadi Rp 5.000. Tanpa Voucher, saldo Rp 40.000 kurang Rp 10.000, sehingga tertulis "Saldo kurang Rp 10.000. Top up dulu."
- Contoh lengkapnya ada di `tests/golden/bayar-saldo.json`.

### 15.8 Saldo di keuangan toko

- Nominal top up bukan Pendapatan. Uang top up baru menjadi Pendapatan saat dibelanjakan.
- Pesanan yang dibayar dengan saldo dihitung seperti Pesanan Selesai lain menurut waktu bayarnya:
  - masuk Pendapatan sebesar Total bayar-nya, yaitu Harga jual − potongan voucher;
  - masuk jumlah Pesanan Selesai dan laba (§14.2);
  - Kode unik dan Biaya transaksinya Rp 0.
- **Kode unik Top up** dan **Biaya transaksi Top up** adalah jumlah Kode unik dan Biaya transaksi dari Top up Berhasil dalam rentang itu, menurut waktu bayar Top up.
  - Top up Bermasalah yang kemudian diselesaikan dengan "Tambahkan ke saldo" dihitung pada waktu bayarnya.
  - Top up yang masih Bermasalah atau sudah Dana Dikembalikan tidak dihitung.
- Keduanya ikut Laba bersih (▶ Keputusan 2026-11-20 di §14.5).
- Contoh dalam satu hari, tanpa Biaya operasional:
  - satu Pesanan dibayar dengan saldo: Harga jual Rp 50.000, tanpa Voucher, dan Harga modal Rp 35.000;
  - satu Top up Berhasil: Nominal top up Rp 150.000, Kode unik Rp 200, Total bayar Rp 150.200, dan Biaya transaksi Rp 1.052.

  | Rincian | Nominal |
  |---|---|
  | Pendapatan | Rp 50.000 |
  | Pesanan Selesai | 1 |
  | Total Harga modal | Rp 35.000 |
  | **Laba kotor** | **Rp 15.000** |
  | − Potongan voucher | Rp 0 |
  | + Kode unik | Rp 0 |
  | − Biaya transaksi | Rp 0 |
  | − Biaya operasional | Rp 0 |
  | + Kode unik Top up | Rp 200 |
  | − Biaya transaksi Top up | Rp 1.052 |
  | **Laba bersih** | **Rp 14.148** |
  | Top up Berhasil | 1, Rp 150.000 |

- Baris "Top up Berhasil: N, Rp X" hanya informasi, dan tidak ikut hitungan. N adalah jumlah Top up Berhasil, dan X jumlah Nominal top up-nya. Gunanya untuk mencocokkan uang yang masuk dengan saldo Qrispy.
- Contoh lengkapnya ada di `tests/golden/laba-top-up.json`.

### 15.9 Menu Top up di dasbor admin

- Menu samping "Top up" letaknya tepat di bawah menu Member (▶ Keputusan 2026-11-20 di §11.1).
- **Daftar Top up**:
  - kolomnya Nomor Top up, waktu dibuat, email Member, Nominal top up, Total bayar, dan status;
  - Top up terbaru di atas, dengan 50 Top up per halaman;
  - Admin bisa menyaring menurut status, serta mencari sebagian email atau sebagian Nomor Top up tanpa membedakan huruf besar dan kecil, sama seperti daftar Pesanan (§9.5);
  - Top up Bermasalah ditonjolkan dengan warna status Bermasalah.
- **Detail Top up** menampilkan:
  - rincian Nominal top up, Kode unik, dan Total bayar;
  - nominal yang diterima dan Biaya transaksi, bila sudah dibayar;
  - riwayat status beserta pelakunya;
  - tautan ke halaman Member.
- **Top up Bermasalah** diselesaikan Admin dengan salah satu cara, dan keduanya ditegaskan lebih dulu:
  - "Tambahkan ke saldo": saldo Member bertambah sebesar Nominal top up, dan Top up menjadi Berhasil. Riwayat saldo mencatat baris Top up dengan Nomor Top up-nya;
  - "Dana Dikembalikan": dipakai setelah uangnya dikembalikan di luar sistem. Saldo tidak berubah.
- Admin tidak bisa membuat atau membatalkan Top up atas nama Member. Untuk menambah saldo tanpa pembayaran, Admin memakai "Tambah saldo" (§15.6).

### 15.10 Saldo di tab Akun

- Tab Akun untuk Member menampilkan kotak "Saldo Rp X", di bawah email Member dan di atas form ganti password. Kotak itu berisi tombol "Top up" dan tautan "Riwayat saldo".
- Bila ada Top up Menunggu Pembayaran, kotak itu juga menampilkan "Top up Rp X menunggu pembayaran" dengan tombol "Lanjutkan bayar", yang membuka Halaman bayar Top up.
- Bilah atas tidak berubah dan tidak menampilkan saldo.
