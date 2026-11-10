---
name: MIWE Digital Store
description: Toko akun digital yang hidup di jam senja; setiap pembelian selesai sebelum matahari tenggelam.
colors:
  langit: "#2A1F4D"
  langit-2: "#3A2D66"
  langit-garis: "#5B4A92"
  langit-teks: "#E9E2FF"
  langit-redup: "#C7BDEA"
  monogram: "#8F61FF"
  aksi: "#7548F2"
  aksi-tekan: "#6236DE"
  aksi-teks: "#6A3FE0"
  teks-di-aksi: "#FFFFFF"
  matahari: "#EBC967"
  persik: "#ED9065"
  persik-teks: "#3A1D0E"
  mauve: "#9F5F70"
  tanah: "#F7F3FC"
  permukaan: "#FFFFFF"
  permukaan-2: "#EFE9FA"
  garis: "#E4DCF5"
  tinta: "#1E1838"
  tinta-redup: "#625879"
  st-tunggu-bg: "#FFF1C9"
  st-tunggu: "#6E4B00"
  st-selesai-bg: "#DAF3E5"
  st-selesai: "#18603E"
  st-kedaluwarsa-bg: "#ECE7F2"
  st-kedaluwarsa: "#554D68"
  st-batal-bg: "#ECEDF0"
  st-batal: "#4E5460"
  st-masalah-bg: "#FCE0DD"
  st-masalah: "#9C2820"
  st-kembali-bg: "#DFE8FC"
  st-kembali: "#22448F"
  langit-gelap: "#231A42"
  langit-2-gelap: "#33295C"
  langit-garis-gelap: "#4E4180"
  aksi-teks-gelap: "#B49BFF"
  tanah-gelap: "#15112A"
  permukaan-gelap: "#211A3D"
  permukaan-2-gelap: "#2C2350"
  garis-gelap: "#3A2F63"
  tinta-gelap: "#F3EEFF"
  tinta-redup-gelap: "#B9AFD9"
  st-tunggu-bg-gelap: "#3B2F0E"
  st-tunggu-gelap: "#F2D27A"
  st-selesai-bg-gelap: "#11352A"
  st-selesai-gelap: "#7FDDB0"
  st-kedaluwarsa-bg-gelap: "#2A2440"
  st-kedaluwarsa-gelap: "#C2B9D8"
  st-batal-bg-gelap: "#26272E"
  st-batal-gelap: "#C1C5CE"
  st-masalah-bg-gelap: "#3E1B1B"
  st-masalah-gelap: "#FF9C94"
  st-kembali-bg-gelap: "#18244A"
  st-kembali-gelap: "#A4BCFF"
typography:
  monogram:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline-lebar:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  harga:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  nama-produk:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  teks-panjang:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  label-kecil:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  mikro:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
  angka-waktu:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  mono-nomor:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  mono-item:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "15px"
    fontWeight: 500
rounded:
  kecil: "10px"
  kontrol: "12px"
  input: "14px"
  foto: "16px"
  kartu: "20px"
  besar: "24px"
  chip: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  tombol-utama:
    backgroundColor: "{colors.aksi}"
    textColor: "{colors.teks-di-aksi}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "0 24px"
    height: "52px"
  tombol-utama-hover:
    backgroundColor: "{colors.aksi-tekan}"
  tombol-utama-nonaktif:
    backgroundColor: "{colors.permukaan-2}"
    textColor: "{colors.tinta-redup}"
  tombol-garis:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.input}"
    padding: "0 24px"
    height: "52px"
  tombol-kecil:
    rounded: "{rounded.kecil}"
    padding: "0 12px"
    height: "36px"
  tombol-langit:
    backgroundColor: "{colors.langit}"
    textColor: "{colors.langit-teks}"
    rounded: "{rounded.chip}"
    padding: "0 16px"
    height: "40px"
  chip-kategori:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 16px"
    height: "40px"
  chip-kategori-aktif:
    backgroundColor: "{colors.langit}"
    textColor: "{colors.teks-di-aksi}"
  label-hemat:
    backgroundColor: "{colors.persik}"
    textColor: "{colors.persik-teks}"
    typography: "{typography.mikro}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  label-habis:
    backgroundColor: "{colors.permukaan-2}"
    textColor: "{colors.tinta-redup}"
    typography: "{typography.mikro}"
    rounded: "{rounded.chip}"
    padding: "4px 8px"
  kartu-produk:
    backgroundColor: "{colors.permukaan}"
    rounded: "{rounded.kartu}"
    padding: "12px"
  kartu-unggulan:
    backgroundColor: "{colors.permukaan}"
    rounded: "{rounded.besar}"
    padding: "16px"
  panel:
    backgroundColor: "{colors.permukaan}"
    rounded: "{rounded.kartu}"
    padding: "16px"
  pilihan-varian:
    backgroundColor: "{colors.permukaan}"
    rounded: "{rounded.kartu}"
    padding: "16px"
  isian:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "0 16px"
    height: "52px"
  kotak-cari:
    textColor: "{colors.langit-teks}"
    rounded: "{rounded.foto}"
    padding: "0 16px"
    height: "48px"
  status-menunggu:
    backgroundColor: "{colors.st-tunggu-bg}"
    textColor: "{colors.st-tunggu}"
    typography: "{typography.label-kecil}"
    rounded: "{rounded.chip}"
    padding: "0 12px 0 8px"
    height: "28px"
  status-selesai:
    backgroundColor: "{colors.st-selesai-bg}"
    textColor: "{colors.st-selesai}"
  status-kedaluwarsa:
    backgroundColor: "{colors.st-kedaluwarsa-bg}"
    textColor: "{colors.st-kedaluwarsa}"
  status-dibatalkan:
    backgroundColor: "{colors.st-batal-bg}"
    textColor: "{colors.st-batal}"
  status-bermasalah:
    backgroundColor: "{colors.st-masalah-bg}"
    textColor: "{colors.st-masalah}"
  status-dana-dikembalikan:
    backgroundColor: "{colors.st-kembali-bg}"
    textColor: "{colors.st-kembali}"
  blok-item-stok:
    backgroundColor: "{colors.langit}"
    textColor: "{colors.langit-teks}"
    rounded: "{rounded.besar}"
    padding: "8px 16px"
  tombol-salin:
    backgroundColor: "{colors.langit-2}"
    textColor: "{colors.langit-teks}"
    rounded: "{rounded.kontrol}"
    padding: "0 12px"
    height: "40px"
  tombol-salin-tersalin:
    backgroundColor: "{colors.st-selesai-bg}"
    textColor: "{colors.st-selesai}"
  navigasi-bawah:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.tinta-redup}"
    typography: "{typography.mikro}"
    height: "76px"
  bilah-atas:
    backgroundColor: "{colors.langit}"
    textColor: "{colors.langit-teks}"
    height: "64px"
  bilah-atas-ciut:
    height: "52px"
  penanda-surya:
    backgroundColor: "{colors.matahari}"
    width: "28px"
    height: "14px"
  toast:
    backgroundColor: "{colors.langit}"
    textColor: "{colors.teks-di-aksi}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "12px 16px"
