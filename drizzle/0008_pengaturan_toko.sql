CREATE TABLE "pengaturan_toko" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"nomor_whatsapp" text,
	"syarat_ketentuan" text DEFAULT '' NOT NULL,
	"kebijakan_privasi" text DEFAULT '' NOT NULL,
	CONSTRAINT "pengaturan_toko_satu_baris" CHECK ("pengaturan_toko"."id" = 1)
);
