CREATE TYPE "public"."jenis_riwayat_saldo" AS ENUM('Top up', 'Pembelian', 'Ditambah Admin', 'Dikurangi Admin');--> statement-breakpoint
CREATE TABLE "riwayat_saldo" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "riwayat_saldo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"waktu" timestamp with time zone DEFAULT now() NOT NULL,
	"jenis" "jenis_riwayat_saldo" NOT NULL,
	"nominal" bigint NOT NULL,
	"saldo_sesudah" bigint NOT NULL,
	"rujukan" text NOT NULL,
	CONSTRAINT "riwayat_saldo_nominal_bukan_nol" CHECK ("riwayat_saldo"."nominal" <> 0),
	CONSTRAINT "riwayat_saldo_saldo_sesudah_tidak_negatif" CHECK ("riwayat_saldo"."saldo_sesudah" >= 0)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "saldo" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "riwayat_saldo" ADD CONSTRAINT "riwayat_saldo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "riwayat_saldo_user_id_idx" ON "riwayat_saldo" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_saldo_tidak_negatif" CHECK ("user"."saldo" >= 0);