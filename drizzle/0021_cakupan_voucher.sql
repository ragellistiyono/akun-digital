CREATE TYPE "public"."jenis_cakupan" AS ENUM('semua', 'produk', 'kategori');--> statement-breakpoint
CREATE TABLE "voucher_kategori" (
	"voucher_id" uuid NOT NULL,
	"kategori_id" uuid NOT NULL,
	CONSTRAINT "voucher_kategori_voucher_id_kategori_id_pk" PRIMARY KEY("voucher_id","kategori_id")
);
--> statement-breakpoint
CREATE TABLE "voucher_produk" (
	"voucher_id" uuid NOT NULL,
	"produk_id" uuid NOT NULL,
	CONSTRAINT "voucher_produk_voucher_id_produk_id_pk" PRIMARY KEY("voucher_id","produk_id")
);
--> statement-breakpoint
ALTER TABLE "voucher" ADD COLUMN "cakupan" "jenis_cakupan" DEFAULT 'semua' NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_kategori" ADD CONSTRAINT "voucher_kategori_voucher_id_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."voucher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_kategori" ADD CONSTRAINT "voucher_kategori_kategori_id_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."kategori"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_produk" ADD CONSTRAINT "voucher_produk_voucher_id_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."voucher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_produk" ADD CONSTRAINT "voucher_produk_produk_id_produk_id_fk" FOREIGN KEY ("produk_id") REFERENCES "public"."produk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voucher_kategori_kategori_id_idx" ON "voucher_kategori" USING btree ("kategori_id");--> statement-breakpoint
CREATE INDEX "voucher_produk_produk_id_idx" ON "voucher_produk" USING btree ("produk_id");