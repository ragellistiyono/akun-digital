CREATE TYPE "public"."metode" AS ENUM('QRIS', 'Saldo');--> statement-breakpoint
ALTER TABLE "pesanan" ALTER COLUMN "qris_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pesanan" ALTER COLUMN "kedaluwarsa_pada" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pesanan" ALTER COLUMN "gambar_qr" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pesanan" ADD COLUMN "metode" "metode" DEFAULT 'QRIS' NOT NULL;--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_qris_menurut_metode" CHECK (case when "pesanan"."metode" = 'QRIS' then "pesanan"."qris_id" is not null and "pesanan"."kedaluwarsa_pada" is not null and "pesanan"."gambar_qr" is not null else "pesanan"."qris_id" is null and "pesanan"."kedaluwarsa_pada" is null and "pesanan"."gambar_qr" is null and "pesanan"."kode_unik" = 0 end);