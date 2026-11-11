CREATE TABLE "produk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"kategori_id" uuid NOT NULL,
	"deskripsi" text NOT NULL,
	"ketentuan_garansi" text NOT NULL,
	"unggulan" boolean DEFAULT false NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"format_item_stok" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "produk" ADD CONSTRAINT "produk_kategori_id_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."kategori"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "produk_kategori_id_idx" ON "produk" USING btree ("kategori_id");