# Modul domain

Kode di folder ini murni: input → output yang deterministik. Di sinilah aturan PRD ditulis (ADR-0002).

- **Impor:** hanya dari `src/domain/` dan pustaka bawaan TypeScript. Modul ini tidak boleh memakai database, Next.js, React, I/O, jam sistem, maupun dependency npm. dependency-cruiser menegakkan aturan ini.
- **Waktu:** "sekarang" selalu dikirim sebagai parameter, tidak diambil dari `Date.now()`. Jam dibaca di lapisan server, lalu diteruskan ke sini.
- **Fungsi:** setiap aturan PRD punya satu fungsi, yang dinamai dengan istilah dari `GLOSSARY.md`.
- **Test:**
  - Setiap fungsi publik yang disebut issue diuji dengan fixture `tests/golden/`.
  - Ekspektasi test diambil dari fixture atau PRD, bukan dihitung ulang dengan rumus yang sama.
- **Hasil hitung:** setiap hasil hitung membawa bahan hitungnya, supaya tampilan bisa menunjukkan asal setiap angka.
