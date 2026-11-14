#!/usr/bin/env bash
# Memulihkan database toko dari satu cadangan harian (docs/DEPLOY.md, bagian Restore). Dijalankan di server:
#
#   bash /opt/akun-digital/repo/deploy/pulihkan.sh <nama berkas cadangan>
#
# Isi database diganti seluruhnya dengan isi cadangan itu:
#   1. aplikasi dan layanan cadangan dihentikan;
#   2. database dihapus, lalu dibuat ulang kosong;
#   3. isi cadangan dimuat dengan pg_restore;
#   4. migrasi dari commit yang terpasang dijalankan, karena cadangan bisa berasal dari versi yang lebih lama;
#   5. aplikasi dan layanan cadangan dinyalakan lagi.
# Folder unggahan tidak disentuh. Berkas env produksi dibaca dari BERKAS_ENV, sama seperti deploy/deploy.sh.
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BERKAS_ENV="${BERKAS_ENV:-/opt/akun-digital/produksi.env}"
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO/compose.prod.yml}"
export COMPOSE_ENV_FILES="$BERKAS_ENV"

langkah() {
	printf '\n▶ %s\n' "$*"
}

gagal() {
	printf '\n✗ %s\n' "$*" >&2
	exit 1
}

nama="${1:-}"
[[ "$nama" =~ ^akun-digital-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}\.dump$ ]] ||
	gagal "Nama berkas cadangan belum diisi atau tidak sah. Lihat daftar cadangan dengan \`docker compose exec cadangan ls -l /cadangan\` (docs/DEPLOY.md), lalu jalankan \`bash $REPO/deploy/pulihkan.sh <nama berkas>\`, misalnya akun-digital-2026-11-15-000512.dump."
[[ -r "$BERKAS_ENV" ]] ||
	gagal "Berkas env produksi $BERKAS_ENV tidak ada atau tidak terbaca. Buat berkas itu mengikuti docs/DEPLOY.md, lalu jalankan ulang perintah ini."
cd "$REPO"

# Masukan dari terminal disimpan untuk pertanyaan konfirmasi, jadi perintah sebelumnya tidak boleh membacanya.
docker compose up --detach --wait postgres cadangan </dev/null
docker compose exec -T cadangan test -f "/cadangan/$nama" </dev/null ||
	gagal "Cadangan $nama tidak ada di volume cadangan. Lihat daftar cadangan dengan \`docker compose exec cadangan ls -l /cadangan\`, lalu jalankan ulang dengan nama yang ada."

printf 'Isi database toko akan DIGANTI seluruhnya dengan cadangan %s.\n' "$nama"
printf 'Pesanan dan perubahan yang dibuat setelah cadangan itu akan hilang.\n'
jawaban=""
read -r -p 'Ketik PULIHKAN untuk melanjutkan: ' jawaban || true
[[ "$jawaban" == "PULIHKAN" ]] || gagal "Dibatalkan, database tidak diubah. Untuk memulihkan, jalankan ulang perintah ini lalu ketik PULIHKAN."

langkah "1/5 Menghentikan aplikasi dan layanan cadangan"
docker compose stop app cadangan

langkah "2/5 Membuat ulang database kosong"
docker compose run --rm --no-deps -T cadangan \
	bash -c 'dropdb --force --if-exists "$PGDATABASE" && createdb "$PGDATABASE"'

langkah "3/5 Memuat isi cadangan $nama"
docker compose run --rm --no-deps -T cadangan \
	bash -c 'pg_restore --dbname="$PGDATABASE" --no-owner --exit-on-error "/cadangan/$1"' _ "$nama" ||
	gagal "Cadangan $nama gagal dimuat; lihat galat di atas. Aplikasi masih berhenti. Ulangi perintah ini dengan cadangan lain."

langkah "4/5 Migrasi database"
docker compose run --rm --no-deps app node_modules/.bin/drizzle-kit migrate

langkah "5/5 Menyalakan aplikasi dan layanan cadangan"
docker compose up --detach --wait --wait-timeout 300 app cadangan

printf '\n✓ Database dipulihkan dari %s.\n' "$nama"
