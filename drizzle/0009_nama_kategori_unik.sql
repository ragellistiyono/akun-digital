-- Nama Kategori unik (PRD §3.1 ▶ Keputusan 2026-11-11). Kategori yang sudah tersimpan sebelum aturan ini
-- bisa bernama kembar. Satu Kategori per nama tetap memakai namanya; Kategori lain yang kembar diberi
-- akhiran id-nya, supaya indeks unik bisa dibuat tanpa menghapus data. Admin bisa menggantinya lagi.
UPDATE "kategori" SET "nama" = "kategori"."nama" || ' (' || "kategori"."id" || ')'
FROM (
	SELECT "id", row_number() OVER (PARTITION BY lower(btrim("nama")) ORDER BY "id") AS "urutan"
	FROM "kategori"
) AS "kembar"
WHERE "kembar"."id" = "kategori"."id" AND "kembar"."urutan" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "kategori_nama_unik" ON "kategori" USING btree (lower(btrim("nama")));
