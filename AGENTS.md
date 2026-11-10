# AGENTS.md: Akun Digital

Toko web untuk menjual akun digital, misalnya akun premium aplikasi dan game, kepada pembeli umum. Pembeli memesan, membayar, lalu menerima detail akunnya lewat web. Tidak mencakup aplikasi ponsel.

## Bahasa

Semua yang ditulis untuk pemilik memakai bahasa Indonesia: setiap pesan di percakapan, termasuk baris status singkat di sela perintah seperti "Sekarang CI: …", juga issue, PR, komentar, dan commit. Satu pesan memakai satu bahasa saja.

## Sumber kebenaran

- **Aturan bisnis:** `docs/PRD.md`. Blok `▶ Keputusan` mengalahkan teks di atasnya. Bahan di `docs/input/` bukan aturan.
- **Istilah** untuk nama kode, test, issue, dan PR: `GLOSSARY.md`, termasuk daftar _Avoid_-nya.
- **Keputusan teknis per area:** `docs/adr/`. Stack dicatat di ADR-0001. Aturan bisnis hanya boleh ada di modul domain murni (ADR-0002).
- **Hal yang belum diputuskan pemilik:** `docs/OPEN-DECISIONS.md`. Nilai contohnya dipakai di seed dan test dengan tanda `[CONTOH]`, bukan sebagai aturan.
- **Menulis kode:** `CODING_STANDARDS.md`. Modul domain punya aturannya sendiri di `src/domain/AGENTS.md`.
- **Membuat atau mengubah tampilan:** `docs/DESIGN.md`.
- **Contoh hitungan yang benar:** `tests/golden/` (hanya-baca).
- **Skenario penerimaan** per bagian PRD: `docs/UAT.md`.
- **Konfigurasi kit jalankan-tiket:** `.github/jalankan-tiket.json`.

## Cara kerja: otomatis

Tiket dikerjakan tanpa menunggu manusia oleh plugin `tiket` dari kit jalankan-tiket, dengan urutan ini:

```
/tiket:jalankan → subagent tiket:pelaksana → subagent tiket:peninjau → PR → CI → merge
```

Pemilik produk hanya menjawab tiket yang diparkir dan melakukan UAT. Panduan pemilik ada di `docs/GUIDE.md`.

Bila pemilik meminta fitur atau perubahan di percakapan biasa, tanpa perintah `/tiket:`, sarankan `/tiket:rencanakan-tahap` diikuti deskripsinya, supaya aturannya masuk PRD dan pekerjaannya menjadi tiket. Kerjakan langsung hanya bila pemilik memintanya.

Satu tiket dianggap selesai bila keempat syarat ini terpenuhi:
- semua kriteria penerimaan tercentang;
- `pnpm verify` hijau;
- peninjau memberi `PASS`;
- CI hijau.

### Dua jenis ketidakjelasan

- **Teknis** — putuskan sendiri, lalu catat di PR sebagai keputusan teknis beserta alasan dan risikonya. Contohnya:
  - struktur kode, nama berkas, pola, dan cara menguji;
  - urutan tampil daftar yang tidak diatur PRD;
  - detail visual kecil yang tidak diatur `docs/DESIGN.md`.
- **Bisnis** — jangan menebak, karena menebak dianggap gagal. Parkir tiket dengan label `needs-info`, tulis pertanyaan beserta pilihan jawabannya untuk pemilik, lalu lanjut ke tiket lain. Contohnya:
  - rumus, angka, dan ambang;
  - siapa boleh melakukan apa, dan apa yang dilihat pengguna;
  - perilaku di luar issue atau PRD;
  - aturan yang saling bertentangan.

Nilai di `docs/OPEN-DECISIONS.md` adalah pertanyaan bisnis yang sudah punya nilai contoh, jadi tiket tidak perlu diparkir. Pakai nilai contohnya dengan tanda `[CONTOH]`, sebut OD-nya di PR, lalu lanjutkan.

## Pagar scope

Hasil kerja harus persis sama dengan isi "Dalam scope" di issue.

- Fitur, halaman, tabel, kolom, env var, opsi, dan abstraksi hanya ditambah bila issue menyebutnya.
- Dependency hanya boleh dari `.github/dependency-allowlist.txt`. Bila butuh dependency di luar daftar itu, parkir tiketnya.
- Refactor hanya menyentuh berkas yang memang diperlukan issue.
- Rumus dan ambang diimplementasikan persis seperti di PRD dan `tests/golden/`.
- Test yang merah diperbaiki di kode, bukan di fixture golden.
- Perubahan masuk ke `main` hanya lewat PR dengan CI hijau. Force-push hanya boleh dilakukan manusia.

### Berkas terlindungi

Daftar berkas terlindungi ada di `.github/protected-paths.txt`. Aturannya:
- Berkas itu hanya diubah atas instruksi eksplisit pemilik, di issue atau di komentar.
- PR yang mengubahnya wajib berlabel `disetujui-pemilik`, dan CI menolak PR tanpa label itu.
- Hanya pemilik yang memasang label itu.

## Lingkungan

- **Lokal:** salin `.env.example` menjadi `.env`, lalu jalankan `docker compose up -d` untuk menyalakan PostgreSQL di port 56434.
- **Test:** test e2e selalu memuat `.env.ci`, yang menunjuk database `app_test` di PostgreSQL lokal yang sama. Database pengembangan `app` tidak tersentuh.
  - `app_test` dibuat otomatis saat volume PostgreSQL pertama kali dibuat.
  - Bila volume sudah ada sebelum itu, buat sekali dengan `docker compose exec postgres createdb -U app app_test`.
- **CI:** menyediakan PostgreSQL sendiri untuk test. CI mengganti port di `.env.ci` ke port PostgreSQL miliknya, lalu memuat variabelnya. `.env.ci` tidak berisi rahasia asli.
- **Urutan CI:** CI menjalankan `pnpm verify`, lalu `pnpm test:e2e` bila skrip itu ada.

## Perintah

`pnpm verify` adalah gerbang wajib sebelum commit dan di CI. Perintah lain ada di `package.json`.

## Agent skills

### Issue tracker

GitHub Issues lewat `gh`. Lihat `docs/agents/issue-tracker.md`.

### Triage labels

Lima peran triase bawaan. Lihat `docs/agents/triage-labels.md`.

### Domain docs

Satu konteks: `GLOSSARY.md` dan `docs/adr/` di root. Lihat `docs/agents/domain.md`.
