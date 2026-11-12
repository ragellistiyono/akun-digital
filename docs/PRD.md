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

## 2. Pengguna dan peran

### 2.1 Peran

| Peran | Siapa | Yang boleh dilakukan |
|---|---|---|
| Tamu | Pengunjung yang belum login | Melihat katalog dan checkout. |
| Member | Pembeli yang sudah login | Semua yang boleh dilakukan Tamu, ditambah melihat Riwayat Pesanan dan mengelola profilnya. |
| Admin | Pengelola toko | Mengelola katalog, Item stok, voucher, Pesanan, dan Member lewat dasbor admin. |

Semua Admin punya hak yang sama. Tidak ada peran staf dengan hak terbatas.

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

### 2.3 Kewenangan Admin atas Member

- Daftar Member menampilkan email, tanggal daftar, jumlah Pesanan Selesai, dan total belanja. Total belanja dihitung seperti Pendapatan (§9.3), dari Pesanan Member itu saja.
- Admin bisa membuka Riwayat Pesanan setiap Member.
- Admin bisa menonaktifkan Member dan mengaktifkannya kembali. Member nonaktif tidak bisa login, dan checkout baru dengan emailnya ditolak.
- Admin tidak bisa melihat atau mengubah password Member.

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

### 5.8 Pembatalan dan kedaluwarsa

- Pembeli bisa membatalkan Pesanan yang masih Menunggu Pembayaran. QRIS-nya ikut dibatalkan di Qrispy, lalu Item stok dan kuota voucher dilepas.
- Bila Qrispy menolak pembatalan karena tagihan sudah dibayar, Pesanan diproses sebagai sudah dibayar.
- Masa berlaku QRIS ditentukan Qrispy, yaitu 15 menit, dan Qrispy memberi waktu kedaluwarsanya. Pesanan yang belum dibayar menjadi Kedaluwarsa begitu waktu itu tercapai, lalu Item stok dan kuota voucher dilepas. Pembeli boleh checkout lagi dari awal.
- Contoh: QRIS terbit pukul 10.00.00 dengan waktu kedaluwarsa 10.15.00. Pukul 10.14.59 Pesanan masih Menunggu Pembayaran. Pukul 10.15.00 Pesanan sudah Kedaluwarsa.

