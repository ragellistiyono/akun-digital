CREATE TYPE "public"."status_top_up" AS ENUM('Menunggu Pembayaran', 'Berhasil', 'Kedaluwarsa', 'Dibatalkan', 'Bermasalah', 'Dana Dikembalikan');--> statement-breakpoint
CREATE TABLE "riwayat_status_top_up" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"top_up_id" uuid NOT NULL,
	"waktu" timestamp with time zone NOT NULL,
	"status" "status_top_up" NOT NULL,
	"pelaku" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_up" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor_top_up" text NOT NULL,
	"user_id" text NOT NULL,
	"nominal_top_up" integer NOT NULL,
	"kode_unik" integer NOT NULL,
	"total_bayar" integer NOT NULL,
	"qris_id" text NOT NULL,
	"kedaluwarsa_pada" timestamp with time zone NOT NULL,
	"gambar_qr" text NOT NULL,
	"status" "status_top_up" NOT NULL,
	"waktu_bayar" timestamp with time zone,
	"nominal_diterima" integer,
	"biaya_transaksi" integer
);
--> statement-breakpoint
ALTER TABLE "riwayat_status_top_up" ADD CONSTRAINT "riwayat_status_top_up_top_up_id_top_up_id_fk" FOREIGN KEY ("top_up_id") REFERENCES "public"."top_up"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up" ADD CONSTRAINT "top_up_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "riwayat_status_top_up_top_up_id_idx" ON "riwayat_status_top_up" USING btree ("top_up_id");--> statement-breakpoint
CREATE UNIQUE INDEX "top_up_nomor_top_up_unik" ON "top_up" USING btree ("nomor_top_up");--> statement-breakpoint
CREATE UNIQUE INDEX "top_up_qris_id_unik" ON "top_up" USING btree ("qris_id");--> statement-breakpoint
CREATE UNIQUE INDEX "top_up_satu_menunggu_per_member" ON "top_up" USING btree ("user_id") WHERE "top_up"."status" = 'Menunggu Pembayaran';--> statement-breakpoint
CREATE INDEX "top_up_user_id_idx" ON "top_up" USING btree ("user_id");