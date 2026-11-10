# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Sudah diputuskan di `docs/adr/0001-stack.md`: Next.js App Router, TypeScript strict, Tailwind 4, shadcn/ui (Radix), lucide-react, dan tw-animate-css, dengan PostgreSQL. Dependency hanya boleh dari `.github/dependency-allowlist.txt`.

## Users

- **Pembeli utama:** anak muda dan pelajar yang mencari akun premium aplikasi dan game, misalnya streaming dan musik, dengan harga terjangkau. Hampir semuanya berbelanja dari ponsel dan membayar dengan QRIS dari aplikasi e-wallet di ponsel yang sama.
- **Tugas mereka:** memilih Produk dan Varian, membayar dalam 15 menit, lalu langsung memakai Item stok yang diterima. Setelah itu sesekali membuka Riwayat Pesanan untuk menyalin lagi data akunnya.
- **Admin:** pemilik toko dan orang kepercayaannya. Mereka mengisi Item stok, mengelola katalog dan Voucher, dan menyelesaikan Pesanan Bermasalah, dari laptop maupun ponsel.

## Product Purpose

MIWE Digital Store adalah toko web untuk menjual akun digital yang berjalan sendiri. Pembeli membayar dengan QRIS lewat Qrispy, dan Item stok terkirim otomatis di layar dan lewat email tanpa menunggu Admin. Berhasil berarti pembelian selesai kapan pun tanpa campur tangan Admin, dan Pembeli kembali membeli karena prosesnya cepat dan bisa dipercaya. Aturan lengkapnya ada di `docs/PRD.md`.

## Positioning

Pembeli memilih MIWE karena empat hal sekaligus:
- harga murah, dengan Voucher;
- pengiriman otomatis 24 jam;
- rasa aman: ada ketentuan garansi dan Riwayat Pesanan tersimpan;
- layanan WhatsApp yang cepat bila ada masalah.

Mekanisme pembedanya adalah pengiriman otomatis dari Item stok begitu QRIS terbayar. Toko sejenis yang masih melayani lewat chat tidak bisa menjanjikan hal yang sama.

## Operating Context

- Pembeli datang di ponsel, sering dari tautan media sosial, dan berharap toko terasa seperti aplikasi: navigasi bawah, bisa dipasang ke layar utama (PRD §11).
- Pembayaran memakai QRIS di ponsel yang sama. Pembeli menyimpan gambar QR, lalu membukanya dari aplikasi e-wallet (PRD §5.6).
- QRIS berlaku 15 menit, jadi halaman bayar selalu dalam keadaan menunggu dengan hitung mundur.
- Admin bekerja di dasbor admin dengan daftar panjang: Pesanan, Item stok, dan Voucher.

## Capabilities and Constraints

- Fitur dan istilah mengikuti `docs/PRD.md` dan `GLOSSARY.md`. Contoh istilahnya: Produk, Varian, Item stok, Pesanan, Voucher, Member, dan Tamu. Kata "akun" sendirian tidak dipakai sebagai istilah.
- Ada enam status Pesanan: Menunggu Pembayaran, Selesai, Kedaluwarsa, Dibatalkan, Bermasalah, dan Dana Dikembalikan.
- Ada tiga status Item stok: Tersedia, Ditahan, dan Terkirim.
- Bahasa Indonesia saja, rupiah saja, dan zona waktu WIB.
- Mode gelap mengikuti perangkat, dan ada tombol ganti di tab Akun.
- Semua animasi mati bila "kurangi gerakan" menyala.

## Brand Commitments

- Nama toko: **MIWE Digital Store**.
- Logo ada di `docs/input/logo.png`: monogram **MDS** dengan tulisan "MIWE DIGITAL STORE", keduanya berwarna ungu lavender **#8F61FF** (diambil dari piksel logo). Monogram itu wajib dipakai apa adanya.
- Di berkas logo, monogram itu diletakkan di atas foto pegunungan saat senja yang bergradasi kuning #EBC967, oranye persik #ED9065, dan ungu kemerahan #9F5F70. Foto itu latar penyajian, bukan bagian dari monogram. Pemilik belum menetapkannya sebagai warna merek.
- Selain ungu monogram, warna merek belum ditetapkan.

## Evidence on Hand

- Belum ada testimoni, jumlah Pembeli, rating, atau logo mitra. Semua itu tidak boleh dikarang.
- Nama layanan pihak ketiga, misalnya Netflix atau Spotify, hanya muncul sebagai nama Produk yang diisi Admin, bukan sebagai logo atau klaim kemitraan.

## Product Principles

1. **Barang yang sudah dibayar langsung sampai.** Tidak ada langkah yang menahan Item stok setelah pembayaran masuk.
2. **Harga dan rincian selalu jelas.** Harga jual, potongan voucher, Kode unik, dan Total bayar tampil apa adanya.
3. **Ponsel lebih dulu.** Setiap alur harus nyaman diselesaikan dengan satu jempol di layar 360 piksel.
4. **Status tidak pernah ambigu.** Pembeli dan Admin selalu tahu Pesanan sedang di tahap mana, dan apa langkah berikutnya.
5. **Terasa terpercaya tanpa klaim palsu.** Rasa aman datang dari kejelasan, garansi tertulis, dan WhatsApp yang mudah dijangkau, bukan dari angka atau testimoni karangan.

## Accessibility & Inclusion

- Teks dan kontrol tetap terbaca dan tersentuh nyaman di ponsel murah dengan layar kecil.
- Kontras memenuhi WCAG AA di mode terang dan gelap.
- Hormati `prefers-reduced-motion`.
