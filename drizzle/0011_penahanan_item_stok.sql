ALTER TABLE "item_stok" ADD COLUMN "pesanan_id" uuid;--> statement-breakpoint
ALTER TABLE "item_stok" ADD CONSTRAINT "item_stok_pesanan_id_pesanan_id_fk" FOREIGN KEY ("pesanan_id") REFERENCES "public"."pesanan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_stok_pesanan_id_unik" ON "item_stok" USING btree ("pesanan_id");