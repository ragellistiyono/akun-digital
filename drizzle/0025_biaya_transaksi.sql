ALTER TABLE "pengaturan_toko" ADD COLUMN "persen_biaya_transaksi" numeric(4, 2) DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "pengaturan_toko" ADD COLUMN "minimal_total_bayar_biaya_transaksi" bigint DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "pesanan" ADD COLUMN "biaya_transaksi" integer;--> statement-breakpoint
ALTER TABLE "pengaturan_toko" ADD CONSTRAINT "pengaturan_toko_persen_biaya_transaksi_rentang" CHECK ("pengaturan_toko"."persen_biaya_transaksi" between 0 and 10);--> statement-breakpoint
ALTER TABLE "pengaturan_toko" ADD CONSTRAINT "pengaturan_toko_minimal_biaya_transaksi_tidak_negatif" CHECK ("pengaturan_toko"."minimal_total_bayar_biaya_transaksi" >= 0);--> statement-breakpoint
-- Pesanan yang sudah dibayar sebelum Biaya transaksi tayang dihitung sekali dengan nilai awal (PRD §14.3): persen 0,7 dan minimal Total bayar Rp 100.000. Hitungannya bilangan bulat seperti biayaTransaksi di src/domain/biaya-transaksi.ts: Total bayar × 70 ÷ 10.000, dibulatkan ke atas.
UPDATE "pesanan" SET "biaya_transaksi" = CASE WHEN "total_bayar" >= 100000 THEN ("total_bayar"::bigint * 70 + 9999) / 10000 ELSE 0 END WHERE "biaya_transaksi" IS NULL AND "status" IN ('Selesai', 'Bermasalah', 'Dana Dikembalikan');
