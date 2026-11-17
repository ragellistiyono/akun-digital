CREATE TYPE "public"."peran_akun" AS ENUM('Admin', 'Member');--> statement-breakpoint
-- Sebelum T41 semua user adalah Admin, jadi baris yang sudah ada diisi "Admin". Nilai bawaan itu
-- lalu dicabut, supaya setiap user baru wajib ditulis dengan perannya sendiri.
ALTER TABLE "user" ADD COLUMN "peran" "peran_akun" DEFAULT 'Admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "peran" DROP DEFAULT;
