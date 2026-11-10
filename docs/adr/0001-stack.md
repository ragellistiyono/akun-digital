---
status: accepted
date: 2026-11-11
---

# Satu aplikasi Next.js dengan PostgreSQL

Proyek ini dibangun per tiket oleh agent otonom. Setiap lapisan teknologi tambahan menjadi tempat agent bisa tersesat, tanpa manfaat nyata. Karena itu kami memilih satu aplikasi monolit:

- **Bahasa dan framework:** Node.js 22 LTS, pnpm, Next.js App Router, dan TypeScript strict.
- **Data:** PostgreSQL dengan Drizzle ORM. Docker Compose dipakai untuk lingkungan lokal.
- **Validasi dan tampilan:**
  - Zod untuk validasi;
  - Tailwind 4 dan shadcn/ui (Radix) untuk tampilan;
  - React Hook Form untuk form.
- **Bila dibutuhkan produk:**
  - Better Auth, bila produk butuh login;
  - pg-boss, bila produk butuh pekerjaan latar. Pekerjaan latar tidak memakai Redis.
- **Test:**
  - Vitest dan Testing Library untuk test unit dan komponen;
  - Playwright untuk test end-to-end.

  `pnpm verify` menjalankan typecheck, lint, knip, dependency-cruiser, dan test.
- **Deploy:** bila produk butuh deploy, aplikasi berjalan di satu server (VPS) lewat Docker Compose.

## Considered Options

Pilihan berikut ditolak: monorepo atau Turborepo, API terpisah, Prisma, Redis dengan BullMQ, dan layanan mikro. Alasannya sama untuk semuanya: satu aplikasi sudah cukup, dan setiap lapisan tambahan menambah tempat agent bisa tersesat.

## Consequences

- Dependency yang disetujui tercatat di `.github/dependency-allowlist.txt`. Setiap dependency baru butuh persetujuan pemilik.
- Tidak ada REST API publik, kecuali PRD memintanya.
