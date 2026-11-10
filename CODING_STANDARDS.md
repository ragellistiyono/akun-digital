# Standar Kode

Dokumen ini dipakai oleh dua subagent:
- `tiket:pelaksana`, saat menulis kode;
- `tiket:peninjau`, pada sumbu Standards.

Aturan yang sudah ditegakkan alat lewat `pnpm verify` tidak perlu diulang di sini. Stack dicatat di ADR-0001.

## Bahasa dan penamaan

- Konsep domain memakai istilah `GLOSSARY.md` persis. Konsep pemrograman umum memakai bahasa Inggris, misalnya `parse`, `result`, dan `handler`.
- Teks antarmuka, pesan kesalahan, pesan commit, dan isi PR memakai bahasa Indonesia.
- Setiap pesan kesalahan menyebut sebabnya dan langkah berikutnya.
- Data dari luar (form, request, berkas impor) divalidasi di batas sistem sebelum dipakai.

## Batas modul

- `src/domain/` berisi aturan bisnis murni (ADR-0002). Isinya fungsi input → output yang deterministik: tanpa database, I/O, framework, dan jam sistem.
- Lapisan lain memanggil domain, tidak sebaliknya. Aturan impor ini ditegakkan alat di `pnpm verify`.

## Stack: Next.js + PostgreSQL

### Bahasa

- TypeScript `strict`, tanpa `any`.
- Data dari luar bertipe `unknown`, lalu divalidasi dengan Zod.

### Struktur folder

- `src/domain/` berisi aturan bisnis murni.
- `src/server/` berisi database, berkas, email, waktu, dan pekerjaan latar.
- `src/app/` berisi rute, Server Action, dan komponen.

Arah impornya satu jalan:
- `src/domain/` tidak mengimpor `src/server/` maupun `src/app/`;
- `src/server/` tidak mengimpor `src/app/`.

Aturan impor ini ditegakkan dependency-cruiser.

### Server Action dan route handler

Server Action dan route handler dibuat tipis. Urutannya selalu:
1. baca sesi;
2. validasi input dengan Zod;
3. periksa kewenangan di server;
4. panggil domain atau server;
5. kembalikan hasil.

Menyembunyikan tombol di tampilan bukan pemeriksaan kewenangan.

### Komponen

- Komponen tampilan tidak menghitung aturan bisnis. Komponen menampilkan hasil beserta bahan hitungnya.
- Komponen shadcn/ui ada di `src/components/ui/`. Komponen baru hanya dibuat bila issue menyebutnya.

### Database dan waktu

- Database diakses lewat Drizzle ORM, dan migrasinya dibuat dengan Drizzle Kit.
- Migrasi yang sudah di-merge tidak diubah. Setiap perubahan dibuat sebagai migrasi baru.
- Instan waktu disimpan sebagai `timestamptz` (UTC).
- Konversi zona waktu hanya dilakukan di satu modul di `src/server/`.

## Test

- Test ditulis di seam yang disebut issue.
- Tiket yang menyentuh aturan bisnis wajib menambah unit test di modul domain.
- Ekspektasi test diambil dari `tests/golden/`, dari PRD, atau dari contoh literal di issue. Ekspektasi tidak boleh dihitung dengan rumus yang sama seperti di kode.
- Data nyata tidak di-commit. Seed dan test memakai data sintetis, dan nilai dari `docs/OPEN-DECISIONS.md` diberi tanda `[CONTOH]`.

## Dependency

- Dependency baru hanya boleh dari `.github/dependency-allowlist.txt`. Selain itu harus disetujui pemilik.
- Tidak boleh ada berkas, export, atau dependency yang tidak dipakai.

## Daftar periksa peninjau (review checklist)

<!-- Aturan khusus proyek ini, yang diperiksa tiket:peninjau di setiap tiket.
Tulis satu butir per baris, dan setiap butir harus bisa dicek lulus/gagal.
Contoh: "Setiap perubahan stok menulis satu baris riwayat beserta pelakunya."
Butir bisa ditambah lewat keputusan pemilik atau dari hasil /retro. -->

- (belum ada)
