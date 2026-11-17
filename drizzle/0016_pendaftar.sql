CREATE TABLE "pendaftar" (
	"email" text PRIMARY KEY NOT NULL,
	"password" text NOT NULL,
	"kode_verifikasi" text NOT NULL,
	"kode_dikirim_pada" timestamp with time zone NOT NULL
);
