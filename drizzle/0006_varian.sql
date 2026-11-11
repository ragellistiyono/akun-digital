CREATE TABLE "varian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produk_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"harga_jual" integer NOT NULL,
	"harga_normal" bigint,
	"aktif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "varian" ADD CONSTRAINT "varian_produk_id_produk_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."produk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "varian_produk_id_idx" ON "varian" USING btree ("produk_id");