CREATE TABLE "batas_ganti_password" (
	"user_id" text PRIMARY KEY NOT NULL,
	"jumlah_salah" integer DEFAULT 0 NOT NULL,
	"terkunci_sampai" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "batas_ganti_password" ADD CONSTRAINT "batas_ganti_password_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;