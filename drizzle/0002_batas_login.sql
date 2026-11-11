CREATE TABLE "batas_login" (
	"email" text PRIMARY KEY NOT NULL,
	"jumlah_salah" integer DEFAULT 0 NOT NULL,
	"terkunci_sampai" timestamp with time zone
);