---

# Sistem Desain Akun Digital

Berkas ini mencatat sistem yang sudah dibangun dan divalidasi di prototipe `docs/design/prototipe/index.html` (ponsel 390 px dan desktop 1440 px, mode terang dan gelap). Frontmatter di atas adalah sumber nilai yang mengikat. Teks di bawahnya menjelaskan kapan dan mengapa nilai itu dipakai.

**Agent memakai token dari berkas ini, bukan nilai warna langsung.** Kode aplikasi menulis `bg-aksi`, `text-tinta-redup`, atau `var(--st-selesai)`, tidak pernah `#7548F2`. Satu-satunya tempat yang boleh memegang hex mentah adalah pelukis pemandangan senja (lihat Components), karena warnanya hasil interpolasi kunci langit, bukan warna antarmuka.

## Overview

**Creative North Star: "Langit Senja"**

Toko ini hidup di jam senja. Bagian atas setiap layar adalah langit malam-ungu yang memuat monogram MDS dan pemandangan gunung yang dilukis dengan kode. Di bawahnya terbentang tanah yang tenang: lavender pucat di mode terang, malam pekat di mode gelap. Di tanah itu kartu putih bersudut bulat melayang dengan bayangan ungu yang lembut. Matahari menjadi satu-satunya tanda yang bergerak di sistem ini. Ia menandai tab aktif, dan di Halaman bayar ia tenggelam mengikuti sisa waktu QRIS.

Kepadatannya kepadatan aplikasi belanja di ponsel. Ruangnya cukup untuk satu jempol: kontrol utama setinggi 52 px, chip 40 px, dan modul jarak 8 px. Huruf Manrope tebal dengan angka tabular membuat harga, Stok Varian, Total bayar, dan hitung mundur tidak menggeser tata letak saat angkanya berganti. Rasa percaya datang dari rincian yang jujur, bukan dari hiasan. Arah ini menolak grid kartu putih berheader ungu khas toko top-up, juga gradien ungu-neon yang berpendar.

**Key Characteristics:**
- Langit ungu malam di atas, tanah tenang di bawah, kartu bulat di antaranya.
- Pemandangan senja buatan kode, tidak memakai foto. Gradien hanya ada di langit dan kabut pemandangan.
- Matahari menjadi penanda tab aktif dan jam hitung mundur.
- Manrope tebal dengan angka tabular. JetBrains Mono hanya untuk Item stok dan Nomor Pesanan.
- Status selalu tampil sebagai warna, ikon, dan label sekaligus.
- Mode terang dan gelap setara. Keduanya divalidasi.

## Colors

Palet ini terdiri dari langit ungu-malam, satu ungu aksi untuk tindakan, aksen hangat senja untuk matahari dan hemat, serta tanah lavender netral. Setiap token punya pasangan mode gelap dengan akhiran `-gelap`. Token yang tidak punya pasangan bernilai sama di kedua mode.