▶ Keputusan 2026-11-12 (#87):
- Tombol "Batalkan" langsung membatalkan, tanpa dialog konfirmasi. Setelah itu Pembeli tetap di Tautan Pesanan dan melihat Halaman Pesanan Dibatalkan, beserta tautan "Checkout lagi".
- Bila Qrispy menolak pembatalan karena tagihan sudah dibayar, Pembeli melihat Halaman Pesanan Selesai disertai pesan "Pembayaran Anda sudah masuk, jadi Pesanan tidak dibatalkan."
- Saat waktu kedaluwarsa tercapai, toko memeriksa status QRIS ke Qrispy sekali. Bila pemeriksaan itu gagal, misalnya Qrispy tidak menjawab, Pesanan tetap menjadi Kedaluwarsa tepat waktu. Pembayaran yang ternyata sudah masuk diproses belakangan sebagai kabar terlambat (§5.9).

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

### 7.2 Daftar tanpa membeli

Orang boleh mendaftar Member dari halaman Daftar tanpa membeli lebih dulu. Caranya sama: membuat password, lalu memasukkan Kode verifikasi (§7.3).

### 7.3 Kode verifikasi

- Setelah password dibuat, sistem mengirim Kode verifikasi 6 digit ke email itu.
- Kode verifikasi berlaku 10 menit sejak dikirim. Tepat 10 menit setelah dikirim, kode sudah tidak berlaku.
- Akun Member baru aktif, dan Riwayat Pesanannya baru tertaut, setelah Kode verifikasi yang benar dimasukkan. Sebelum itu akun Member tidak bisa dipakai login.
- Contoh: kode dikirim pukul 10.00. Kode masih diterima pukul 10.09, dan ditolak pukul 10.11.

### 7.4 Riwayat Pesanan

- Riwayat Pesanan Member berisi semua Pesanan yang emailnya sama dengan email Member, termasuk Pesanan yang dibuat sebelum ia menjadi Member.
- Email dianggap sama tanpa membedakan huruf besar dan kecil, dan tanpa spasi di awal atau akhir. Contoh: `Budi@Mail.com` sama dengan `budi@mail.com`.
- Semua status Pesanan tampil, dengan Pesanan terbaru di atas.

### 7.5 Login dan lupa password

- Member login dengan email dan password. Password minimal 8 karakter.
- Untuk lupa password, sistem mengirim tautan atur ulang ke email. Tautan itu berlaku 30 menit sejak dikirim dan hanya bisa dipakai sekali. Tepat 30 menit setelah dikirim, tautan sudah tidak berlaku.
- Tidak ada login dengan Google atau layanan lain.

▶ Keputusan 2026-11-11: Member tetap login selama 30 hari sejak login. Setelah itu Member diminta login ulang. (Sebelumnya OD-2.)

### 7.6 Dasbor Member

- Dasbor Member berisi Riwayat Pesanan, dengan Item stok yang bisa dibuka dan disalin; profil untuk mengganti password; dan tombol keluar.
- Email Member tidak bisa diganti, karena email itulah yang menautkan Pesanan.
- Tidak ada fitur hapus akun.

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

### 8.5 Menghitung pemakaian

- Pemakaian Voucher dihitung dari Pesanan berstatus Menunggu Pembayaran, Selesai, atau Bermasalah yang memakai Voucher itu.
- Pesanan Kedaluwarsa, Dibatalkan, dan Dana Dikembalikan tidak dihitung, sehingga kuotanya kembali.
- Kuota voucher dan Batas per email sama-sama memakai hitungan ini. Batas per email menghitung Pesanan dengan email yang sama menurut §7.4.
- Contoh: Kuota voucher tersisa 1, dan Pesanan Andi yang memakai Voucher itu sedang Menunggu Pembayaran. Budi ditolak dengan pesan "Kuota voucher habis". Bila Pesanan Andi menjadi Kedaluwarsa, Budi bisa memakai Voucher itu.

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

### 8.8 Kelola voucher

- Admin bisa membuat, mengubah, menonaktifkan, dan mengaktifkan kembali Voucher.
- Admin melihat jumlah pemakaian setiap Voucher menurut §8.5.
- Voucher yang pernah tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan, tidak bisa dihapus, hanya dinonaktifkan.
- Mengubah syarat Voucher tidak mengubah Pesanan yang sudah dibuat.

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

### 9.5 Daftar dan detail Pesanan

- Daftar Pesanan menampilkan Nomor Pesanan, waktu dibuat, email, Produk dan Varian, Total bayar, status, dan tanda "Email gagal" bila ada.
- Admin bisa menyaring menurut status dan rentang tanggal, serta mencari menurut email atau Nomor Pesanan.
- Detail Pesanan menampilkan rincian nominal (§5.5), Item stok, dan riwayat perubahan status.
- Aksi di detail Pesanan: kirim ulang email dan koreksi email (§6.4), serta menyelesaikan Pesanan Bermasalah (§5.9).

▶ Keputusan 2026-11-12 (#87):
- Saringan rentang tanggal memakai waktu Pesanan dibuat, yaitu waktu yang tampil di daftar.
- Pencarian boleh berisi sebagian email atau sebagian Nomor Pesanan, tanpa membedakan huruf besar dan kecil. Contoh: "budi" dan "BUDI" menemukan Pesanan `budi@mail.com`. Nomor Pesanan lengkap tetap menemukan tepat Pesanan itu.

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

### 9.9 Yang tidak dibuat di dasbor admin

Log aktivitas Admin, ekspor CSV, dan notifikasi email ke Admin.

## 10. Email

### 10.1 Layanan dan pengirim

- Email dikirim lewat Resend. Toko mulai di paket gratis, yang dibatasi 100 email per hari dan 3.000 per bulan. Pemilik menaikkan ke paket berbayar bila rata-rata email harian sudah di atas sekitar 80.
- Email dikirim dari domain toko yang sudah diverifikasi di Resend. Pengirimnya tampil sebagai `MIWE Digital Store <no-reply@domain-toko>`. Nama domainnya masih keputusan terbuka (OD-1).
- Email tidak bisa dibalas.

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

▶ Keputusan 2026-11-11: Sebelum M2, keempat tab sudah tampil dengan isi berikut.
- **Riwayat:** penjelasan bahwa Tautan Pesanan ada di email "Pesanan selesai", tanpa ajakan login.
- **Akun:** tombol kontak WhatsApp, serta tautan ke halaman Syarat & Ketentuan dan Kebijakan Privasi.
- Bilah atas belum punya tombol Masuk.

Login, Daftar, dan dasbor Member ditambahkan di M2 sesuai tabel di atas.

▶ Keputusan 2026-11-11 (#53):
- Tab Riwayat untuk Tamu berjudul "Riwayat Pesanan" dan berisi kalimat: "Setiap Pesanan Selesai punya Tautan Pesanan di email "Pesanan selesai". Buka tautan itu untuk melihat dan menyalin Item stok tanpa login."
- Tab Kategori berisi daftar Kategori. Setiap Kategori membuka Beranda yang sudah disaring menurut Kategori itu, bukan halaman Kategori tersendiri.

### 11.2 Animasi navbar

- Navbar atas mengecil dan mendapat bayangan saat halaman digulir.
- Penanda tab aktif di navigasi bawah bergeser halus saat tab berpindah.
- Navigasi bawah bersembunyi saat halaman digulir ke bawah, dan muncul lagi saat digulir ke atas.
- Semua animasi dimatikan bila perangkat pengguna menyalakan pengaturan "kurangi gerakan".

### 11.3 Mode gelap

- Tampilan mengikuti mode terang atau gelap di perangkat.
- Tab Akun punya tombol untuk mengganti mode. Pilihan itu diingat di perangkat tersebut dan mengalahkan pengaturan perangkat.

### 11.4 Pasang seperti aplikasi

- Pembeli bisa memasang toko lewat "Tambahkan ke layar utama". Setelah dipasang, toko terbuka dengan ikon dan layar pembuka sendiri, tanpa bilah alamat browser.
- Toko tidak bisa dipakai saat offline dan tidak mengirim notifikasi push.

### 11.5 Sistem desain

- Warna, logo, huruf, dan gaya komponen ditetapkan di `docs/DESIGN.md`, yang disusun lewat `/impeccable`.
- `docs/DESIGN.md` wajib selaras dengan PRD ini dan wajib terisi sebelum tiket tampilan pertama dikerjakan.

## 12. Server dan data

- Aplikasi berjalan di satu VPS lewat Docker Compose dan hanya bisa diakses lewat HTTPS.
- Database dicadangkan otomatis setiap hari. Tujuh cadangan terakhir disimpan, dan cadangan yang lebih lama dihapus.
- Isi Item stok disimpan terenkripsi di database.

## 13. Milestone

| Milestone | Nama | Isi | Bagian PRD |
|---|---|---|---|
| M1 | Toko bisa berjualan | Login Admin; Kategori, Produk, Varian, dan Item stok; beranda dan halaman Produk; checkout dengan QRIS Qrispy; Penahanan dan status Pesanan; Pesanan Bermasalah; halaman Pesanan dan Tautan Pesanan; email Pesanan selesai; daftar Pesanan dan Item stok di dasbor admin; pengaturan toko; tampilan responsif dengan navbar dan navigasi bawah; siap dipasang di VPS | §2.1, §2.2, §3, §4, §5, §6, §7.7 (login Admin), §9.1, §9.5–§9.9, §10, §11.1, §11.5, §12 |
| M2 | Member dan Voucher | Daftar dan Kode verifikasi; login dan lupa password; Riwayat Pesanan; dasbor Member; Admin mengelola Member; Voucher; ringkasan dasbor admin | §2.3, §7, §8, §9.2–§9.4 |
| M3 | Sentuhan aplikasi | Animasi navbar, mode gelap, dan pasang seperti aplikasi | §11.2–§11.4 |

Setelah M1, toko sudah bisa dipakai berjualan sungguhan. Sebelum M2, form checkout belum punya isian kode voucher, dan halaman Pesanan belum menampilkan ajakan membuat akun.

▶ Keputusan 2026-11-11: Isi M1 disesuaikan sebagai berikut.
- Isian Ambang stok menipis di pengaturan toko (§9.8) pindah ke M2, bersama daftar Stok menipis (§9.4) yang memakainya.
- M1 juga memuat data seed untuk UAT sesuai "Persiapan bersama" di `docs/UAT.md`, tanpa Member dan Voucher.
- Pemasangan di VPS (§12) dikerjakan lewat dua tiket: penyiapan server, domain, dan akun layanan oleh pemilik, lalu deploy otomatis oleh agent.
- Integrasi Qrispy mengikuti `docs/referensi/qrispy-api.md` dan ADR-0004.
