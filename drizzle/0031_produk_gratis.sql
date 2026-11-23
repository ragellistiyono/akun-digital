ALTER TYPE "public"."metode" ADD VALUE 'Gratis';--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "gratis" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "produk" ADD COLUMN "batas_per_member" integer;--> statement-breakpoint
ALTER TABLE "produk" ADD CONSTRAINT "produk_gratis_punya_batas_per_member" CHECK (not "produk"."gratis" or "produk"."batas_per_member" is not null);--> statement-breakpoint
ALTER TABLE "produk" ADD CONSTRAINT "produk_batas_per_member_rentang" CHECK ("produk"."batas_per_member" between 1 and 999);