### Primary
- **Ungu Aksi** (`aksi`): latar tombol utama dan penanda terpilih (radio Varian, garis isian yang fokus). Teks putih di atasnya mencapai 5,3:1. Saat ditekan atau di-hover warnanya menjadi **Ungu Aksi Tekan** (`aksi-tekan`, 6,8:1 dengan putih).
- **Ungu Monogram** (`monogram`): warna monogram MDS dari `docs/input/logo.png`. Dipakai untuk monogram, cincin fokus, garis hover kartu dan chip, serta bingkai panel ajakan (`.ajakan`). Kontrasnya dengan putih hanya 3,9:1, jadi teks putih tidak pernah diletakkan di atasnya. Di atas `langit` ia hanya dipakai sebagai huruf tampilan besar (monogram 24 px atau lebih, tebal 800).
- **Ungu Tautan** (`aksi-teks` / `aksi-teks-gelap`): teks ungu di atas tanah atau permukaan, misalnya tautan Syarat & Ketentuan dan chip Kategori di Halaman Produk. Kontrasnya 5,6:1 di terang dan 7,9:1 di gelap.

### Secondary
- **Langit Malam** (`langit`, `langit-2`, `langit-garis`): latar bilah atas, pita langit, strip tepi, blok Item stok, chip Kategori aktif, dan toast. `langit-2` dipakai untuk hover di atas langit dan latar tombol Salin. `langit-garis` dipakai untuk garis di atas langit.
- **Teks Langit** (`langit-teks`, `langit-redup`): teks di atas langit. `langit-redup` (8,5:1) dipakai untuk placeholder, subjudul monogram, dan tautan navbar yang tidak aktif.

### Tertiary
- **Emas Matahari** (`matahari`): hanya untuk penanda tab aktif berbentuk matahari terbit.
- **Persik Senja** (`persik` dengan `persik-teks`, 6,5:1): label "Hemat N%". Persik tidak dipakai untuk teks di atas tanah.
- **Mauve Lembah** (`mauve`): petak warna pengganti foto Produk di prototipe.

### Neutral
- **Tanah** (`tanah` / `tanah-gelap`): latar halaman dan latar bilah lekat. Kabut pemandangan memudar ke warna ini.
- **Permukaan** (`permukaan` / `permukaan-gelap`): kartu, panel, isian, navigasi bawah, dan tombol garis.
- **Permukaan Lembut** (`permukaan-2` / `permukaan-2-gelap`): tombol nonaktif, label Habis, chip Kategori di Halaman Produk, dan latar kontrol segmen.
- **Garis** (`garis` / `garis-gelap`): garis 1,5 px di isian, chip, dan tombol garis, serta garis 1 px di navigasi bawah dan bilah lekat.
- **Tinta** (`tinta`, `tinta-redup` dan pasangan gelapnya): teks utama dan teks sekunder. `tinta-redup` mencapai 6,0:1 di atas tanah terang dan 8,9:1 di atas tanah gelap.

### Pemetaan ke Tailwind 4 dan shadcn/ui
Token dideklarasikan sebagai CSS custom property di `:root` dan ditimpa di `@media (prefers-color-scheme: dark)` serta `[data-mode="gelap"]`. Tailwind 4 membacanya lewat `@theme inline` (`--color-langit: var(--langit)`, `--color-aksi: var(--aksi)`, dan seterusnya). Variabel shadcn dipetakan ke token yang sama:

| Variabel shadcn | Token |
|---|---|
| `--background` | `tanah` |
| `--foreground` | `tinta` |
| `--card`, `--popover` | `permukaan` |
| `--card-foreground`, `--popover-foreground` | `tinta` |
| `--primary` | `aksi` |
| `--primary-foreground` | `teks-di-aksi` |
| `--secondary`, `--muted`, `--accent` | `permukaan-2` |
| `--secondary-foreground`, `--accent-foreground` | `tinta` |
| `--muted-foreground` | `tinta-redup` |
| `--destructive` | `st-masalah` |
| `--border`, `--input` | `garis` |
| `--ring` | `monogram` |
| `--radius` | `rounded.input` (14 px) |

Token di luar pemetaan ini (`langit*`, `matahari`, `persik*`, `st-*`) dipakai dengan namanya sendiri.

### Named Rules
**Aturan Dua Ungu.** Teks putih hanya diletakkan di atas `aksi` atau `aksi-tekan`, tidak pernah di atas `monogram`. `monogram` adalah warna merek untuk monogram dan huruf tampilan besar, bukan latar tombol.

**Aturan Gradien Senja.** Gradien hanya ada di langit dan kabut pemandangan senja. Teks, tombol, kartu, chip, dan panel selalu berwarna datar. Efek kaca (backdrop-filter, blur di belakang permukaan) tidak dipakai di mana pun.

## Typography

