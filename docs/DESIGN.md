---
name: MIWE Digital Store
description: Toko akun digital yang tampil seperti buku sketsa; kertas hangat, garis pensil, dan catatan post-it.
colors:
  kertas: "#FDFBF7"
  permukaan: "#FFFFFF"
  kertas-lama: "#E5E0D8"
  pensil: "#2D2D2D"
  pensil-redup: "#5F5A54"
  spidol: "#FF4D4D"
  aksi: "#D63031"
  teks-di-aksi: "#FFFFFF"
  pulpen: "#2D5DA1"
  teks-di-pulpen: "#FFFFFF"
  postit: "#FFF9C4"
  teks-postit: "#2D2D2D"
  matahari: "#FFD84D"
  bayang: "#2D2D2D"
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
  kertas-gelap: "#1E1C19"
  permukaan-gelap: "#2A2723"
  kertas-lama-gelap: "#3A3631"
  pensil-gelap: "#EDE7DB"
  pensil-redup-gelap: "#B5AD9F"
  spidol-gelap: "#FF6B6B"
  aksi-gelap: "#FF7B72"
  teks-di-aksi-gelap: "#1E1C19"
  pulpen-gelap: "#8DB4F0"
  teks-di-pulpen-gelap: "#1E1C19"
  postit-gelap: "#EFE6A6"
  matahari-gelap: "#F5CF5A"
  bayang-gelap: "#000000"
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
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.15
  headline-lebar:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
  judul-kecil:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  harga:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  nama-produk:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  tombol:
    fontFamily: "Patrick Hand, Comic Sans MS, cursive"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: "Patrick Hand, Comic Sans MS, cursive"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  teks-panjang:
    fontFamily: "Patrick Hand, Comic Sans MS, cursive"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Patrick Hand, Comic Sans MS, cursive"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.2
  bantuan:
    fontFamily: "Patrick Hand, Comic Sans MS, cursive"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  label-kecil:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
  mikro:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
  angka-waktu:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
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
  coret: "255px 15px 225px 15px / 15px 225px 15px 255px"
  coret-md: "15px 255px 15px 225px / 225px 15px 255px 15px"
  coret-alt: "225px 25px 255px 20px / 20px 255px 25px 225px"
  coret-bulat: "52% 48% 55% 45% / 47% 55% 45% 53%"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  tombol:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    typography: "{typography.tombol}"
    rounded: "{rounded.coret}"
    padding: "0 24px"
    height: "52px"
  tombol-hover:
    backgroundColor: "{colors.aksi}"
    textColor: "{colors.teks-di-aksi}"
  tombol-nonaktif:
    backgroundColor: "{colors.kertas-lama}"
    textColor: "{colors.pensil-redup}"
  tombol-kedua:
    backgroundColor: "{colors.kertas-lama}"
    textColor: "{colors.pensil}"
    typography: "{typography.tombol}"
    rounded: "{rounded.coret}"
    padding: "0 24px"
    height: "52px"
  tombol-kedua-hover:
    backgroundColor: "{colors.pulpen}"
    textColor: "{colors.teks-di-pulpen}"
  tombol-kecil:
    typography: "{typography.label}"
    rounded: "{rounded.coret}"
    padding: "0 14px"
    height: "40px"
  chip:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    typography: "{typography.label}"
    rounded: "{rounded.coret}"
    padding: "0 16px"
    height: "40px"
  chip-terpilih:
    backgroundColor: "{colors.postit}"
    textColor: "{colors.teks-postit}"
  label-hemat:
    backgroundColor: "{colors.postit}"
    textColor: "{colors.teks-postit}"
    typography: "{typography.mikro}"
    rounded: "{rounded.coret}"
    padding: "4px 10px"
  label-habis:
    textColor: "{colors.pensil-redup}"
    typography: "{typography.mikro}"
    rounded: "{rounded.coret}"
    padding: "4px 10px"
  kartu:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    rounded: "{rounded.coret-md}"
    padding: "16px"
  kartu-produk:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    rounded: "{rounded.coret-md}"
    padding: "12px"
  kartu-unggulan:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    rounded: "{rounded.coret-md}"
    padding: "16px"
  kartu-postit:
    backgroundColor: "{colors.postit}"
    textColor: "{colors.teks-postit}"
    rounded: "{rounded.coret-md}"
    padding: "16px"
  pilihan-varian:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    rounded: "{rounded.coret-md}"
    padding: "16px"
  isian:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    typography: "{typography.body}"
    rounded: "{rounded.coret-alt}"
    padding: "0 16px"
    height: "52px"
  isian-baca-saja:
    backgroundColor: "{colors.kertas-lama}"
    textColor: "{colors.pensil}"
  kotak-cari:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    typography: "{typography.body}"
    rounded: "{rounded.coret-alt}"
    padding: "0 16px 0 48px"
    height: "52px"
  status-menunggu:
    backgroundColor: "{colors.st-tunggu-bg}"
    textColor: "{colors.st-tunggu}"
    typography: "{typography.label-kecil}"
    rounded: "{rounded.coret}"
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
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    rounded: "{rounded.coret-md}"
    padding: "8px 16px"
  tombol-salin:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil}"
    typography: "{typography.label}"
    rounded: "{rounded.coret}"
    padding: "0 14px"
    height: "40px"
  tombol-salin-tersalin:
    backgroundColor: "{colors.st-selesai-bg}"
    textColor: "{colors.st-selesai}"
  navigasi-bawah:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.pensil-redup}"
    typography: "{typography.mikro}"
    height: "76px"
  bilah-atas:
    backgroundColor: "{colors.kertas}"
    textColor: "{colors.pensil}"
    height: "64px"
  bilah-atas-ciut:
    height: "52px"
  penanda-matahari:
    backgroundColor: "{colors.matahari}"
    width: "28px"
    height: "14px"
  toast:
    backgroundColor: "{colors.postit}"
    textColor: "{colors.teks-postit}"
    typography: "{typography.label}"
    rounded: "{rounded.coret}"
    padding: "12px 16px"
---

# Sistem Desain Akun Digital

Berkas ini mencatat tema "Coretan Tangan". Sumber visualnya ada dua: acuan gaya dari pemilik di `docs/design/acuan-coretan-tangan.md`, dan token serta kelas komponen yang sudah dibangun di `src/app/globals.css`. **Baca acuan itu sebelum membuat atau mengubah tampilan apa pun.** Frontmatter di atas adalah sumber nilai yang mengikat, dan nilainya sama persis dengan `:root` di `globals.css`. Teks di bawahnya menjelaskan kapan dan mengapa nilai itu dipakai. Bila acuan dan berkas ini berbeda, berkas ini yang berlaku, karena ia sudah menyesuaikan acuan dengan PRD: mode gelap, ukuran sentuh, Item stok, dan status.

Prototipe `docs/design/prototipe/index.html` milik tema lama "Langit Senja" dan bukan lagi acuan visual. Blok keputusan (▶) lama yang menyebut "prototipe" hanya merujuknya untuk teks, urutan, dan tata letak. Blok sebelum 2026-11-19 masih memakai nama token dan komponen lama; bacalah lewat bagian **Pemetaan dari token lama** di akhir berkas ini.

**Agent memakai token dari berkas ini, bukan nilai warna langsung.** Kode aplikasi menulis `bg-kertas`, `text-pensil-redup`, `border-pensil`, atau `var(--st-selesai)`, tidak pernah `#2D2D2D`. Hex hanya ada di `src/app/globals.css`, ditambah nilai `kertas` dan `kertas-gelap` di berkas JSON aplikasi terpasang (`src/app/manifest.json` dan warna bilah status), karena browser dan sistem ponsel tidak bisa membaca token CSS. Pelukis pemandangan juga memakai `var(--…)`.

**Dua bagian berkas ini dibaca test.** `e2e/token-desain.spec.ts` membaca blok `colors:` dan membandingkan setiap token dengan `var(--nama)` di browser, jadi setiap baris di blok itu berformat `  nama: "#RRGGBB"`, berurutan tanpa komentar dan tanpa baris kosong. `e2e/halaman-pesanan.spec.ts` membaca tabel di bagian Status Pesanan. Saat mengubah token, ubah frontmatter dan `:root` di `globals.css` bersamaan.

## Overview

**Creative North Star: "Buku Sketsa"**

Toko ini adalah buku sketsa milik penjualnya. Halamannya kertas hangat bertitik. Isinya ditulis dengan pensil, ditandai spidol merah, dicentang pulpen biru, dan ditempeli catatan post-it kuning. Kartu adalah potongan kertas yang ditempel dengan selotip atau paku payung, dan bayangannya tegas seperti kolase kertas guntingan. Tidak ada garis wadah yang benar-benar lurus: tepi kartu, tombol, isian, dan chip bergelombang seperti digambar tangan. Gunung dan matahari dari tema lama kini digambar sebagai sketsa pensil. Matahari kuning stabilo masih menandai tab aktif, dan di Halaman bayar ia tenggelam mengikuti sisa waktu QRIS.

Kesan coretan berhenti di data. Harga, Rincian Total bayar, form, dan tabel tetap tegak dan rata supaya mudah dibaca. Item stok dan Nomor Pesanan tetap memakai huruf mono, karena pembeli menyalinnya huruf demi huruf. Rasa santai datang dari bentuk, hiasan, dan huruf judul. Rasa percaya datang dari rincian yang jujur dan teks yang jelas terbaca.

**Key Characteristics:**
- Kertas hangat bertitik, garis pensil 2–3 px, dan tepi coretan tak beraturan.
- Bayangan bergeser tegas tanpa blur. Warna selalu datar.
- Kalam tebal untuk judul, Patrick Hand untuk isi, JetBrains Mono untuk Item stok dan Nomor Pesanan.
- Merah spidol untuk hiasan, merah `aksi` untuk teks merah dan tombol yang di-hover, biru pulpen untuk tautan dan fokus, kuning post-it untuk yang terpilih dan catatan.
- Rotasi kecil pada foto, label, dan hiasan. Form, tabel, dan teks panjang selalu tegak.
- Pemandangan gunung digambar sebagai sketsa pensil oleh kode.
- Status selalu tampil sebagai warna, ikon, dan label sekaligus.
- Mode terang dan mode gelap (buku sketsa malam) setara.

▶ Keputusan 2026-11-19: Atas instruksi pemilik, seluruh tema diganti ke gaya coretan tangan dengan acuan docs/design/acuan-coretan-tangan.md. Mode gelap dipertahankan sebagai buku sketsa malam (PRD §11.3). Pemandangan gunung dan matahari dipertahankan konsepnya dan digambar ulang sebagai sketsa. Layar pembuka, ikon, dan warna bilah status ponsel tetap `langit` #2A1F4D karena diikat PRD §11.4 sampai pemilik memutuskan lain.

