CREATE TYPE "public"."status_item_stok" AS ENUM('Tersedia', 'Ditahan', 'Terkirim');--> statement-breakpoint
CREATE TABLE "item_stok" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"varian_id" uuid NOT NULL,
	"isi_terenkripsi" text NOT NULL,
	"sidik_jari" text NOT NULL,
	"status" "status_item_stok" DEFAULT 'Tersedia' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_stok" ADD CONSTRAINT "item_stok_varian_id_varian_id_fk" FOREIGN KEY ("varian_id") REFERENCES "public"."varian"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_stok_varian_id_sidik_jari_idx" ON "item_stok" USING btree ("varian_id","sidik_jari");