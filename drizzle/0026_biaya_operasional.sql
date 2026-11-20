CREATE TABLE "biaya_operasional" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tanggal" date NOT NULL,
	"keterangan" text NOT NULL,
	"nominal" bigint NOT NULL,
	"dicatat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "biaya_operasional_nominal_minimal" CHECK ("biaya_operasional"."nominal" >= 1)
);
--> statement-breakpoint
CREATE INDEX "biaya_operasional_tanggal_idx" ON "biaya_operasional" USING btree ("tanggal");