**Display Font:** Manrope (fallback system-ui, sans-serif)
**Body Font:** Manrope (fallback system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (fallback ui-monospace, monospace)

**Character:** Manrope tebal yang dirapatkan memberi suara aplikasi yang hangat dan tegas. JetBrains Mono menandai data yang disalin pembeli kata demi kata.

Di aplikasi, kedua font dimuat lewat `next/font/google` (Manrope 400–800, JetBrains Mono 500 dan 700) sebagai variabel `--font-manrope` dan `--font-jetbrains`. Variabel itu dipetakan ke `--font-sans` dan `--font-mono` di `@theme`. Prototipe memakai tautan Google Fonts hanya karena berupa HTML statis. Seluruh `body` memakai `font-variant-numeric: tabular-nums`.

### Hierarchy
- **Monogram** (800, 28 px; 24 px saat bilah ciut; jarak huruf −0,045em): monogram MDS di bilah atas, berwarna `monogram`. Di layar lebar diikuti "MIWE Digital Store" dalam `label-kecil` warna `langit-redup`.
- **Headline** (800, 28 px di ponsel, 36 px mulai 900 px, tinggi baris 1,15): judul halaman, satu per layar.
- **Title** (800, 22 px, tinggi baris 1,2): judul bagian seperti "Produk Unggulan" dan "Semua Produk", dengan jarak 32 px di atas dan 16 px di bawah.
- **Harga** (800, 18 px; 22 px di kartu Unggulan; 28 px di Halaman Produk dengan satu Varian): Harga jual.
- **Nama Produk** (800, 16 px; 20 px di kartu Unggulan).
- **Body** (400, 16 px, tinggi baris 1,5): teks umum. Isian juga memakai 16 px supaya iOS tidak memperbesar layar.
- **Teks panjang** (400, 15 px, tinggi baris 1,6, lebar maksimal 65ch): deskripsi Produk dan ketentuan garansi.
- **Label** (700, 14 px): label isian, chip, dan tombol kecil. **Label kecil** (700, 13 px): Stok Varian, meta, dan teks bantuan. **Mikro** (800, 12 px): Hemat, Habis, dan label navigasi bawah.
- **Angka waktu** (800, 36 px di ponsel, 48 px di layar lebar, tinggi baris 1): hitung mundur QRIS.
- **Mono nomor** (JetBrains Mono 700, 30 px): Nomor Pesanan sebagai kepala Halaman Pesanan. Di panel Halaman bayar ukurannya 20 px, dan di daftar Riwayat 13 px.
- **Mono item** (JetBrains Mono 500, 15 px, `overflow-wrap: anywhere`): nilai Item stok.

### Named Rules
**Aturan Mono untuk Data Salinan.** JetBrains Mono hanya dipakai untuk nilai Item stok dan Nomor Pesanan. Harga, tanggal, dan label tetap Manrope, termasuk tanggal yang bersebelahan dengan Nomor Pesanan di Riwayat.

**Aturan Angka Bersel Tetap.** Stok Varian, Harga jual, Total bayar, dan hitung mundur memakai angka tabular, jadi pergantian angka tidak menggeser tata letak.

## Layout

**Modul.** Semua jarak adalah kelipatan 8 px (8, 16, 24, 32). Langkah 4 px dan 12 px hanya dipakai di dalam komponen, misalnya celah ikon dan padding kartu Produk. Halaman memakai padding samping 16 px dan lebar isi maksimal 1120 px yang diletakkan di tengah.

**Ponsel (di bawah 900 px)**
- Bilah atas lekat 64 px, berisi monogram MDS di kiri dan tombol Masuk (atau nama Member) di kanan. Halaman dalam menampilkan tombol kembali dan judul halaman.
- Beranda: pita langit 236 px dengan kotak cari 48 px, lalu chip Kategori yang bisa digeser ke samping, kartu Produk Unggulan, dan grid kartu Produk dua kolom dengan celah 16 px. Urutannya mengikuti PRD §3.6, dan tidak ada banner promo.
- Halaman lain: strip tepi langit 44 px di bawah bilah.
- Navigasi bawah 76 px dengan empat tab (Beranda, Kategori, Riwayat, Akun) sesuai PRD §11.1, ditambah `safe-area-inset-bottom`.
- Isi halaman diberi padding bawah 112 px. Halaman yang punya bilah lekat diberi 216 px supaya isi terakhir tidak tertutup.

**Layar lebar (mulai 900 px)**
- Navigasi bawah hilang. Empat tab yang sama pindah ke navbar atas di sebelah monogram (PRD §11.1).
- Pita langit 320 px, strip tepi 56 px.
- Grid Produk empat kolom dengan celah 24 px. Kartu Unggulan menjadi tiga kolom: foto 240 px, info, lalu daftar Varian dengan garis pemisah.
- Halaman Produk, Checkout, bayar, Pesanan, Riwayat Tamu, dan Akun memakai dua kolom sama lebar dengan celah 32 px. Bilah lekat menjadi blok statis biasa di kolomnya.

**Gerak responsif (PRD §11.2).** Begitu halaman digulir lebih dari 24 px, bilah atas mengecil dari 64 ke 52 px dan mendapat bayangan. Navigasi bawah bersembunyi saat digulir ke bawah melewati 120 px, lalu muncul lagi saat digulir ke atas. Bilah lekat ikut turun ke dasar layar. Easing standarnya `cubic-bezier(.16,1,.3,1)`. Semua transisi dan animasi dimatikan di bawah `prefers-reduced-motion: reduce`.

**Target ukuran.** Lebar terkecil yang didukung 360 px, tanpa gulir ke samping (PRD §11.1). Target sentuh terkecil 36 px (tombol kecil). Kontrol utama 52 px.

## Elevation & Depth

Kedalaman datang dari dua lapis: langit yang gelap di atas tanah yang terang, dan kartu yang melayang dengan bayangan ungu lembut berjarak. Bayangan selalu negatif-spread dan berwarna ungu langit di mode terang, sedangkan di mode gelap bayangan menjadi hitam pekat. Tidak ada bayangan keras bergeser (offset tanpa blur).

### Shadow Vocabulary
- **Bayang** (`0 8px 24px -12px rgba(42,31,77,.38)`; gelap `0 10px 26px -12px rgba(0,0,0,.65)`): kartu, panel, gambar QR, kartu senja, dan segmen terpilih.
- **Bayang naik** (`0 14px 32px -14px rgba(42,31,77,.5)`; gelap `0 16px 34px -14px rgba(0,0,0,.75)`): kartu yang di-hover (terangkat 2 px, hanya di perangkat `hover:hover`) dan toast.
- **Bayang bilah** (`0 10px 24px -14px rgba(20,14,40,.7)`): bilah atas saat ciut.
- **Bayang lekat** (`0 -10px 20px -18px rgba(42,31,77,.45)`): bilah lekat di atas navigasi bawah.
- **Cincin fokus** (`outline: 3px solid monogram; outline-offset: 2px`): semua elemen dengan `:focus-visible`. Isian memakai garis `aksi` ditambah halo `0 0 0 3px` dari `monogram` 30%.

### Named Rules
**Aturan Bayangan Berjarak.** Bayangan kartu selalu lembut, lebar, dan menjauh dari tepi. Kartu tidak diberi garis tepi. Garis hanya untuk kontrol (isian, chip, tombol garis, pilihan Varian).

## Shapes

Bentuknya bulat dan bersahabat, dengan radius yang naik sesuai besarnya permukaan:
- **Pil** (999 px): chip Kategori, label Hemat dan Habis, pil status, tombol di atas langit, dan toast.
- **Kecil** (10 px) dan **kontrol** (12 px): tombol kecil, segmen, tombol kembali, tombol Salin, dan tautan navbar atas.
- **Isian** (14 px): tombol 52 px, isian, kontrol segmen, dan kotak bantuan prototipe.
- **Foto** (16 px): foto Produk di dalam kartu, gambar QR, dan kotak cari.
- **Kartu** (20 px): kartu Produk, panel, pilihan Varian, dan baris Riwayat.
- **Besar** (24 px): kartu Produk Unggulan, foto besar di Halaman Produk, kartu senja di Halaman bayar, dan blok Item stok.

Garis kontrol setebal 1,5 px. Pilihan Varian memakai 2 px supaya keadaan terpilih terbaca. Satu-satunya siluet yang bukan persegi bulat adalah setengah lingkaran matahari terbit pada penanda tab aktif.

## Components

Ikon di aplikasi berasal dari `lucide-react`, berukuran 24 px dengan stroke 2 (16 px dengan stroke 2,4 di pil status, 18 px di tombol Salin dan segmen). Sprite SVG di prototipe digambar tangan meniru glif lucide. Padanannya: Beranda `House`, Kategori `LayoutGrid`, Riwayat `History`, Akun `User`, cari `Search`, kembali `ChevronLeft`, Salin `Copy`, tersalin `Check`, simpan QR `Download`, WhatsApp `MessageCircle`, garansi `ShieldCheck`, mode `Smartphone`/`Sun`/`Moon`, dan Tautan Pesanan `Ticket`. Ikon status ada di bagian Status Pesanan. Komponen dibangun di atas primitif shadcn/ui (Radix) dan diberi token dari berkas ini. Toast memakai `sonner`.

### Buttons
- **Bentuk:** sudut membulat lembut (14 px), tinggi 52 px, padding samping 24 px, Manrope 800 16 px, ikon di kiri dengan celah 8 px.
- **Utama:** latar `aksi`, teks putih. Saat hover latarnya menjadi `aksi-tekan`, dan saat ditekan tombol mengecil ke skala 0,98. Saat nonaktif latarnya `permukaan-2` dan teksnya `tinta-redup`, misalnya tombol "Habis" di Halaman Produk. Satu tombol utama per layar.
- **Garis:** latar `permukaan`, garis 1,5 px `garis`, teks `tinta`. Saat hover garisnya berubah menjadi `monogram`. Dipakai untuk aksi kedua: Batalkan, Pakai voucher, Daftar, dan WhatsApp.
- **Kecil:** 36 px, radius 10 px, 14 px.
- **Tombol langit:** pil 40 px dengan garis `langit-garis` di atas langit (Masuk atau nama Member). Saat hover latarnya `langit-2`.

### Chips
- **Chip Kategori:** pil 40 px, latar `permukaan`, garis 1,5 px `garis`, teks label. Saat hover garisnya `monogram`. Chip yang terpilih (`aria-pressed`) berlatar `langit` dengan teks putih. Deret chip bisa digeser ke samping sampai tepi layar.
- **Label Hemat:** pil `persik` dengan teks `persik-teks`, "Hemat N%" (PRD §3.5).
- **Label Habis:** pil `permukaan-2` dengan teks `tinta-redup` (PRD §3.4).

### Cards / Containers
- **Kartu Produk:** radius 20 px, latar `permukaan`, padding 12 px, Bayang. Isinya foto sampul (112 px, 148 px di layar lebar), nama, harga, lalu baris banding (Harga normal dicoret, Hemat, atau Habis). Seluruh kartu adalah tautan ke Halaman Produk. Kartu tidak menampilkan angka stok gabungan.
- **Kartu Produk habis:** foto diberi grayscale 85% dan opasitas 55%, harga menjadi `tinta-redup`, dan label Habis tampil (PRD §3.4, §3.8).
- **Kartu Produk Unggulan:** radius 24 px dan naik satu anak tangga ukuran (nama 20 px, harga 22 px), tanpa lencana tambahan. Di layar lebar kartu ini menampilkan daftar Varian beserta Harga normal yang dicoret atau label Habis.
- **Panel:** radius 20 px, padding 16 px, Bayang, dengan jarak 16 px antar-panel. Dipakai untuk deskripsi, garansi, rincian Total bayar, dan ringkasan Pesanan. Panel ajakan (Buat akun, PRD §7.1) diberi bingkai 2 px `monogram`.
- **Rincian Total bayar** (PRD §5.5): tabel 15 px berisi Harga jual, Potongan voucher, Kode unik, dan Total bayar, dengan nilai rata kanan. Baris Total bayar dipisah garis putus 1,5 px dan berukuran 20 px tebal 800. Di Checkout, Kode unik belum diketahui, jadi barisnya berbunyi "Rp 1–499, dari Qrispy" dan totalnya "Perkiraan bayar".

#### Keputusan teknis: harga di kartu Produk "Mulai Rp X"
Harga normal yang dicoret dan "Hemat N%" diambil dari Varian yang menjadi sumber harga "Mulai", yaitu Varian aktif ber-stok dengan Harga jual termurah (PRD §3.8). Contoh: YouTube Premium dengan "1 Bulan" habis dan "3 Bulan" Rp 55.000 (Harga normal Rp 65.000) tampil "Mulai Rp 55.000 · ~~Rp 65.000~~ · Hemat 15%". Bila semua Varian aktif habis, harga diambil dari Varian termurah di antara semua Varian aktif. Harga normalnya tetap dicoret, tetapi label Hemat diganti label Habis. Kartu tidak menampilkan angka stok gabungan, hanya label "Habis" bila semua Varian aktif habis (PRD §3.4, §3.5, §3.8). Angka Stok Varian baru tampil di Halaman Produk.

### Inputs / Fields
- **Isian:** tinggi 52 px, radius 14 px, latar `permukaan`, garis 1,5 px `garis`, teks 16 px. Label berada di atas isian (14 px, tebal 700, jarak 8 px), dan teks bantuan di bawahnya (13 px, `tinta-redup`).
- **Fokus:** garis menjadi `aksi`, ditambah halo 3 px `monogram` 30%.
- **Galat:** garis `st-masalah`, dan teks bantuan diganti pesan galat 13 px tebal berwarna `st-masalah` dengan ikon `TriangleAlert`. Isian diberi `aria-invalid`. Pesan sukses voucher berwarna `st-selesai`.
- **Isian gabung:** isian kode voucher (huruf kapital) dengan tombol garis "Pakai" di sebelahnya (PRD §8).
- **Kotak cari:** 48 px, radius 16 px, di atas pita langit, berlatar langit gelap pekat 78% dengan garis tipis. Kotak ini bukan efek kaca karena tidak ada blur. Saat fokus muncul cincin `monogram`.
- **Pilihan Varian** (radiogroup, PRD §3.2–§3.4): kartu 20 px bergaris 2 px. Kolomnya berisi radio 24 px, nama Varian dan "Stok N", lalu Harga jual dengan Harga normal yang dicoret dan Hemat. Varian terpilih bergaris `aksi`, berlatar `monogram` 9% di atas `permukaan`, dan titik radionya `aksi`. Varian habis bertulisan "Habis", beropasitas 60%, dan tidak bisa dipilih. Produk dengan satu Varian tidak menampilkan pilihan ini, melainkan harga 28 px dan "Stok N".
- **Kontrol segmen mode** (PRD §11.3): tiga pilihan, yaitu Perangkat, Terang, dan Gelap, di wadah `permukaan-2` radius 14 px. Pilihan aktif berlatar `permukaan` dengan Bayang.

### Navigation
- **Bilah atas:** latar `langit`, lekat di atas, 64 px, dan ciut ke 52 px dengan Bayang bilah saat digulir. Monogram ikut mengecil dari 28 ke 24 px.
- **Navigasi bawah (di bawah 900 px):** 76 px, latar `permukaan`, garis atas 1 px `garis`. Empat tab berisi ikon 24 px dan label mikro. Tab tidak aktif berwarna `tinta-redup`, tab aktif `tinta` dengan `aria-current="page"`.
- **Navbar atas (mulai 900 px):** empat tautan 40 px, 15 px tebal 700, berwarna `langit-redup`. Saat hover latarnya `langit-2`, dan tab aktif berwarna putih.
- **Bilah lekat:** aksi utama Halaman Produk, Checkout, dan Halaman bayar menempel di atas navigasi bawah (`bottom: 76px`). Latarnya `tanah` yang pekat dengan garis atas dan Bayang lekat. Padding-nya 12/16/26 px. Padding bawah 26 px menyediakan ruang bagi matahari penanda yang naik 13 px di atas garis navigasi. Saat navigasi bawah bersembunyi, bilah lekat turun ke dasar layar dengan padding bawah 12 px.
- **Dasbor admin** (PRD §9, §11.1): menu samping di layar lebar, menu lipat di ponsel, tanpa navigasi bawah. **Belum divalidasi oleh build.** Dasbor ini mewarisi token dan komponen di berkas ini dengan kepadatan Operate: baris tabel yang padat, kontrol 36–40 px, panel 20 px, dan pil status yang sama.

### Penanda tab aktif: matahari terbit (komponen khas)
Setengah lingkaran `matahari` (28×14 px, radius `14px 14px 0 0`) dengan pendar `0 -2px 14px 3px` emas 55%. Ia duduk di garis atas navigasi bawah, di tengah tab aktif, seolah matahari terbit dari cakrawala. Saat tab berpindah, ia bergeser sejauh satu lebar tab dalam 0,45 dtk dengan easing standar (PRD §11.2). Di navbar atas, ukurannya 20×10 px dan duduk di tepi bawah bilah langit, di bawah tautan aktif. Penanda ini `aria-hidden`, karena keadaan aktif sudah disampaikan oleh `aria-current`. Saat gerak dikurangi, ia langsung melompat ke posisi baru.

### Pemandangan senja (komponen khas)
Pemandangan ini adalah komponen yang dilukis dengan kode sebagai SVG, bukan foto, supaya tetap tajam di semua layar dan bisa bergerak. Di Next.js ia menjadi client component yang melukis ulang saat ukuran wadah atau mode berubah. Isinya:
- **Langit:** gradien vertikal empat kunci, yaitu atas, tengah (42%), bawah (78%), dan cakrawala. Setiap kunci diinterpolasi terhadap waktu `t`: 0 = sore keemasan, 0,5 = matahari menyentuh punggung gunung, 1 = malam. Kunci atas di pita dan strip tepi memakai token `langit` supaya menyatu dengan bilah.
- **Matahari:** cakram `#FFF1C4` dengan pendar radial dan cahaya ufuk elips. Posisi vertikalnya turun dari 30% ke 60% ke 110% tinggi, dan pendarnya meredup dari 0,95 ke 0.
- **Awan:** enam guratan elips tipis yang dikaburkan dan menyala hangat di dekat matahari.
- **Bintang:** 46 titik putih yang memudar masuk saat `t` di atas 0,6.
- **Punggung gunung:** lima lapis dari midpoint displacement dengan benih tetap (LCG), 128 segmen, dan kurva kuadratik halus. Lapis jauh lebih halus (kekasaran 0,40), lebih pucat, dan lebih berkabut di lembah, dan dua lapis terjauh dikaburkan tipis. Lapis dekat lebih kasar (0,62) dan lebih gelap seperti siluet. Path dilebarkan 5% melewati tepi supaya tidak ada baji di pinggir.
- **Kabut lembah:** gradien dari transparan ke warna tanah (`tanah` di pita dan strip, `permukaan` di kartu bayar), jadi pemandangan larut ke halaman tanpa garis batas.
- **Butiran:** tekstur derau 96 px dengan `mix-blend-mode: soft-light` dan opasitas 0,28 (0,14 di strip tepi). Supaya hasil SSR dan hidrasi cocok, derau dibuat di klien.

Pemakaiannya:
- **Pita langit Beranda** (236/320 px): lima lapis, cakrawala di 50%, matahari di 72% lebar. `t` ≈ 0,16 di mode terang dan ≈ 0,82 di mode gelap (senja akhir berbintang).
- **Strip tepi halaman dalam** (44/56 px): cakrawala pendek tiga lapis dengan amplitudo 0,5, tanpa matahari, bintang, atau awan.
- **Kartu senja Halaman bayar** (136/280 px, radius 24 px, PRD §5.6): hitung mundur QRIS menggerakkan `t` dari 0 (15:00) sampai 1 (00:00). Matahari menyentuh punggung gunung sekitar 07:30, lalu malam berbintang tiba saat waktu habis. Angka waktu dan Total bayar ditulis di atas langit. Warnanya berganti antara `#2A1F4D` dan putih mengikuti luminans langit, supaya kontrasnya selalu minimal 4,5:1. Pembaca layar mendapat sisa menit lewat `aria-live` sekali per menit, bukan setiap detik. Saat waktu habis, labelnya menjadi "QRIS kedaluwarsa".

Pemandangan ini menggantikan aturan lama "lapisan gunung berwarna datar" atas instruksi pemilik pada 2026-11-11.

### Status Pesanan (PRD §5.7)
Setiap status adalah pil setinggi 28 px dengan ikon 16 px, label 13 px tebal 800, dan padding `0 12px 0 8px`. Warna, ikon, dan label selalu tampil bersama, tidak pernah warna saja. Labelnya memakai nama status persis seperti di GLOSSARY. Semua pasangan mencapai minimal 6,1:1.

| Status | Ikon lucide | Terang (latar / teks) | Gelap (latar / teks) |
|---|---|---|---|
| Menunggu Pembayaran | `Clock` | `st-tunggu-bg` / `st-tunggu` | `st-tunggu-bg-gelap` / `st-tunggu-gelap` |
| Selesai | `Check` | `st-selesai-bg` / `st-selesai` | `st-selesai-bg-gelap` / `st-selesai-gelap` |
| Kedaluwarsa | `Hourglass` | `st-kedaluwarsa-bg` / `st-kedaluwarsa` | `st-kedaluwarsa-bg-gelap` / `st-kedaluwarsa-gelap` |
| Dibatalkan | `CircleX` | `st-batal-bg` / `st-batal` | `st-batal-bg-gelap` / `st-batal-gelap` |
| Bermasalah | `TriangleAlert` | `st-masalah-bg` / `st-masalah` | `st-masalah-bg-gelap` / `st-masalah-gelap` |
| Dana Dikembalikan | `RotateCcw` | `st-kembali-bg` / `st-kembali` | `st-kembali-bg-gelap` / `st-kembali-gelap` |

Pil status muncul di Halaman bayar (Menunggu Pembayaran, di samping Nomor Pesanan), di kepala Halaman Pesanan, dan di setiap baris Riwayat Pesanan (PRD §7.4). Baris Riwayat adalah kartu 20 px yang memuat pil status, Total bayar rata kanan, Produk dan Varian, serta Nomor Pesanan dalam mono 13 px diikuti tanggal WIB dalam Manrope. Urutannya terbaru di atas.

Status Item stok (Tersedia, Ditahan, Terkirim) hanya tampil di dasbor admin, dan belum diprototipekan. Statusnya memakai anatomi pil yang sama: warna, ikon, dan label. Pemetaan token dan ikonnya ditetapkan saat dasbor admin dibangun, dan wajib berbeda jelas dari status Pesanan di layar yang sama.

### Blok Item stok dan tombol Salin (PRD §6.1, §6.2)
Halaman Pesanan dikepalai label "Nomor Pesanan" dan Nomor Pesanan dalam mono 30 px. Item stok tampil dalam blok `langit` radius 24 px. Setiap kolom Format Item stok menjadi satu baris berisi nama kolom (12 px `langit-redup`), nilai mono 15 px putih, dan tombol Salin 40 px (`langit-2`, garis `langit-garis`, hover `monogram`). Setelah diketuk, tombol berubah menjadi "Tersalin" dengan ikon `Check` dan warna `st-selesai` selama 1,6 dtk. Tamu yang membuka Riwayat diberi penjelasan bahwa Tautan Pesanan ada di email "Pesanan selesai", dengan ikon `Ticket`.

### Toast
Pil `langit` dengan teks putih 14 px tebal 700 dan Bayang naik. Toast muncul 96 px dari dasar layar di ponsel (di atas navigasi bawah) dan 32 px di layar lebar, lalu hilang setelah 1,8 dtk. Toast diumumkan lewat `role="status"`. Di aplikasi, toast memakai `sonner` dengan gaya ini.

### Foto Produk
Di prototipe, foto Produk diganti petak warna berisi huruf awal nama Produk. Petak itu pengganti sementara, bukan bagian dari sistem. Di aplikasi, foto diunggah Admin (PRD §3.3), dipotong mengisi bingkai radius 16 px (24 px di Halaman Produk), dan foto pertama menjadi sampul kartu.

## Do's and Don'ts

### Do:
- **Do** pakai token dari berkas ini lewat utilitas Tailwind atau `var(--…)`. Jangan menulis hex di komponen.
- **Do** letakkan teks putih hanya di atas `aksi` (5,3:1) atau `aksi-tekan`, dan pakai `monogram` untuk monogram, cincin fokus, garis hover, dan huruf tampilan besar.
- **Do** tampilkan setiap status Pesanan sebagai pil dengan warna, ikon lucide, dan label sekaligus.
- **Do** pakai angka tabular untuk Harga jual, Stok Varian, Total bayar, dan hitung mundur.
- **Do** pakai JetBrains Mono hanya untuk nilai Item stok dan Nomor Pesanan.
- **Do** ambil Harga normal yang dicoret dan Hemat di kartu "Mulai Rp X" dari Varian ber-stok yang menjadi sumber harga itu (PRD §3.8).
- **Do** letakkan aksi utama di bilah lekat berlatar `tanah` pekat di atas navigasi bawah pada layar di bawah 900 px.
- **Do** matikan semua transisi dan animasi, termasuk pergeseran matahari dan penggulungan navigasi, di bawah `prefers-reduced-motion: reduce`.
- **Do** jaga jarak dalam kelipatan 8 px, dan pakai 4 atau 12 px hanya di dalam komponen.

### Don't:
- **Don't** letakkan teks putih di atas `monogram` (3,9:1), termasuk warna sorotan teks (`::selection`).
- **Don't** pakai gradien di luar langit dan kabut pemandangan senja: tidak di teks, tombol, kartu, chip, atau panel.
- **Don't** pakai efek kaca (backdrop-filter) di mana pun.
- **Don't** ganti pemandangan senja dengan foto. Pemandangan itu dilukis dengan kode supaya tajam dan bisa menjadi jam hitung mundur.
- **Don't** tampilkan angka stok gabungan di kartu Produk. Kartu hanya menampilkan "Habis" bila semua Varian aktif habis.
- **Don't** tampilkan status hanya dengan warna.
- **Don't** tambahkan testimoni, rating, jumlah Pembeli, atau logo layanan pihak ketiga. Nama layanan hanya muncul sebagai nama Produk.
- **Don't** pakai bayangan keras bergeser, dan jangan beri garis tepi pada kartu.