▶ Keputusan 2026-11-20: Pemilik memutuskan warna ungu ikut diganti (PRD §11.4 ▶ Keputusan 2026-11-20). Ikon maskable dan layar pembuka kini berlatar `kertas`, bilah status Android mengikuti `kertas` atau `kertas-gelap` sesuai mode perangkat, dan bilah status iPhone memakai gaya bawaan. Token `langit` dihapus. Logo MDS tetap logo asli.

## Colors

Palet ini terbatas pada warna alat tulis: kertas, pensil, spidol merah, pulpen biru, dan kertas post-it, ditambah kuning stabilo untuk matahari dan warna status. Setiap token punya pasangan mode gelap berakhiran `-gelap`. Token tanpa pasangan (`teks-postit`) bernilai sama di kedua mode.

### Kertas dan pensil
- **Kertas** (`kertas`): latar halaman, bilah atas, pita Beranda, strip tepi, dan bilah lekat. `body` diberi pola titik `kertas-lama` 1 px setiap 24 px seperti buku catatan.
- **Permukaan** (`permukaan`): kartu, panel, isian, tombol utama, chip, dan navigasi bawah. Putih bersih di atas kertas yang sedikit krem.
- **Kertas Lama** (`kertas-lama`): tombol kedua, tombol nonaktif, isian baca-saja, wadah kontrol segmen, petak Produk tanpa foto, selotip, dan titik pola kertas.
- **Pensil** (`pensil`): teks utama dan semua garis tepi. Kontrasnya 13,3:1 di atas kertas. Warna ini tidak pernah hitam murni.
- **Pensil Redup** (`pensil-redup`): teks bantuan, meta, placeholder, tab tidak aktif, dan garis gunung jauh. Kontrasnya 6,6:1 di kertas dan 5,2:1 di kertas lama.
- **Bayang** (`bayang`): warna bayangan bergeser. Sama dengan pensil di mode terang, hitam di mode gelap.

### Merah
- **Spidol** (`spidol`): merah koreksi untuk hiasan: paku payung, garis bawah bergelombang, coretan, panah, dan lingkaran sorotan.
- **Merah Aksi** (`aksi` dengan `teks-di-aksi`): latar tombol yang di-hover, teks merah yang harus dibaca (pesan galat dan peringatan), dan garis isian yang galat. Kontrasnya 4,7:1 di kertas dan 4,9:1 di permukaan. Teks putih di atasnya mencapai 4,9:1.

### Pulpen
- **Biru Pulpen** (`pulpen` dengan `teks-di-pulpen`): tautan teks, cincin fokus, garis isian yang fokus, garis Varian terpilih, latar tombol kedua yang di-hover, dan burung di pita Beranda. Kontrasnya 6,4:1 di kertas, dan teks putih di atasnya 6,6:1.

### Kuning
- **Post-it** (`postit` dengan `teks-postit`): chip, segmen, dan Varian yang terpilih, label Hemat, toast, kartu catatan, dan sorotan teks (`::selection`). Pasangannya 12,9:1.
- **Matahari** (`matahari`): kuning stabilo untuk matahari dan bulan di pemandangan serta penanda tab aktif. Tidak pernah menjadi latar teks.

### Status
Token `st-*` dipakai pil status Pesanan (tabel di bagian Status Pesanan), pesan sukses (`st-selesai`), dan tombol Salin yang tersalin. Nilainya sama dengan tema lama. Setiap pasangan latar dan teks mencapai minimal 6,1:1 di kedua mode.

