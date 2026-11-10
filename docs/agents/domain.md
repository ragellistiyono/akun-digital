# Dokumen domain

Berkas ini menjelaskan cara skill memakai dokumen domain repo ini saat menjelajah kode. Repo ini hanya punya satu konteks.

## Sebelum menjelajah, baca

- `GLOSSARY.md` di root: glosarium istilah beserta daftar _Avoid_-nya.
- `docs/adr/`: ADR yang menyentuh area yang akan dikerjakan.
- `docs/PRD.md`: bagian yang dirujuk tiket. Blok `▶ Keputusan` mengalahkan teks di atasnya.

```
/
├── GLOSSARY.md
├── docs/adr/
└── src/domain/
```

## Pakai kosakata glosarium

Nama konsep domain di judul issue, nama test, nama fungsi, dan hipotesis memakai istilah `GLOSSARY.md` persis.

Konsep yang dibutuhkan mungkin belum ada di glosarium. Itu berarti salah satu dari dua hal:
- kamu sedang menciptakan bahasa yang tidak dipakai proyek, jadi pertimbangkan ulang pilihan katamu;
- ada celah nyata di glosarium. Catat celah itu sebagai usulan istilah di komentar issue untuk pemilik, karena `GLOSSARY.md` adalah berkas terlindungi.

## Tandai pertentangan dengan ADR

Bila hasil kerjamu bertentangan dengan sebuah ADR, sebut pertentangan itu secara eksplisit lalu parkir tiketnya. ADR tidak ditimpa diam-diam.
