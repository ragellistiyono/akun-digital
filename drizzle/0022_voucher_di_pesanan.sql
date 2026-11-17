ALTER TABLE "pesanan" ADD COLUMN "voucher_id" uuid;--> statement-breakpoint
ALTER TABLE "pesanan" ADD COLUMN "kode_voucher" text;--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_voucher_id_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."voucher"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pesanan_voucher_id_idx" ON "pesanan" USING btree ("voucher_id");--> statement-breakpoint
ALTER TABLE "pesanan" ADD CONSTRAINT "pesanan_voucher_dan_kode_bersama" CHECK (("pesanan"."voucher_id" is null) = ("pesanan"."kode_voucher" is null));