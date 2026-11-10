---
version: 1
slug: "docs-design-prototipe-index-html"
primary_target: "docs/design/prototipe/index.html"
related_targets: []
---

# Alur beli di ponsel (prototipe sistem desain)

## Scope

- Mode: Operate. Pembeli menyelesaikan pembelian.
- Layar: Beranda → Halaman Produk → Halaman bayar → Halaman Pesanan Selesai, ditambah tab Kategori, Riwayat (enam status Pesanan), dan Akun (tombol mode gelap). Ada navigasi bawah di ponsel dan navbar atas di layar lebar.
- Prototipe statis, di luar kode aplikasi. Isinya contoh buatan. Aturan dan istilah mengikuti `docs/PRD.md` §3, §5, §6, §7, §11, dan `GLOSSARY.md`.

## Audience and job

Pelajar dan anak muda di ponsel, sering malam hari, membuka tautan dari media sosial. Mereka memilih Varian, membayar QRIS dalam 15 menit dari aplikasi e-wallet di ponsel yang sama, lalu menyalin Item stok.

## Constraints

- Teks putih hanya di atas ungu aksi #7548F2, bukan di atas ungu monogram #8F61FF (kontras 3,9:1).
- Semua animasi mati saat "kurangi gerakan" menyala.
- Status Pesanan selalu ditunjukkan dengan warna, ikon, dan label bersama-sama.
- Tidak ada testimoni, rating, atau logo layanan pihak ketiga.

## Direction contract

THESIS: Toko yang hidup di jam senja: setiap pembelian selesai sebelum matahari tenggelam. Arah ini menolak grid kartu putih berheader ungu khas toko top-up, juga gradien ungu-neon yang berpendar.

OWN-WORLD:
- **Langit:** pemandangan senja realistis yang dilukis dengan kode, tanpa foto. Isinya langit bergradasi dari ungu-malam #2A1F4D ke emas cakrawala, matahari berpendar, guratan awan tipis, dan lima lapis punggung gunung berkontur alami (midpoint displacement). Lapis yang jauh makin pucat dan berkabut di lembahnya, kabut terdepan menyatu dengan warna tanah, dan ada butiran halus seperti foto.
- **Mode gelap:** senja akhir dengan bintang samar.
- **Tanah:** lavender pucat #F7F3FC di mode terang, malam #15112A di mode gelap.
- **Ungu:** aksi #7548F2, monogram #8F61FF.
- **Huruf:** Manrope tebal dengan angka tabular. JetBrains Mono hanya untuk Item stok dan Nomor Pesanan.
- **Kartu:** sudut bulat 20–24 px dengan bayangan ungu yang lembut dan berjarak.
- **Larangan:** gradien hanya dipakai di langit dan kabut pemandangan. Tidak ada gradien di teks, tombol, atau kartu, dan tidak ada efek kaca.

▶ Perubahan atas instruksi pemilik (2026-11-11): lapisan gunung berwarna datar diganti pemandangan yang tampak nyata. Pemilik memilih "pemandangan realistis buatan kode", bukan foto logo, supaya tetap tajam di semua layar dan matahari tetap bisa bergerak sebagai hitung mundur.

STORY: Pembeli melihat harga, Harga normal yang dicoret, dan Stok Varian dengan jelas. Ia memilih Varian, membayar sebelum "matahari" tenggelam, lalu menyalin Item stok. Rasa percaya datang dari rincian Total bayar yang jujur dan Nomor Pesanan yang jelas.

FIRST VIEWPORT:
- **Beranda 390 px:** bilah lekat 64 px berisi monogram MDS di kiri dan tombol Masuk di kanan, lalu pita langit 236 px berisi kotak cari 48 px di atas pemandangan senja.
- **Di bawah pita:** chip Kategori, satu kartu lebar Produk Unggulan, dan kartu Produk dua kolom.
- **Navigasi bawah:** setinggi 76 px.
- **Pita langit:** setinggi 236 px di ponsel dan 320 px di desktop.
- **Aksi utama:** mengetuk kartu Produk.
- **Tanda khas:** matahari kecil menjadi penanda tab aktif dan bergeser saat tab berpindah. Di Halaman bayar, hitung mundur QRIS memutar seluruh pemandangan dari sore keemasan (15:00) sampai matahari menyentuh punggung gunung (sekitar 07:30) lalu malam berbintang (00:00).

FORM: Langit Senja, kandidat ke-7 dari tujuh kandidat berurut. seed: 88efef26d7aeb7db

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raised from declined challengers

- **Angka bersel tetap** (papan split-flap): Stok Varian, hitung mundur, dan Total bayar memakai angka tabular yang berganti tanpa menggeser tata letak.
- **Nomor Pesanan sebagai identitas** (katalog Factory): halaman Pesanan dikepalai Nomor Pesanan dalam huruf mono besar.
- **Satu modul** (spesimen Crouwel): semua jarak memakai kelipatan 8 px, dan kartu Produk berada di sel dua kolom yang sama.
- **Tangga ukuran tetap** (atlas bintang): Produk Unggulan naik satu anak tangga ukuran, bukan ditambah lencana.

## Unresolved

- Belum ada foto Produk sungguhan. Prototipe memakai petak warna sebagai pengganti, dan Admin akan mengunggah fotonya (PRD §3.3).
- Dasbor admin belum diprototipekan. Dasbor admin mewarisi sistem ini dengan kepadatan Operate.
