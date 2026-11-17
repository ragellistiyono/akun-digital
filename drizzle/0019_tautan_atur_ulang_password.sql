CREATE TABLE "tautan_atur_ulang_password" (
	"hash_tautan" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dikirim_pada" timestamp with time zone NOT NULL,
	"dipakai_pada" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tautan_atur_ulang_password" ADD CONSTRAINT "tautan_atur_ulang_password_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tautan_atur_ulang_password_user_id_dikirim_pada_idx" ON "tautan_atur_ulang_password" USING btree ("user_id","dikirim_pada");