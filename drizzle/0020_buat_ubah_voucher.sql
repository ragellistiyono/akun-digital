CREATE TYPE "public"."jenis_potongan" AS ENUM('nominal', 'persen');--> statement-breakpoint
CREATE TABLE "voucher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode" text NOT NULL,
	"jenis_potongan" "jenis_potongan" NOT NULL,
	"nilai" integer NOT NULL,
	"batas_maksimum" integer,
	"kuota_voucher" integer,
	"batas_per_email" integer,
	"minimal_harga_jual" integer,
	"mulai" timestamp with time zone,
	"berakhir" timestamp with time zone,
	"khusus_member" boolean DEFAULT false NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "voucher_kode_unik" ON "voucher" USING btree (upper(btrim("kode")));