### Warna perangkat
- **Aplikasi terpasang** (PRD §11.4): `theme_color` dan `background_color` di manifest, latar ikon maskable, dan latar layar pembuka memakai `kertas` (#FDFBF7). Meta `theme-color` untuk bilah status Android mengikuti mode perangkat: `kertas` di terang dan `kertas-gelap` (#1E1C19) di gelap. Bilah status iPhone memakai gaya bawaan, jadi tidak ada zona `env(safe-area-inset-top)` yang perlu diwarnai. Layar pembuka dan ikon adalah gambar jadi, sehingga bila token `kertas` berubah, gambarnya dibuat ulang.

### Pemetaan ke Tailwind 4 dan shadcn/ui
Token dideklarasikan sebagai CSS custom property di `:root`. Pasangan `-gelap` menimpanya di `@media (prefers-color-scheme: dark)` pada `:root:not([data-mode="terang"])` dan di `:root[data-mode="gelap"]`. Tailwind 4 membacanya lewat `@theme inline` (`--color-kertas: var(--kertas)`, dan seterusnya), jadi utilitasnya `bg-kertas`, `text-pensil`, `border-pensil`, `bg-postit`, dan sejenisnya. Varian `dark:` mengikuti aturan yang sama, dan breakpoint `lebar:` adalah 900 px. Variabel shadcn dipetakan ke token yang sama:

| Variabel shadcn | Token |
|---|---|
| `--background` | `kertas` |
| `--foreground` | `pensil` |
| `--card`, `--popover` | `permukaan` |
| `--card-foreground`, `--popover-foreground` | `pensil` |
| `--primary` | `aksi` |
| `--primary-foreground` | `teks-di-aksi` |
| `--secondary`, `--muted` | `kertas-lama` |
| `--secondary-foreground` | `pensil` |
| `--muted-foreground` | `pensil-redup` |
| `--accent` | `postit` |
| `--accent-foreground` | `teks-postit` |
| `--destructive` | `aksi` |
| `--border`, `--input` | `pensil` |
| `--ring` | `pulpen` |

Variabel `--radius` tidak dipakai. Primitif shadcn diberi radius `rounded-coret-*` (lihat Shapes). Token di luar pemetaan ini (`spidol`, `pulpen`, `matahari`, `bayang`, `st-*`) dipakai dengan namanya sendiri.

### Named Rules
**Aturan Merah Dua Tingkat.** `spidol` (#FF4D4D) hanya untuk hiasan, karena kontrasnya dengan kertas hanya sekitar 3:1 (3,2:1). Teks merah yang harus dibaca dan latar merah yang bertulisan memakai `aksi` (4,7:1 di kertas), dengan `teks-di-aksi` di atasnya. Kelas `tombol` dan `isian` sudah mengikuti aturan ini.

**Aturan Pasangan Teks.** Setiap latar berwarna punya warna teksnya sendiri: `aksi` dengan `teks-di-aksi`, `pulpen` dengan `teks-di-pulpen`, `postit` dengan `teks-postit`, dan `st-*-bg` dengan `st-*`. `pensil` dan `pensil-redup` hanya dipakai di atas `kertas`, `permukaan`, atau `kertas-lama`. Teks merah (`aksi`) dan biru (`pulpen`) hanya dipakai di atas `kertas` atau `permukaan`, karena `aksi` di atas `kertas-lama` turun ke 3,7:1. Di dalam kartu post-it, semua teks mewarisi `teks-postit`, dan tautannya memakai `teks-postit` bergaris bawah. Alasannya mode gelap: post-it tetap kuning, sedangkan `pensil` berubah menjadi kapur yang hanya 1,03:1 di atas post-it.

**Aturan Warna Perangkat.** Warna yang dibaca browser dan sistem ponsel (manifest, `theme-color`, ikon, dan layar pembuka) memakai nilai `kertas` dan `kertas-gelap` yang sama persis dengan token. Ungu lama (#2A1F4D) tidak dipakai di mana pun.

## Mode gelap: buku sketsa malam

Mode gelap adalah buku sketsa yang dibuka di malam hari: kertas arang (`kertas-gelap`), garis dan tulisan kapur (`pensil-gelap`), dan potongan kertas yang sedikit lebih terang (`permukaan-gelap`). Mode ini dipertahankan karena PRD §11.3 mewajibkannya. Tampilan mengikuti mode perangkat, dan pilihan Perangkat, Terang, atau Gelap di tab Akun mengalahkannya.

- **Merah dan biru menjadi lebih terang** supaya terbaca di kertas arang: `aksi-gelap` 6,7:1 dan `pulpen-gelap` 8,0:1. Teks di atasnya berganti menjadi kertas arang (`teks-di-aksi-gelap`, `teks-di-pulpen-gelap`).
- **Post-it tetap kuning.** `postit-gelap` hanya sedikit diredam, dan `teks-postit` tetap pensil gelap, seperti catatan kertas di bawah lampu (10,9:1). Karena itu Aturan Pasangan Teks paling penting di mode ini.
- **Matahari sedikit diredam** (`matahari-gelap`). Di pita Beranda, bulan sabit dan bintang coretan menggantikan matahari.
- **Bayangan menjadi hitam pekat** (`bayang-gelap`), dan `bayang-halus` menjadi hitam 45%.
- **Pola titik kertas** memakai `kertas-lama-gelap`. Status memakai pasangan `st-*-gelap`.
- `teks-postit` tidak punya pasangan gelap.

Komponen cukup memakai token dan kelas dari `globals.css`, maka mode gelap berjalan sendiri. Periksa setiap layar baru di kedua mode.

## Typography

**Display Font:** Kalam 700 (fallback "Comic Sans MS", cursive)
**Body Font:** Patrick Hand 400 (fallback "Comic Sans MS", cursive)
**Data Font:** JetBrains Mono 500 dan 700 (fallback ui-monospace, monospace)

**Character:** Kalam tebal terlihat seperti spidol, cocok untuk judul dan angka yang ingin menonjol seperti catatan yang ditebalkan. Patrick Hand jelas tulisan tangan tetapi tetap terbaca di ukuran isi. JetBrains Mono menandai data yang disalin pembeli huruf demi huruf.

Ketiga font dimuat lewat `next/font/google` di `src/app/layout.tsx`: Patrick Hand 400 (`--font-patrick-hand`), Kalam 400 dan 700 (`--font-kalam`), serta JetBrains Mono 500 dan 700 (`--font-jetbrains`). `@theme inline` memetakannya ke utilitas `font-sans` dan `font-tangan` (Patrick Hand), `font-spidol` (Kalam), dan `font-mono` (JetBrains Mono). Base style di `globals.css` sudah mengatur `body` (Patrick Hand 18 px, tinggi baris 1,5, `tabular-nums`) serta `h1`–`h3` (Kalam 700, tinggi baris 1,15; `h1` 36 px, 48 px mulai 900 px).

Patrick Hand hanya punya tebal 400, dan browser memalsukan tebal lain. Penekanan memakai Kalam: `font-spidol font-bold`.

### Hierarchy
- **Monogram** (Kalam 700, 28 px; 24 px saat bilah ciut): monogram MDS di bilah atas, berwarna `pensil`. Di layar lebar diikuti "MIWE Digital Store" dalam `bantuan` berwarna `pensil-redup`.
- **Headline** (Kalam 700, 36 px di ponsel, 48 px mulai 900 px, tinggi baris 1,15): judul halaman `h1`, satu per layar.
- **Title** (Kalam 700, 28 px): judul bagian `h2` seperti "Produk Unggulan" dan "Semua Produk", dengan jarak 32 px di atas dan 16 px di bawah. Boleh diberi `garis-gelombang`.
- **Judul kecil** (Kalam 700, 22 px): judul panel dan nama Produk di kartu Unggulan.
- **Harga** (Kalam 700, 20 px; 24 px di kartu Unggulan; 32 px di Halaman Produk dengan satu Varian): Harga jual.
- **Nama Produk** (Kalam 700, 18 px; 22 px di kartu Unggulan).
- **Tombol** (Patrick Hand, 20 px): label tombol 52 px.
- **Body** (Patrick Hand, 18 px, tinggi baris 1,5): teks umum. Isian juga 18 px, jadi iOS tidak memperbesar layar.
- **Teks panjang** (Patrick Hand, 18 px, tinggi baris 1,6, lebar maksimal 65ch): deskripsi Produk dan ketentuan garansi.
- **Label** (Patrick Hand, 17 px): label isian, chip, tombol kecil, dan tabel Rincian Total bayar.
- **Bantuan** (Patrick Hand, 16 px): teks bantuan isian, pesan galat, Stok Varian, meta, dan nama kolom Item stok.
- **Label kecil** (Kalam 700, 15 px): pil status Pesanan dan pil sejenis di dasbor admin.
- **Mikro** (Kalam 700, 15 px): label Hemat, label Habis, dan label navigasi bawah.
- **Angka waktu** (Kalam 700, 36 px di ponsel, 48 px di layar lebar, tinggi baris 1): hitung mundur QRIS.
- **Mono nomor** (JetBrains Mono 700, 30 px): Nomor Pesanan sebagai kepala Halaman Pesanan. Di panel Halaman bayar ukurannya 20 px, dan di daftar Riwayat 15 px.
- **Mono item** (JetBrains Mono 500, 15 px, `overflow-wrap: anywhere`): nilai Item stok.

### Named Rules
**Aturan Mono untuk Data Salinan.** JetBrains Mono hanya dipakai untuk nilai Item stok dan Nomor Pesanan. Huruf tulisan tangan menyamarkan l, I, dan 1 serta 0 dan O, padahal pembeli menyalin kredensial itu huruf demi huruf dan menyebut Nomor Pesanan ke Admin. Harga, tanggal, dan label tetap huruf tulisan tangan, termasuk tanggal yang bersebelahan dengan Nomor Pesanan di Riwayat.

**Aturan Angka Bersel Tetap.** Stok Varian, Harga jual, Total bayar, dan hitung mundur memakai `tabular-nums` (sudah dipasang di `body`). Huruf tulisan tangan belum tentu punya angka tabular, jadi angka yang berganti di tempat, yaitu hitung mundur QRIS, diberi lebar tetap dalam satuan `ch` supaya pergantiannya tidak menggeser tata letak.

**Aturan Ukuran Tulisan Tangan.** Huruf tulisan tangan tampak lebih kecil dari ukurannya. Isi memakai 18 px, label 16–17 px, dan teks terkecil 15 px.

## Layout

**Modul.** Semua jarak adalah kelipatan 8 px (8, 16, 24, 32). Langkah 4 px dan 12 px hanya dipakai di dalam komponen, misalnya celah ikon dan padding kartu Produk. Halaman memakai padding samping 16 px dan lebar isi maksimal 1120 px yang diletakkan di tengah.

**Ponsel (di bawah 900 px)**
- Bilah atas lekat 64 px, berisi monogram MDS di kiri dan tombol Masuk (atau nama Member) di kanan. Halaman dalam menampilkan tombol kembali dan judul halaman.
- Beranda: pita Beranda 236 px dengan kotak cari, lalu chip Kategori yang bisa digeser ke samping, kartu Produk Unggulan, dan grid kartu Produk dua kolom dengan celah 16 px. Urutannya mengikuti PRD §3.6, dan tidak ada banner promo.
- Halaman lain: strip tepi 44 px di bawah bilah atas.
- Navigasi bawah 76 px dengan empat tab (Beranda, Kategori, Riwayat, Akun) sesuai PRD §11.1, ditambah `safe-area-inset-bottom`.
- Isi halaman diberi padding bawah 112 px. Halaman yang punya bilah lekat diberi 216 px supaya isi terakhir tidak tertutup.

**Layar lebar (mulai 900 px)**
- Navigasi bawah hilang. Empat tab yang sama pindah ke navbar atas di sebelah monogram (PRD §11.1).
- Pita Beranda 320 px, strip tepi 56 px.
- Grid Produk empat kolom dengan celah 24 px. Kartu Unggulan menjadi tiga kolom: foto 240 px, info, lalu daftar Varian dengan pemisah garis putus-putus.
- Halaman Produk, Checkout, bayar, dan Pesanan memakai dua kolom sama lebar (`tata-dua-kolom`, celah 48 px). Bilah lekat menjadi blok statis biasa di kolomnya.
- Navbar atas terbagi tiga zona dengan jarak yang jelas: monogram dan nama toko di kiri, empat tab di tengah, dan tombol Masuk (atau nama Member) di kanan.

### Tata letak halaman

▶ Keputusan 2026-11-20: Atas permintaan pemilik, tata letak semua halaman diaudit karena isi halaman menempel di kiri dengan ruang kosong besar di kanan, dan navbar terlalu rapat dengan nama toko. Aturan di bawah ini menggantikan susunan kolom lama untuk Riwayat Tamu dan Akun, termasuk ▶ Keputusan 2026-11-11 (#53) tentang judul dan panel penjelasan Riwayat Tamu di kolom kiri.

**Aturan Tengah untuk Satu Kolom.** Isi yang hanya satu kolom selalu diletakkan di tengah ruang yang tersedia, dengan judul halaman di dalam kolom yang sama. Isi yang lebar memakai grid yang mengisi lebar. Tidak ada halaman, di toko maupun dasbor admin, yang isinya menempel di kiri dengan ruang kosong besar di kanan.

Setiap halaman memakai salah satu dari empat pola berikut. Kelasnya ada di `src/app/globals.css`.

| Pola | Kelas | Lebar | Halaman |
|---|---|---|---|
| Fokus | `tata-fokus` | 560 px di tengah | Akun (Tamu dan Member), Masuk, Daftar, Kode verifikasi, Lupa password, Atur ulang password, Riwayat untuk Tamu, dan halaman "tidak ditemukan" |
| Baca | `tata-baca` | 720 px di tengah | Syarat & Ketentuan, Kebijakan Privasi, dan daftar Riwayat Pesanan Member |
| Dua kolom | `tata-dua-kolom` | penuh 1120 px, dua kolom mulai 900 px | Halaman Produk, Checkout, Halaman bayar, dan Halaman Pesanan |
| Katalog | grid biasa | penuh 1120 px | Beranda dan Kategori |

- **Kepala halaman** (`kepala-halaman`): judul halaman di kiri dan aksi halaman di kanan, misalnya "Tambah Produk" di dasbor admin. Bila sempit, aksi turun ke bawah judul. Jarak ke isi 24 px.
- **Ritme tegak:** isi mulai 24 px di bawah strip tepi (32 px di layar lebar). Antarbagian berjarak 24–32 px, dan antarkartu dalam satu bagian 16 px. Footer berjarak minimal 48 px dari isi terakhir.
- **Halaman bayar:** gambar QR adalah benda utama halaman ini. Ia tampil 240 px di ponsel dan 288 px di layar lebar, di tengah `kartu kartu-tegas` berselotip, dan selalu di atas alas putih (`bg-white`), juga di mode gelap, supaya pola dan zona tenangnya tetap terbaca pemindai. QR tidak diberi tepi coretan dan tidak diputar. Di ponsel urutannya kartu bayar, QR, lalu ringkasan Pesanan. Di layar lebar kartu QR lekat di kolom kiri, sedangkan kartu bayar dan ringkasan Pesanan bertumpuk di kolom kanan.
- **Kolom kanan** di pola dua kolom berisi ringkasan, misalnya Rincian Total bayar. Di layar lebar ia boleh lekat (`sticky`) di bawah bilah atas, supaya tetap terlihat saat kolom kiri digulir.
- **Dasbor admin:** isi di sebelah menu samping memakai lebar maksimal 1120 px di tengah ruang isi. Halaman daftar (tabel) memakai lebar penuh itu. Halaman yang isinya satu form memakai kolom 720 px di tengah. Halaman ubah yang punya beberapa panel, misalnya ubah Produk dengan panel Foto dan Varian, memakai dua kolom mulai 1200 px: form utama di kiri dan panel pendukung di kanan.

**Gerak responsif (PRD §11.2).** Begitu halaman digulir lebih dari 24 px, bilah atas mengecil dari 64 ke 52 px dan mendapat bayangan tegas. Navigasi bawah bersembunyi saat digulir ke bawah melewati 120 px, lalu muncul lagi saat digulir ke atas. Bilah lekat ikut turun ke dasar layar. Easing standarnya `cubic-bezier(.16,1,.3,1)`. Gerak kecil (hover, tekan, goyang) berlangsung 100 ms `ease-out`. Efek hover hanya berlaku di `@media (hover: hover)`. Semua transisi dan animasi dimatikan di bawah `prefers-reduced-motion: reduce`, termasuk goyang dan tombol yang ditekan rata.

**Rotasi.** Rotasi kecil memecah grid supaya terasa ditempel tangan, tetapi hanya pada benda yang tidak perlu dibaca teliti.

| Boleh miring diam | Miring hanya saat hover | Selalu tegak |
|---|---|---|
| Foto besar di Halaman Produk, label Hemat dan Habis, toast, dan hiasan | Kartu Produk (`goyang`, 1°) dan chip (−2°) | Isian, form, panel yang berisi form, tabel dan Rincian Total bayar, deret harga, pilihan Varian, blok Item stok, pil status, Nomor Pesanan, angka waktu, kartu bayar, baris Riwayat, teks panjang, bilah atas, navigasi, bilah lekat, dan seluruh dasbor admin |

Rentangnya −2° sampai 2°, dan paling banyak ±1° di bawah 900 px. Selotip memakai −3° bawaan kelasnya.

**Target ukuran.** Lebar terkecil yang didukung 360 px, tanpa gulir ke samping (PRD §11.1). Bayangan bergeser dan elemen yang miring tetap berada di dalam padding samping 16 px. Target sentuh terkecil 40 px (tombol kecil dan chip). Kontrol utama 52 px.

## Elevation & Depth

Kedalaman datang dari potongan kertas yang ditumpuk: kartu bergaris pensil di atas kertas bertitik, dengan bayangan yang bergeser tegas ke kanan bawah tanpa blur. Semua bayangan memakai `bayang`, kecuali bayangan halus kartu yang memakai `bayang-halus`.

`bayang-halus` adalah pensil 10% (`rgba(45, 45, 45, 0.1)`) di mode terang dan hitam 45% (`rgba(0, 0, 0, 0.45)`) di mode gelap. Nilainya berupa rgba, jadi ia tidak masuk blok `colors:` dan hanya dipegang `globals.css`.

### Shadow Vocabulary
- **Coret halus** (`shadow-coret-halus`, `3px 3px 0 0 var(--bayang-halus)`): kartu, panel, dan baris Riwayat. Sudah dipasang kelas `kartu`.
- **Coret kecil** (`shadow-coret-kecil`, `2px 2px 0 0 var(--bayang)`): tombol kecil, chip terpilih, Varian terpilih, label Hemat, paku, dan kotak cari.
- **Coret** (`shadow-coret`, `4px 4px 0 0 var(--bayang)`): tombol 52 px dan `kartu-tegas` (blok Item stok, panel ajakan, kartu bayar).
- **Bayang bilah** (`0 4px 0 0 var(--bayang)`): bilah atas saat ciut. Bayangan ini lurus ke bawah karena bilahnya selebar layar.
- **Coret sedang** (`shadow-coret-sedang`, 6 px): kartu Produk yang di-hover dan toast.
- **Coret tegas** (`shadow-coret-tegas`, 8 px): kartu Produk Unggulan, satu-satunya sorotan di Beranda.
- **Ditekan rata.** Tombol yang di-hover menyusut ke bayangan 2 px dan bergeser 2 px. Saat ditekan, bayangannya hilang dan tombol bergeser 4 px, seperti kertas yang ditekan ke meja.
- **Cincin fokus** (`outline: 3px dashed var(--pulpen); outline-offset: 3px`): semua elemen dengan `:focus-visible`. Isian memakai garis `pulpen` ditambah halo `0 0 0 3px` dari `pulpen` 20%.

### Tekstur kertas
`body` memakai `radial-gradient(var(--kertas-lama) 1px, transparent 1px)` berukuran 24 px, jadi halaman tampak seperti kertas buku catatan bertitik. Kartu dan panel menutupi pola itu dengan latar `permukaan`.

### Named Rules
**Aturan Bayangan Tegas.** Setiap bayangan bergeser tegas tanpa blur dan diambil dari `shadow-coret-*`, kecuali bayang bilah yang lurus ke bawah. Warna selalu datar: tanpa gradasi warna, pendar, blur, derau, atau `backdrop-filter`, termasuk di pemandangan. Satu-satunya `radial-gradient` adalah pola titik kertas, dan warna tembus hanya dipakai selotip, garis tepi selotip, dan halo fokus isian.

**Aturan Garis Pensil.** Setiap kartu, panel, tombol, isian, chip, pil, dan foto bergaris `pensil` minimal 2 px. Tombol 52 px bergaris 3 px untuk penekanan. Garis putus-putus menandai yang sekunder: pemisah, keadaan nonaktif, label Habis, Varian habis, dan garis atas bilah lekat.

## Shapes

Tidak ada wadah bersudut lurus atau berradius bulat biasa. Setiap wadah memakai salah satu radius coretan dari frontmatter, yang tersedia sebagai utilitas Tailwind:
- **Coret** (`rounded-coret`): tombol, chip, pil status, label Hemat dan Habis, tombol Salin, kontrol segmen, dan toast.
- **Coret sedang** (`rounded-coret-md`): kartu, panel, pilihan Varian, baris Riwayat, blok Item stok, dan kartu bayar.
- **Coret variasi** (`rounded-coret-alt`): isian, kotak cari, foto Produk, gambar QR, dan petak Produk tanpa foto.
- **Coret bulat** (`rounded-coret-bulat`): bentuk "bulat" yang tidak sempurna, seperti radio, avatar, ikon di dalam lingkaran, dan titik.

Kelas `rounded-sm` sampai `rounded-3xl`, `rounded-full`, dan `rounded-[Npx]` tidak dipakai. Pengecualiannya dua: paku payung berbentuk lingkaran utuh (sudah diatur kelas `paku`), dan penanda matahari berbentuk setengah lingkaran. Pada elemen kecil, browser mengecilkan radius coretan secara proporsional, jadi radius yang sama tetap aman dipakai di chip 40 px.

## Components

Ikon di aplikasi berasal dari `lucide-react` dengan `strokeWidth={2.5}`, berukuran 24 px (16 px di pil status, 18 px di tombol Salin dan segmen). Ikon penting boleh dibungkus lingkaran `rounded-coret-bulat` bergaris 2 px `pensil`, misalnya `Ticket` di Riwayat Tamu dan `ShieldCheck` di panel garansi. Padanan ikonnya: Beranda `House`, Kategori `LayoutGrid`, Riwayat `History`, Akun `User`, cari `Search`, kembali `ChevronLeft`, Salin `Copy`, tersalin `Check`, simpan QR `Download`, WhatsApp `MessageCircle`, garansi `ShieldCheck`, mode `Smartphone`/`Sun`/`Moon`, dan Tautan Pesanan `Ticket`. Ikon status ada di bagian Status Pesanan.

Komponen dibangun di atas primitif shadcn/ui (Radix) dan diberi token serta kelas dari `src/app/globals.css`. Kelas itu berada di layer `components`, jadi utilitas Tailwind di elemen yang sama bisa menimpanya (misalnya `tombol w-full`). Toast memakai `sonner`.

### Hiasan
Hiasan menguatkan kesan buku sketsa. Setiap hiasan diberi `aria-hidden="true"` dan `pointer-events-none`, tidak menutupi teks atau kontrol, dan paling banyak satu jenis per kartu.
- **Selotip** (`selotip`, induk `relative`): pita `kertas-lama` 75% tembus, 96×26 px, miring −3° di tengah atas. Dipakai di kartu Unggulan, blok Item stok, dan foto besar Halaman Produk.
- **Paku payung** (`paku`, induk `relative`): lingkaran `spidol` 18 px bergaris 2 px `pensil` dengan bayangan 2 px, di tengah atas. Dipakai di panel ajakan dan kartu catatan.
- **Garis bergelombang** (`garis-gelombang`): garis bawah bergelombang `spidol` 2 px dengan jarak 6 px. Dipakai untuk tautan navbar atas yang aktif dan judul bagian.
- **Goyang** (`goyang`, `goyang-kiri`): miring 1° atau −1° saat hover. Dipakai kartu Produk secara bergantian.
- **Coretan SVG** (panah putus-putus, lingkaran sorotan, garis berkelok): garis `spidol` atau `pensil` lewat token. Hiasan besar seperti ini tampil mulai 900 px (`hidden lebar:block`).

### Buttons
- **Bentuk:** kelas `tombol`. Tinggi minimal 52 px, padding samping 24 px, Patrick Hand 20 px, ikon di kiri dengan celah 8 px, garis 3 px `pensil`, radius `coret`, dan bayangan 4 px.
- **Utama** (`tombol`): latar `permukaan`, teks `pensil`. Saat hover latarnya menjadi `aksi` dengan teks `teks-di-aksi`, lalu tombol ditekan rata saat diklik (lihat Elevation). Saat nonaktif latarnya `kertas-lama`, teksnya `pensil-redup`, garisnya putus-putus, dan bayangannya hilang, misalnya tombol "Habis" di Halaman Produk. Satu tombol utama per layar.
- **Kedua** (`tombol tombol-kedua`): latar `kertas-lama`. Saat hover latarnya menjadi `pulpen` dengan teks `teks-di-pulpen`. Dipakai untuk aksi kedua: Batalkan, Pakai voucher, Daftar, WhatsApp, dan "Simpan email". Ini pengganti tombol garis tema lama.
- **Kecil** (`tombol tombol-kecil`): 40 px, padding 14 px, 17 px, garis 2 px, bayangan 2 px. Bisa digabung dengan `tombol-kedua`. Dipakai untuk tombol Masuk atau nama Member di bilah atas, tombol Salin, dan aksi di dasbor admin.

▶ Keputusan 2026-11-17 (#128): Member tidak punya nama. "Nama Member" di tombol langit dan bilah atas adalah bagian email Member sebelum "@", dipotong menjadi 12 karakter diikuti "…" bila lebih panjang (PRD §11.1, `tests/golden/label-member.json`).

### Chips
- **Chip Kategori** (`chip`): pil 40 px, latar `permukaan`, garis 2 px `pensil`, radius `coret`, label 17 px. Saat hover chip miring −2°. Chip yang terpilih (`aria-pressed="true"` atau `aria-current`) otomatis menjadi catatan post-it dengan bayangan 2 px. Deret chip bisa digeser ke samping sampai tepi layar. Chip Kategori di Halaman Produk memakai kelas yang sama.
- **Label Hemat:** pil `postit` dengan teks `teks-postit`, garis 2 px `teks-postit` (supaya garisnya tetap gelap di mode gelap), bayangan coret kecil, Mikro, berbunyi "Hemat N%" (PRD §3.5). Label ini miring −1° (−2° mulai 900 px).
- **Label Habis:** pil dengan teks `pensil-redup` dan garis putus-putus 2 px `pensil-redup`, Mikro, miring 1° (2° mulai 900 px) (PRD §3.4).

### Cards / Containers
- **Kartu** (`kartu`): latar `permukaan`, teks `pensil`, garis 2 px `pensil`, radius `coret-md`, dan bayangan coret halus. Tambahkan `kartu-tegas` untuk bayangan 4 px, atau `kartu-postit` untuk catatan kuning.
- **Kartu Produk:** `kartu` dengan padding 12 px, tegak supaya grid dua kolom tetap rapi di 360 px. Isinya foto sampul (112 px, 148 px di layar lebar) berradius `coret-alt` bergaris 2 px `pensil`, nama, harga, lalu baris banding (Harga normal dicoret, Hemat, atau Habis). Seluruh kartu adalah tautan ke Halaman Produk. Saat hover kartu bergoyang (`goyang` dan `goyang-kiri` bergantian) dan bayangannya naik ke coret sedang. Kartu tidak menampilkan angka stok gabungan.
- **Kartu Produk habis:** foto diberi grayscale 85% dan opasitas 55%, harga menjadi `pensil-redup`, dan label Habis tampil (PRD §3.4, §3.8).
- **Kartu Produk Unggulan:** `kartu` dengan padding 16 px, bayangan coret tegas, dan selotip di atasnya. Ukurannya naik satu anak tangga (nama 22 px, harga 24 px), tanpa lencana tambahan. Di layar lebar kartu ini menampilkan daftar Varian beserta Harga normal yang dicoret atau label Habis, jadi kartunya tetap tegak.
- **Panel:** `kartu` dengan padding 16 px dan jarak 16 px antar-panel, berjudul Judul kecil. Dipakai untuk deskripsi, garansi, rincian Total bayar, dan ringkasan Pesanan.
- **Panel ajakan** (Buat akun, PRD §7.1): `kartu kartu-postit kartu-tegas` dengan paku payung. Panel ini berisi form, jadi ia tegak, dan semua teksnya mewarisi `teks-postit`. Isian di dalamnya tetap berlatar `permukaan`. Di mode gelap panel ini berlatar `permukaan` dengan teks `pensil` (`dark:bg-permukaan dark:text-pensil`). Alasannya, teks bantuan (`pensil-redup`) dan pesan galat (`aksi`) dari komponen isian bersama memakai warna mode gelap, dan kontrasnya hanya sekitar 2:1 di atas post-it.
- **Rincian Total bayar** (PRD §5.5): tabel tegak berisi Harga jual, Potongan voucher, Kode unik, dan Total bayar, dalam Label 17 px dengan nilai rata kanan. Baris Total bayar dipisah garis putus-putus 2 px `pensil` dan memakai Kalam 700 22 px. Di Checkout, Kode unik belum diketahui, jadi barisnya berbunyi "Rp 1–499, dari Qrispy" dan totalnya "Perkiraan bayar".

▶ Keputusan 2026-11-11 (#53):
- Kartu Produk Unggulan tidak menampilkan chip Kategori atau jumlah Varian seperti di prototipe. Bila semua Variannya habis, kartu ini memakai gaya Kartu Produk habis yang sama dengan kartu biasa.
- Di layar lebar, daftar Varian di Kartu Produk Unggulan menampilkan Harga normal yang dicoret bersama label "Hemat N%" untuk setiap Varian yang punya Harga normal (PRD §3.5). Varian yang habis tetap menampilkan label Habis tanpa Hemat.

▶ Keputusan 2026-11-12 (#87):
- Baris Varian di Kartu Produk Unggulan berurutan: nama Varian, Harga normal yang dicoret, "Hemat N%", lalu Harga jual rata kanan. Contoh: "1 Bulan · ~~Rp 75.000~~ · Hemat 33% · Rp 50.000".
- Varian yang habis di daftar itu hanya menampilkan label Habis, tanpa Harga normal dan tanpa Harga jual.

▶ Keputusan 2026-11-17 (#128): Bila Pesanan memakai Voucher, baris potongan di Rincian Total bayar ditulis "Potongan voucher (HEMAT5)", dengan kode Voucher di dalam kurung (PRD §8.8).

▶ Keputusan 2026-11-17 (#174):
- Rincian Total bayar di Checkout selalu menampilkan baris "Potongan voucher": "Rp 0" bila belum ada Voucher yang diterima, dan "Potongan voucher (KODE)" "− Rp X" setelah "Pakai" menerima Voucher.
- Di bawah Item stok Halaman Pesanan Selesai, "Login untuk melihat riwayat" dan "Lihat Riwayat Pesanan" berupa tombol garis selebar kolom (PRD §7.1).
- Kartu Pesanan Bermasalah di Ringkasan memakai token `st-masalah`, ikon `TriangleAlert`, dan teks "Perlu tindakan. Buka daftar Pesanan Bermasalah", sama dengan pintasan Bermasalah di daftar Pesanan (PRD §9.2).

#### Keputusan teknis: harga di kartu Produk "Mulai Rp X"
Harga normal yang dicoret dan "Hemat N%" diambil dari Varian yang menjadi sumber harga "Mulai", yaitu Varian aktif ber-stok dengan Harga jual termurah (PRD §3.8). Contoh: YouTube Premium dengan "1 Bulan" habis dan "3 Bulan" Rp 55.000 (Harga normal Rp 65.000) tampil "Mulai Rp 55.000 · ~~Rp 65.000~~ · Hemat 15%". Bila semua Varian aktif habis, harga diambil dari Varian termurah di antara semua Varian aktif. Harga normalnya tetap dicoret, tetapi label Hemat diganti label Habis. Kartu tidak menampilkan angka stok gabungan, hanya label "Habis" bila semua Varian aktif habis (PRD §3.4, §3.5, §3.8). Angka Stok Varian baru tampil di Halaman Produk.

▶ Keputusan 2026-11-22 (#246): Harga Produk gratis (PRD §16.4)
- Di kartu Produk, Kartu Produk Unggulan, Halaman Produk, dan Checkout, kata "Gratis" menggantikan Harga jual. Ukuran, huruf, dan warnanya sama dengan Harga jual yang digantikannya.
- Harga normal yang diisi tetap dicoret di tempat biasanya, tanpa label "Hemat N%". Contoh baris Varian di Kartu Produk Unggulan: "Akun Baru · ~~Rp 15.000~~ · Gratis".
- Keterangan "Gratis khusus Member, maksimal M per Member" di Halaman Produk memakai teks bantuan biasa, tepat di bawah harga.
- Varian habis tetap memakai label Habis seperti Produk lain.

### Inputs / Fields
- **Isian** (`isian`): tinggi 52 px, radius `coret-alt`, latar `permukaan`, garis 2 px `pensil`, Patrick Hand 18 px, placeholder `pensil-redup`. Textarea ditambah `py-3`. Label berada di atas isian (Label 17 px, jarak 8 px), dan teks bantuan di bawahnya (Bantuan 16 px, `pensil-redup`).
- **Fokus:** garis menjadi `pulpen`, ditambah halo 3 px `pulpen` 20%, tanpa outline bawaan.
- **Galat:** isian diberi `aria-invalid="true"`, dan garisnya otomatis menjadi `aksi`. Teks bantuan diganti pesan galat 16 px berwarna `aksi` dengan ikon `TriangleAlert`. Pesan sukses voucher berwarna `st-selesai`.
- **Baca-saja:** isian `read-only` otomatis berlatar `kertas-lama` dengan teks `pensil`.
- **Isian gabung:** isian kode voucher (huruf kapital) dengan `tombol tombol-kedua` "Pakai" di sebelahnya (PRD §8).
- **Kotak cari:** kelas `isian` 52 px di pita Beranda, dengan ikon `Search` di kiri dan bayangan coret kecil. Fokusnya sama dengan isian lain. Hiasan pemandangan dijauhkan dari kotak ini.
- **Pilihan Varian** (radiogroup, PRD §3.2–§3.4): kartu `rounded-coret-md` bergaris 2 px `pensil` berlatar `permukaan`, tegak. Kolomnya berisi radio 28 px (lingkaran `rounded-coret-bulat` bergaris 2 px `pensil`), nama Varian dan "Stok N", lalu Harga jual dengan Harga normal yang dicoret dan Hemat. Saat di-hover garisnya menjadi `pulpen`. Varian terpilih menjadi catatan post-it: garis 3 px `pulpen`, latar `postit`, bayangan coret kecil, dan semua teks di dalamnya (termasuk "Stok N", Harga normal, dan titik radio) berganti ke `teks-postit` sesuai Aturan Pasangan Teks. Varian habis bergaris putus-putus, bertulisan "Habis", beropasitas 60%, dan tidak bisa dipilih. Produk dengan satu Varian tidak menampilkan pilihan ini, melainkan harga 32 px dan "Stok N".
- **Kontrol segmen mode** (PRD §11.3): tiga pilihan, yaitu Perangkat, Terang, dan Gelap, di wadah `kertas-lama` bergaris 2 px `pensil` dengan radius `coret`. Setiap pilihan setinggi 44 px dengan ikon 18 px dan teks `pensil-redup`. Pilihan aktif menjadi catatan post-it bergaris 2 px `pensil` dengan teks `teks-postit`, sama dengan chip terpilih.

▶ Keputusan 2026-11-11 (#53): Kotak cari menjalankan pencarian saat Pembeli menekan Enter atau tombol cari di papan ketik, tidak sambil mengetik seperti di prototipe. Hasilnya terbuka di alamat yang bisa dibagikan dan bekerja dengan tombol kembali.

▶ Keputusan 2026-11-17 (#174): Isian yang tidak bisa diubah, seperti email Member di Checkout (PRD §5.2), tetap berbentuk isian dengan latar `permukaan-2` dan teks `tinta`. Teks bantuannya tetap tampil.

▶ Keputusan 2026-11-20 (#224): Isian rupiah di dasbor admin, seperti Harga modal (PRD §14.1) dan minimal Total bayar yang dikenai biaya (PRD §14.3), berisi angka dengan titik ribuan, misalnya "100.000", tanpa awalan "Rp".

▶ Keputusan 2026-11-22 (#246): Pilihan Saldo untuk Tamu (PRD §15.7)
- Pilihan Saldo di Checkout Tamu memakai tampilan pilihan Saldo yang saldonya kurang: garis putus-putus, opasitas 60%, dan tidak bisa dipilih. Labelnya "Saldo", tanpa nominal.
- Kalimat "Bayar pakai saldo khusus Member. Masuk, atau Daftar lalu top up." berada di bawah kartu pilihan itu, di luar bagian yang diredupkan, supaya tautan "Masuk" dan "Daftar" tetap terbaca penuh dan bisa diketuk. Kedua tautan memakai gaya tautan biasa.

### Navigation
- **Garis coretan** (`GarisCoretan` di `kerangka-bilah-atas.tsx`): garis `pensil` bergelombang tipis, seperti garis yang ditarik tangan. Dipakai di tepi bawah bilah atas dan tepi atas navigasi bawah.
- **Bilah atas:** latar `kertas` dengan garis coretan di tepi bawahnya, lekat di atas, 64 px. Saat digulir ia ciut ke 52 px dan mendapat bayangan tegas `0 4px 0 0 var(--bayang)` lurus ke bawah, yang menebalkan garis coretan. Monogram ikut mengecil dari 28 ke 24 px. Bilah status iPhone memakai gaya bawaan (PRD §11.4), jadi bilah atas tidak mewarnai zona di belakangnya.
- **Navigasi bawah (di bawah 900 px):** 76 px, latar `permukaan`, dengan garis coretan di tepi atasnya yang menjadi cakrawala bagi penanda matahari. Empat tab berisi ikon 24 px dan label Mikro. Tab tidak aktif berwarna `pensil-redup`, tab aktif `pensil` dengan `aria-current="page"`.
- **Navbar atas (mulai 900 px):** empat tautan 40 px, Patrick Hand 18 px, berwarna `pensil-redup`. Saat hover warnanya menjadi `pensil`. Jarak antarlabel 32 px. Tautan aktif berwarna `pensil` dan ditandai penanda matahari saja, tanpa garis gelombang, supaya dua penanda tidak bertabrakan.
- **Bilah lekat:** aksi utama Halaman Produk, Checkout, dan Halaman bayar menempel di atas navigasi bawah (`bottom: 76px`). Latarnya `kertas` dengan garis atas 2 px putus-putus `pensil`, tanpa bayangan. Padding-nya 12/16/26 px. Padding bawah 26 px menyediakan ruang bagi penanda matahari yang menonjol di atas garis navigasi. Saat navigasi bawah bersembunyi, bilah lekat turun ke dasar layar dengan padding bawah 12 px.
- **Dasbor admin** (PRD §9, §11.1): menu samping di layar lebar, menu lipat di ponsel, tanpa navigasi bawah. Dasbor mewarisi token dan kelas di berkas ini dengan kepadatan Operate: tabel padat yang tegak, kontrol 40 px, panel `kartu`, dan pil status yang sama. Hiasan dan rotasi tidak dipakai di dasbor admin, supaya pekerjaan Admin tetap rapi dan cepat dipindai.

▶ Keputusan 2026-11-11 (#53):
- Judul toko di Beranda hanya dibaca pembaca layar, karena Beranda langsung dibuka dengan pita langit. Di ponsel, monogram MDS di bilah atas sudah cukup sebagai tanda toko.
- Setelah Admin membuat atau mengubah Kategori atau Produk, dasbor kembali ke daftarnya tanpa pesan "tersimpan". Daftar yang sudah diperbarui menjadi tandanya.

▶ Keputusan 2026-11-12 (#87):
- Setelah Admin mengubah Item stok, form tertutup tanpa pesan "tersimpan". Setelah Admin menyelesaikan Pesanan Bermasalah, detail Pesanan langsung menampilkan status baru, Item stok, dan baris riwayat "Admin", tanpa pesan "berhasil".
- Aksi yang tidak bisa dibatalkan ditegaskan langsung di tempatnya, tanpa dialog: hapus Item stok ("Hapus Item stok N? Isinya tidak bisa dikembalikan."), "Kirim Item stok", dan "Tandai Dana Dikembalikan" (PRD §5.9).

▶ Keputusan 2026-11-12 (#99):
- Detail Pesanan Bermasalah menampilkan panel "Koreksi email" di atas panel "Selesaikan Pesanan Bermasalah", mengikuti urutan kerjanya: koreksi email dulu, lalu "Kirim Item stok". Tombol panel itu adalah tombol garis "Simpan email", karena koreksi ini belum mengirim email (PRD §6.4).
- Setelah email Pesanan Bermasalah dikoreksi, panel itu menampilkan "Email Pesanan diganti menjadi <email>. Belum ada email yang dikirim: email "Pesanan selesai" dikirim ke alamat itu setelah Anda menekan "Kirim Item stok"." Pesan ini tetap ada, karena hanya pesan ini yang memberi tahu Admin bahwa belum ada email terkirim.
- Penegasan "Kirim Item stok" berbunyi "Kirim satu Item stok Tersedia dari Varian yang sama ke Pesanan ini? Pesanan menjadi Selesai, dan email "Pesanan selesai" dikirim ke <email Pesanan>. Aksi ini tidak bisa dibatalkan."
- Penegasan "Tandai Dana Dikembalikan" berbunyi "Tandai Pesanan ini Dana Dikembalikan? Pesanan ini tidak akan mendapat Item stok, jadi pastikan uangnya sudah dikembalikan di luar sistem. Aksi ini tidak bisa dibatalkan."

▶ Keputusan 2026-11-17 (#174): Hapus Voucher memakai panel "Hapus Voucher" di bawah halaman ubah Voucher, sama seperti hapus Produk dan Kategori. Penegasannya berbunyi "Hapus Voucher KODE? Voucher ini beserta syaratnya terhapus dan tidak bisa dikembalikan." (PRD §8.8).

▶ Keputusan 2026-11-22 (#246): Modal penegasan (PRD §9.10). Keputusan ini menggantikan butir "ditegaskan langsung di tempatnya, tanpa dialog" di ▶ Keputusan 2026-11-12 (#87). Panel hapus, seperti "Hapus Voucher", tetap ada di halamannya. Bedanya, tombol di panel itu kini membuka Modal penegasan, bukan penegasan di tempat.
- **Bentuk:** panel `kartu` berlatar `permukaan` dengan tepi merah `aksi` 2 px, seperti penegasan di tempat sebelumnya, dan bayangan `shadow-coret`. Lebarnya paling besar 480 px, di tengah layar. Di ponsel, lebarnya layar dikurangi gutter 16 px di kiri dan kanan. Tanpa hiasan dan rotasi, seperti dasbor admin lainnya.
- **Latar:** lapisan `pensil` beropasitas 40% menutup seluruh halaman, termasuk menu samping.
- **Isi, dari atas:** judul berupa pertanyaan pendek, misalnya "Hapus Item stok?", lalu rincian akibat aksinya (PRD §9.10), lalu baris tombol. Tombol aksi memakai `tombol` utama dengan label "Ya, …", dan di sebelahnya ada "Batal" dengan `tombol tombol-kedua`. Di ponsel, kedua tombol bersusun dengan tombol aksi di atas.
- **Keyboard dan pembaca layar:** modal memakai `role="alertdialog"` dengan `aria-modal="true"`, dan judul serta rinciannya menjadi label dan deskripsinya. Saat modal terbuka, fokus pindah ke "Batal", supaya Enter yang tidak disengaja tidak menjalankan aksi. Tab berputar di dalam modal. Esc dan ketukan di lapisan latar sama dengan "Batal". Setelah modal tertutup, fokus kembali ke tombol yang membukanya.
- **Selama aksi diproses:** kedua tombol nonaktif, tombol aksi menampilkan teks proses seperti "Menghapus…", dan Esc serta ketukan di latar tidak menutup modal.
- **Gerak:** modal muncul dengan pudar 150 ms memakai easing standar. Di bawah `prefers-reduced-motion: reduce`, modal langsung tampil.

### Penanda tab aktif: matahari coretan (komponen khas)
Setengah matahari coretan berupa SVG: busur berisi `matahari` dengan garis 2 px `pensil` dan lima sinar pendek dari guratan `pensil`, tanpa pendar. Wadahnya 28×14 px; sinarnya keluar dari wadah itu, jadi ukuran tempat penanda tidak berubah, dan garisnya tetap 2 px di ukuran berapa pun. Ia duduk di garis atas navigasi bawah, di tengah tab aktif, seperti matahari yang terbit dari cakrawala pensil. Saat tab berpindah, ia bergeser sejauh satu lebar tab dalam 0,45 dtk dengan easing standar (PRD §11.2). Di navbar atas ukurannya 20×10 px, dan ia duduk di garis bawah bilah atas, di bawah tautan aktif. Saat bilah ciut, matahari navbar ikut mengecil ke 85% bersama monogram. Penanda ini `aria-hidden`, karena keadaan aktif sudah disampaikan oleh `aria-current`. Saat gerak dikurangi, ia langsung melompat ke posisi baru.

### Pemandangan gunung coretan (komponen khas)
Pemandangan ini adalah SVG yang dilukis kode, bukan gambar jadi, supaya tetap tajam di semua lebar dan bisa menjadi jam hitung mundur. Ia menggantikan pemandangan senja realistis (gradien langit, kabut, butiran derau) atas instruksi pemilik pada 2026-11-19. Isinya:
- **Benih tetap.** Bentuk punggung gunung, getar garis, arsiran, awan, burung, dan bintang dihitung dari benih tetap (LCG). Hasil server dan klien sama persis, dan gambar tidak berubah antar-kunjungan.
- **Warna lewat token.** Setiap `stroke` dan `fill` berupa `var(--pensil)`, `var(--pensil-redup)`, `var(--pulpen)`, `var(--matahari)`, `var(--kertas)`, atau `var(--permukaan)`. Pelukis tidak memegang hex, dan pergantian mode tidak perlu melukis ulang.
- **Warna datar.** Tanpa gradien, filter blur, derau, `mix-blend-mode`, atau lapisan kabut. Kedalaman datang dari tebal garis dan rapat arsiran.
- **Punggung gunung:** garis pensil yang sedikit bergetar seperti tangan, dari midpoint displacement berbenih tetap. Lapis dekat bergaris `pensil` 2 px, dan lapis jauh `pensil-redup` 1,5 px. Setiap lapis diisi warna latar wadahnya (`kertas` di pita dan strip, `permukaan` di kartu bayar) supaya menutupi lapis di belakangnya, lalu lerengnya diberi arsiran garis miring tipis. Path dilebarkan melewati tepi supaya tidak ada baji di pinggir. Jumlah lapis dan kerapatan arsiran di pita dan kartu bayar adalah keputusan teknis pelukis.
- **Matahari:** lingkaran `matahari` (kuning stabilo) bergaris 2 px `pensil`, dengan sinar berupa guratan pensil pendek di sekelilingnya.
- **Bulan dan bintang (mode gelap):** bulan sabit `matahari` bergaris `pensil`, dan bintang coretan kecil bergaris `pensil`. Di mode gelap `pensil` berwarna kapur, jadi sketsanya terbaca di kertas arang.
- **Awan dan burung (pita Beranda saja):** awan berupa garis lengkung bergerigi `pensil` tanpa isi, dan beberapa burung berbentuk "v" dari guratan `pulpen`.
- **Teks dan hiasan.** Teks di dalam atau di atas pemandangan selalu `pensil` di atas `kertas` atau `permukaan`. Pelukis menerima kotak teks dan menjauhkan matahari, bulan, bintang, burung, dan arsiran dari kotak itu, jadi warna teks tidak pernah berganti mengikuti gambar.
- **Aksesibilitas.** SVG-nya `aria-hidden`. Pergantian matahari dan bulan mengikuti mode tanpa melukis ulang dan tanpa kedip saat hidrasi, misalnya dengan menggambar keduanya lalu menukarnya lewat varian `dark:`.

Pemakaiannya:
- **Pita Beranda** (236/320 px): latar `kertas`, punggung gunung di bagian bawah, matahari di mode terang atau bulan sabit dan bintang di mode gelap, serta awan dan burung. Kotak cari dan chip Kategori berada di atasnya.
- **Strip tepi halaman dalam** (44/56 px): dua lapis punggung gunung bergaris pensil, tanpa matahari, bulan, bintang, awan, atau burung. Cahaya ufuk yang disebut keputusan di bawah digambar sebagai satu guratan stabilo `matahari` berbentuk elips pipih di garis cakrawala, tanpa pendar.
- **Kartu bayar Halaman bayar** (136/280 px, `kartu kartu-tegas`, tegak, PRD §5.6): hitung mundur QRIS menggerakkan `t` dari 0 (15:00) sampai 1 (00:00). Seiring `t` naik, matahari tenggelam di balik punggung gunung (menyentuhnya sekitar `t` = 0,5), arsiran `pulpen` di lereng dan langit bertambah rapat, dan bintang coretan muncul saat `t` di atas 0,6. Kartu ini memakai matahari di kedua mode, karena di sini matahari adalah jam. Angka waktu dan Total bayar ditulis `pensil` di atas `permukaan`. Pembaca layar mendapat sisa menit lewat `aria-live` sekali per menit, bukan setiap detik.

▶ Keputusan 2026-11-11 (#53): Strip tepi halaman dalam tetap menggambar cahaya ufuk elips di garis cakrawala, seperti prototipe. Yang tidak digambar di strip adalah cakram matahari beserta pendar radialnya, bintang, dan awan.

▶ Keputusan 2026-11-12 (#87): Teks kartu senja mengikuti prototipe. Labelnya "sisa waktu bayar", pembaca layar mendengar "Sisa waktu bayar N menit" sekali per menit, dan saat waktu habis label serta pengumumannya menjadi "QRIS kedaluwarsa".

### Status Pesanan (PRD §5.7)
Setiap status adalah pil setinggi 28 px dengan ikon 16 px, Label kecil (Kalam 700, 15 px), padding `0 12px 0 8px`, radius `coret`, dan garis 2 px berwarna teks statusnya sendiri (`border-current`), jadi setiap status punya tinta sendiri. Pil status selalu tegak. Warna, ikon, dan label selalu tampil bersama, tidak pernah warna saja. Labelnya memakai nama status persis seperti di GLOSSARY. Semua pasangan mencapai minimal 6,1:1.

| Status | Ikon lucide | Terang (latar / teks) | Gelap (latar / teks) |
|---|---|---|---|
| Menunggu Pembayaran | `Clock` | `st-tunggu-bg` / `st-tunggu` | `st-tunggu-bg-gelap` / `st-tunggu-gelap` |
| Selesai | `Check` | `st-selesai-bg` / `st-selesai` | `st-selesai-bg-gelap` / `st-selesai-gelap` |
| Kedaluwarsa | `Hourglass` | `st-kedaluwarsa-bg` / `st-kedaluwarsa` | `st-kedaluwarsa-bg-gelap` / `st-kedaluwarsa-gelap` |
| Dibatalkan | `CircleX` | `st-batal-bg` / `st-batal` | `st-batal-bg-gelap` / `st-batal-gelap` |
| Bermasalah | `TriangleAlert` | `st-masalah-bg` / `st-masalah` | `st-masalah-bg-gelap` / `st-masalah-gelap` |
| Dana Dikembalikan | `RotateCcw` | `st-kembali-bg` / `st-kembali` | `st-kembali-bg-gelap` / `st-kembali-gelap` |

Pil status muncul di Halaman bayar (Menunggu Pembayaran, di samping Nomor Pesanan), di kepala Halaman Pesanan, dan di setiap baris Riwayat Pesanan (PRD §7.4). Baris Riwayat adalah `kartu` tegak yang memuat pil status, Total bayar rata kanan, Produk dan Varian, serta Nomor Pesanan dalam mono 13 px diikuti tanggal WIB dalam huruf tulisan tangan. Urutannya terbaru di atas.

Status Item stok (Tersedia, Ditahan, Terkirim) hanya tampil di dasbor admin. Statusnya memakai anatomi pil yang sama: warna, ikon, dan label. Pemetaan token dan ikonnya wajib berbeda jelas dari status Pesanan di layar yang sama.

▶ Keputusan 2026-11-11 (#53): Label pil status Pesanan dan pil berbentuk sama di dasbor admin, seperti Aktif, Nonaktif, Unggulan, dan Sampul, bertebal 700 sesuai token `label-kecil` di frontmatter. Sebelumnya teks bagian ini menulis tebal 800, yang bertentangan dengan frontmatter. Label Hemat dan Habis tidak berubah: keduanya tetap memakai Mikro (800, 12 px).

### Blok Item stok dan tombol Salin (PRD §6.1, §6.2)
Halaman Pesanan dikepalai label "Nomor Pesanan" dan Nomor Pesanan dalam mono 30 px. Item stok tampil dalam `kartu kartu-tegas` yang tegak, dengan selotip di atasnya. Setiap kolom Format Item stok menjadi satu baris berisi nama kolom (Bantuan 16 px, `pensil-redup`), nilai mono 15 px `pensil`, dan tombol Salin (`tombol tombol-kecil`, 40 px, ikon `Copy` 18 px). Baris-barisnya dipisah garis putus-putus 2 px. Setelah diketuk, tombol berubah menjadi "Tersalin" dengan ikon `Check`, latar `st-selesai-bg`, dan teks `st-selesai` selama 1,6 dtk. Tombol "Salin semua" (PRD §6.1, ▶ Keputusan 2026-11-20) berada di kepala kartu Item stok, rata kanan sejajar judul, sebagai `tombol tombol-kecil` dengan ikon `CopyCheck` 18 px dan label "Salin semua". Umpan balik setelah diketuk sama dengan tombol Salin per kolom, dengan label "Semua tersalin". Tamu yang membuka Riwayat diberi penjelasan bahwa Tautan Pesanan ada di email "Pesanan selesai", dengan ikon `Ticket`.

▶ Keputusan 2026-11-11 (#53): Sebelum M2, tab Riwayat untuk Tamu di layar lebar menaruh judul di atas dan panel penjelasan di kolom kiri. Tata letak prototipe, yaitu judul di kiri dan panel di kanan, baru dipakai bila kolom kiri sudah berisi tombol Masuk dan Daftar.

▶ Keputusan 2026-11-12 (#87):
- Tautan di Halaman Pesanan Kedaluwarsa dan Dibatalkan berbunyi "Checkout lagi" dan membuka Halaman Produk.
- Tombol WhatsApp di Halaman Pesanan Bermasalah berbunyi "Hubungi kami di WhatsApp".

### Toast
Catatan post-it: latar `postit`, teks `teks-postit` (Label 17 px), garis 2 px `pensil`, radius `coret`, bayangan coret sedang, dan miring −1°. Toast muncul 96 px dari dasar layar di ponsel (di atas navigasi bawah) dan 32 px di layar lebar, lalu hilang setelah 1,8 dtk. Toast diumumkan lewat `role="status"`. Di aplikasi, toast memakai `sonner` dengan gaya ini.

### Foto Produk
Foto diunggah Admin (PRD §3.3), dipotong mengisi bingkai radius `coret-alt` bergaris 2 px `pensil`, dan foto pertama menjadi sampul kartu. Foto besar di Halaman Produk diberi selotip dan miring 1° (paling banyak 2° di layar lebar). Foto di kartu Produk tegak.

▶ Keputusan 2026-11-11 (#53):
- Produk tanpa foto tampil sebagai petak `permukaan-2` berisi huruf awal nama Produk berwarna `tinta-redup`. Petak mauve dari prototipe tidak dipakai, karena teks putih di atasnya melanggar aturan teks putih.
- Di dasbor admin, foto dikelola di panel Foto pada halaman ubah Produk. Setiap unggahan, perpindahan, dan penghapusan langsung tersimpan tanpa tombol Simpan. Panelnya menuliskan hal itu.
- Urutan foto diatur dengan tombol Naikkan dan Turunkan, satu langkah per ketukan, tanpa seret-lepas.
- Foto dihapus tanpa dialog konfirmasi, karena foto mudah diunggah ulang.

### Grafik Laporan keuangan (PRD §14.7)
Grafik digambar sebagai SVG oleh kode toko sendiri, tanpa pustaka grafik. Grafik adalah data, jadi grafik mengikuti aturan "kesan coretan berhenti di data": garis dan batangnya lurus dan tegak, tanpa rotasi, tanpa tepi bergelombang, dan tanpa arsiran acak. Rasa coretan cukup datang dari wadahnya.
- **Wadah:** setiap grafik berada di `kartu` tegak dengan judul Kalam di atasnya, misalnya "Pendapatan".
- **Sumbu dan garis bantu:** garis dasar 2 px `pensil`, garis bantu mendatar 1 px `pensil-redup` putus-putus, dan label sumbu Patrick Hand 14 px `pensil-redup`. Angka rupiah di label sumbu disingkat, misalnya "Rp 1,2 jt" atau "Rp 450 rb".
- **Batang:** isian `pulpen` dengan garis tepi 2 px `pensil` dan sudut lurus. Batang bernilai 0 tidak digambar, tetapi kelompoknya tetap punya tempat dan label.
- **Dua garis Laba:** Laba kotor memakai garis utuh 3 px `pulpen`, dan Laba bersih memakai garis putus-putus 3 px `pensil`. Bedanya terbaca tanpa warna. Setiap titik diberi penanda bulat 6 px. Nilai negatif digambar di bawah garis nol, dan garis nol bertebal 2 px.
- **Batang mendatar** (Produk terlaris dan Pendapatan per Kategori): nama di kiri, batang di tengah, lalu jumlah Pesanan Selesai dan Pendapatan rata kanan dalam huruf isi. Batang terpanjang mengisi lebar yang tersedia.
- **Keterangan seri:** ada di bawah judul, berupa contoh garis atau batang kecil beserta namanya.
- **Nilai:** mengetuk atau menyorot sebuah batang atau titik memunculkan catatan kecil bergaya Toast (latar `postit`, teks `teks-postit`, garis 2 px `pensil`, tanpa rotasi) berisi label kelompok dan nilainya, misalnya "16–22 Nov · Rp 1.250.000".
- **Ponsel:** bila kelompoknya lebih lebar dari layar, grafik bergulir ke samping di dalam kartunya. Halaman sendiri tidak pernah bergulir ke samping (PRD §11.1).
- **Pembaca layar:** setiap grafik punya ringkasan teks atau tabel tersembunyi berisi semua kelompok dan nilainya.
- **Mode gelap:** grafik memakai token yang sama, jadi otomatis mengikuti buku sketsa malam.

### Rincian angka Laporan keuangan dan kartu Ringkasan
Rincian angka Laporan keuangan (PRD §14.5, §14.6) memakai tata letak Rincian Total bayar: baris tegak, label di kiri, nominal rata kanan, dan baris Laba kotor serta Laba bersih ditebalkan dengan garis pemisah 2 px `pensil` di atasnya. Tanda − dan + ditulis di depan label pengurang dan penambah. Nominal negatif ditulis "−Rp 12.500" dengan warna `aksi`. Peringatan Pesanan tanpa Harga modal dan keterangan Biaya operasional saat saringan aktif tampil sebagai kartu catatan post-it di atas rincian. Kartu Ringkasan yang memuat tiga angka (hari ini, bulan ini, sepanjang waktu) menaruh angka hari ini paling besar dan dua angka lainnya di bawahnya sebagai baris kecil berlabel.

▶ Keputusan 2026-11-20 (#224): Di Ringkasan, peringatan Pesanan tanpa Harga modal tampil satu kali sebagai kartu catatan post-it di atas semua kartu, tidak di dalam kartu tertentu, supaya urutan 11 kartu tidak terpotong.

## Do's and Don'ts

### Do:
- **Do** baca `docs/design/acuan-coretan-tangan.md` sebelum mengubah tampilan, lalu pakai kelas dari `globals.css` (`tombol`, `kartu`, `isian`, `chip`, `selotip`, `paku`, `garis-gelombang`, `goyang`) sebelum menulis gaya sendiri.
- **Do** pakai token lewat utilitas Tailwind atau `var(--…)`, termasuk di SVG pemandangan.
- **Do** beri setiap wadah, tombol, isian, chip, dan foto radius `rounded-coret-*` dan garis `pensil` minimal 2 px.
- **Do** pakai bayangan dari Shadow Vocabulary, dan biarkan tombol "ditekan rata" lewat kelas `tombol`.
- **Do** pakai `aksi` untuk teks merah yang harus dibaca, dan simpan `spidol` untuk hiasan.
- **Do** pasangkan setiap latar berwarna dengan warna teksnya (`teks-di-aksi`, `teks-di-pulpen`, `teks-postit`, `st-*`).
- **Do** biarkan form, isian, tabel, deret harga, blok Item stok, pil status, dan teks panjang tegak.
- **Do** tampilkan setiap status Pesanan sebagai pil dengan warna, ikon lucide, dan label sekaligus.
- **Do** pakai angka tabular untuk Harga jual, Stok Varian, Total bayar, dan hitung mundur, dan beri hitung mundur lebar tetap.
- **Do** pakai JetBrains Mono hanya untuk nilai Item stok dan Nomor Pesanan.
- **Do** ambil Harga normal yang dicoret dan Hemat di kartu "Mulai Rp X" dari Varian ber-stok yang menjadi sumber harga itu (PRD §3.8).
- **Do** letakkan aksi utama di bilah lekat berlatar `kertas` di atas navigasi bawah pada layar di bawah 900 px.
- **Do** beri setiap hiasan `aria-hidden="true"` dan `pointer-events-none`.
- **Do** matikan semua transisi dan animasi, termasuk goyang, tombol ditekan, pergeseran matahari, dan penggulungan navigasi, di bawah `prefers-reduced-motion: reduce`.
- **Do** jaga jarak dalam kelipatan 8 px, dan pakai 4 atau 12 px hanya di dalam komponen.
- **Do** periksa setiap layar di mode terang dan mode gelap.

### Don't:
- **Don't** tulis hex di `.ts` atau `.tsx`, termasuk di pelukis pemandangan.
- **Don't** pakai `spidol` untuk teks atau latar bertulisan (kontrasnya sekitar 3:1).
- **Don't** letakkan `pensil`, `aksi`, atau `pulpen` sebagai teks di atas `postit` (di mode gelap `pensil` hanya 1,03:1), dan jangan letakkan teks `aksi` di atas `kertas-lama` (3,7:1).
- **Don't** pakai ungu lama (#2A1F4D) di mana pun. Token `langit` sudah dihapus.
- **Don't** pakai gradasi warna, blur, pendar, derau, `backdrop-filter`, atau bayangan lembut di mana pun.
- **Don't** pakai `rounded-*` biasa, `rounded-full`, atau `rounded-[Npx]`.
- **Don't** beri `font-bold` pada teks Patrick Hand. Pakai `font-spidol font-bold` untuk penekanan.
- **Don't** ganti pemandangan dengan foto atau gambar jadi. Pemandangan itu dilukis kode supaya tajam dan bisa menjadi jam hitung mundur.
- **Don't** tampilkan angka stok gabungan di kartu Produk. Kartu hanya menampilkan "Habis" bila semua Varian aktif habis.
- **Don't** tampilkan status hanya dengan warna.
- **Don't** tambahkan testimoni, rating, jumlah Pembeli, atau logo layanan pihak ketiga, walau acuan menyebut gelembung testimoni. Nama layanan hanya muncul sebagai nama Produk.

## Pemetaan dari token lama

Tema "Langit Senja" berlaku sampai 2026-11-18. Blok keputusan (▶) sebelum 2026-11-19 masih menyebut nama token, komponen, dan bagian dari tema itu. Tabel di bawah menerjemahkannya ke tema ini.

**Cara membaca blok keputusan (▶) lama.** Blok itu tetap mengikat untuk teks, urutan, perilaku, tata letak, dan token mana yang dipakai. Nama token dan komponen di dalamnya dibaca lewat tabel ini. Nilai visual di dalam kurung, seperti "Mikro (800, 12 px)", adalah nilai tema lama: yang mengikat adalah nama tokennya, dan nilainya kini mengikuti frontmatter. Efek yang tidak dipakai gaya coretan (gradien, pendar, blur) digambar ulang menurut bagian terkait di berkas ini.

### Warna
| Token lama | Pengganti |
|---|---|
| `tanah` (latar halaman) | `kertas` |
| `permukaan` | `permukaan` (kartu, panel, isian) |
| `permukaan-2` | `kertas-lama` |
| `garis` (border) | `pensil` |
| `tinta` | `pensil` |
| `tinta-redup` | `pensil-redup` |
| `aksi` ungu (tombol utama) | kelas `tombol`. Token `aksi` kini merah untuk hover dan teks merah |
| `aksi-tekan` | hilang; hover dan tekan diatur kelas `tombol` |
| `aksi-teks` (tautan ungu) | `pulpen` |
| `monogram` | `spidol` untuk hiasan, `pulpen` untuk fokus, `pensil` untuk monogram MDS |
| `langit`, `langit-2`, `langit-garis`, `langit-teks`, `langit-redup` | `kertas`, `permukaan`, `pensil`, `pensil-redup`. `langit` dihapus pada 2026-11-20 |
| `matahari` | `matahari` (kini kuning stabilo) |
| `persik` dan `persik-teks` (label Hemat) | `postit` dan `teks-postit` |
| `mauve` | hilang |
| `teks-di-aksi` | tetap: teks di atas `aksi` |
| `st-*` | tetap, nilainya sama |
| (baru) | `spidol`, `pulpen` dan `teks-di-pulpen`, `postit` dan `teks-postit`, `bayang` |

### Bayangan, radius, dan huruf
| Lama | Pengganti |
|---|---|
| Bayang (`shadow-bayang`) | `shadow-coret-halus` untuk kartu biasa, `shadow-coret` untuk yang ditonjolkan |
| Bayang naik (`shadow-bayang-naik`) | `shadow-coret-sedang` |
| Bayang bilah | `0 4px 0 0 var(--bayang)`, lurus ke bawah tanpa blur |
| Bayang lekat (`shadow-bayang-lekat`) | garis atas `border-t-2 border-dashed border-pensil`, tanpa bayangan |
| Cincin fokus `monogram` | garis putus 3 px `pulpen` |
| Radius `chip` (999 px), `kecil` (10 px), `kontrol` (12 px) | `rounded-coret` |
| Radius `input` (14 px) | `rounded-coret` untuk tombol, `rounded-coret-alt` untuk isian |
| Radius `foto` (16 px) | `rounded-coret-alt` |
| Radius `kartu` (20 px) dan `besar` (24 px) | `rounded-coret-md` |
| `rounded-full` untuk bentuk bulat | `rounded-coret-bulat` |
| Manrope (`font-sans`) | Patrick Hand untuk isi (bawaan `body`), Kalam 700 (`font-spidol`) untuk judul, harga, dan pil |
| `label-kecil` (Manrope 700, 13 px) | `label-kecil` (Kalam 700, 15 px) |
| `mikro` (Manrope 800, 12 px) | `mikro` (Kalam 700, 15 px) |
| JetBrains Mono (`font-mono`) | tetap, hanya untuk Item stok dan Nomor Pesanan |

### Komponen dan nama bagian
| Lama | Pengganti |
|---|---|
| Tombol utama ungu | `tombol` |
| Tombol garis | `tombol tombol-kedua` |
| Tombol kecil 36 px | `tombol tombol-kecil` (40 px) |
| Tombol langit (Masuk atau nama Member) | `tombol tombol-kecil` di bilah atas berlatar `kertas` |
| Pita langit Beranda | pita Beranda (`kertas` dengan pemandangan gunung coretan) |
| Strip tepi langit | strip tepi (dua lapis punggung gunung) |
| Kartu senja Halaman bayar | kartu bayar |
| Pemandangan senja | Pemandangan gunung coretan |
| Penanda tab aktif matahari terbit (`penanda-surya`) | penanda matahari coretan (`penanda-matahari`) |
| Blok Item stok berlatar `langit` | `kartu kartu-tegas` dengan selotip |
| Panel ajakan berbingkai `monogram` | `kartu kartu-postit kartu-tegas` dengan paku |
| Chip Kategori aktif berlatar `langit` | chip terpilih berupa post-it |
| Toast berlatar `langit` | catatan post-it |
| Prototipe `docs/design/prototipe/index.html` | acuan `docs/design/acuan-coretan-tangan.md` dan `src/app/globals.css`. Prototipe hanya dirujuk untuk teks dan tata letak yang disebut blok lama |
