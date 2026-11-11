CREATE TYPE "public"."status_pesanan" AS ENUM('Menunggu Pembayaran', 'Selesai', 'Kedaluwarsa', 'Dibatalkan', 'Bermasalah', 'Dana Dikembalikan');--> statement-breakpoint
CREATE TABLE "pesanan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor_pesanan" text NOT NULL,
	"tautan" text NOT NULL,
	"email" text NOT NULL,
	"varian_id" uuid NOT NULL,
	"harga_jual" integer NOT NULL,
	"potongan_voucher" integer NOT NULL,
	"kode_unik" integer NOT NULL,
	"total_bayar" integer NOT NULL,
	"qris_id" text NOT NULL,
	"kedaluwarsa_pada" timestamp with time zone NOT NULL,
	"gambar_qr" text NOT NULL,
	"status" "status_pesanan" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riwayat_status_pesanan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesanan_id" uuid NOT NULL,
	"waktu" timestamp with time zone NOT NULL,
	"status" "status_pesanan" NOT NULL,
	"pelaku" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_varian_id_varian_id_fk" FOREIGN KEY ("varian_id") REFERENCES "public"."varian"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riwayat_status_pesanan" ADD CONSTRAINT "riwayat_status_pesanan_pesanan_id_pesanan_id_fk" FOREIGN KEY ("pesanan_id") REFERENCES "public"."pesanan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pesanan_nomor_pesanan_unik" ON "pesanan" USING btree ("nomor_pesanan");--> statement-breakpoint
CREATE UNIQUE INDEX "pesanan_tautan_unik" ON "pesanan" USING btree ("tautan");--> statement-breakpoint
CREATE UNIQUE INDEX "pesanan_qris_id_unik" ON "pesanan" USING btree ("qris_id");--> statement-breakpoint
CREATE INDEX "pesanan_varian_id_idx" ON "pesanan" USING btree ("varian_id");--> statement-breakpoint
CREATE INDEX "riwayat_status_pesanan_pesanan_id_idx" ON "riwayat_status_pesanan" USING btree ("pesanan_id");