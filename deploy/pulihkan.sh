#!/usr/bin/env bash
# Memulihkan database toko dan folder unggahan dari cadangan harian (docs/DEPLOY.md, bagian Restore). Dijalankan
# di server dengan nama cadangan database:
#
#   bash /opt/akun-digital/repo/deploy/pulihkan.sh <nama berkas cadangan>
#
# Arsip unggahan dicari dari tanggal di nama cadangan itu, misalnya akun-digital-2026-11-16-000512.dump dipasangkan
# dengan akun-digital-unggahan-2026-11-16-<jam>.tar.gz. Isi database, dan isi folder unggahan bila arsipnya ada,
# diganti seluruhnya:
#   1. aplikasi dan layanan cadangan dihentikan;
#   2. database dihapus, lalu dibuat ulang kosong;
#   3. isi cadangan dimuat dengan pg_restore;
#   4. migrasi dari commit yang terpasang dijalankan, karena cadangan bisa berasal dari versi yang lebih lama;
#   5. isi folder unggahan diganti dengan isi arsip unggahan. Bila arsip bertanggal sama tidak ada, misalnya
#      cadangan dari sebelum folder unggahan ikut dicadangkan, folder unggahan tidak disentuh;
#   6. aplikasi dan layanan cadangan dinyalakan lagi.
# Berkas env produksi dibaca dari BERKAS_ENV, sama seperti deploy/deploy.sh.
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BERKAS_ENV="${BERKAS_ENV:-/opt/akun-digital/produksi.env}"
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO/compose.prod.yml}"
export COMPOSE_ENV_FILES="$BERKAS_ENV"

# Nomor langkah yang sedang berjalan, dipakai pesan kegagalan.
tahap=0

langkah() {
	tahap="${1%%/*}"
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

# Arsip unggahan bertanggal sama dengan cadangan database. Bila ada lebih dari satu, yang terbaru dipakai.
tanggal="${nama:13:10}"
arsip="$(docker compose exec -T cadangan bash -c \
	'shopt -s nullglob; semua=(/cadangan/akun-digital-unggahan-"$1"-*.tar.gz); ((${#semua[@]} == 0)) || basename -- "${semua[-1]}"' \
	_ "$tanggal" </dev/null)"
tanpa_arsip="Arsip unggahan bertanggal $tanggal tidak ada di volume cadangan, misalnya karena cadangan ini dibuat sebelum folder unggahan ikut dicadangkan. Folder unggahan (ikon Kategori dan foto Produk) tidak disentuh."
langkah_tanpa_arsip="Setelah restore, buka toko dan periksa ikon Kategori dan foto Produk. Bila ada yang hilang, unggah ulang lewat dasbor admin. Bila arsip unggahan tanggal itu tersimpan di komputer Anda, masukkan dulu ke volume cadangan (docs/DEPLOY.md), lalu jalankan ulang restore."

# Arsip yang rusak, misalnya salinan yang terpotong saat dikirim ke server, ditolak sebelum apa pun diubah.
if [[ -n "$arsip" ]]; then
	docker compose exec -T cadangan tar --list --gzip --file="/cadangan/$arsip" >/dev/null </dev/null ||
		gagal "Arsip unggahan $arsip rusak atau tidak terbaca (galat di atas). Database dan folder unggahan belum diubah. Pilih cadangan dari tanggal lain dengan \`docker compose exec cadangan ls -l /cadangan\`, atau ganti arsip itu dengan salinan yang utuh (docs/DEPLOY.md), lalu jalankan ulang restore."
fi

printf 'Isi database toko akan DIGANTI seluruhnya dengan cadangan %s.\n' "$nama"
if [[ -n "$arsip" ]]; then
	printf 'Isi folder unggahan (ikon Kategori dan foto Produk) akan DIGANTI seluruhnya dengan arsip %s.\n' "$arsip"
	printf 'Pesanan, perubahan, dan unggahan yang dibuat setelah cadangan itu akan hilang.\n'
else
	printf 'Pesanan dan perubahan yang dibuat setelah cadangan itu akan hilang.\n'
	printf '%s\n%s\n' "$tanpa_arsip" "$langkah_tanpa_arsip"
fi
jawaban=""
read -r -p 'Ketik PULIHKAN untuk melanjutkan: ' jawaban || true
[[ "$jawaban" == "PULIHKAN" ]] || gagal "Dibatalkan, database dan folder unggahan tidak diubah. Untuk memulihkan, jalankan ulang perintah ini lalu ketik PULIHKAN."

perintah_compose="cd $REPO && COMPOSE_FILE=$COMPOSE_FILE COMPOSE_ENV_FILES=$BERKAS_ENV docker compose"

# Dipanggil lewat trap EXIT bila salah satu langkah di bawah gagal: menyebut keadaan toko dan langkah berikutnya.
# shellcheck disable=SC2317
restore_gagal() {
	printf '\n✗ Restore gagal di langkah %s/6; galatnya ada di atas.\n' "$tahap" >&2
	case "$tahap" in
	1)
		printf 'Database dan folder unggahan belum diubah. Nyalakan lagi aplikasi dan layanan cadangan dengan:\n  %s up --detach --wait app cadangan\nlalu ulangi restore bila masih diperlukan.\n' \
			"$perintah_compose" >&2
		;;
	2 | 3 | 4)
		printf 'Aplikasi dan layanan cadangan masih berhenti, isi database mungkin kosong atau belum lengkap, dan folder unggahan belum diubah. Ulangi restore dengan cadangan yang sama, atau dengan cadangan lain bila galatnya sama:\n  bash %s/deploy/pulihkan.sh <nama berkas cadangan>\n' \
			"$REPO" >&2
		;;
	5)
		printf 'Isi database sudah dipulihkan, tetapi aplikasi dan layanan cadangan masih berhenti, dan folder unggahan mungkin kosong atau belum lengkap. Ulangi restore dengan cadangan yang sama, atau dengan cadangan lain bila galatnya sama:\n  bash %s/deploy/pulihkan.sh %s\n' \
			"$REPO" "$nama" >&2
		;;
	6)
		printf 'Isi database dan folder unggahan sudah dipulihkan, tetapi aplikasi belum sehat. Lihat lognya dengan:\n  %s logs --tail 100 app\nperbaiki penyebabnya, lalu nyalakan lagi dengan:\n  %s up --detach --wait app cadangan\n' \
			"$perintah_compose" "$perintah_compose" >&2
		;;
	esac
}
trap '(($? == 0)) || restore_gagal' EXIT

langkah "1/6 Menghentikan aplikasi dan layanan cadangan"
docker compose stop app cadangan

langkah "2/6 Membuat ulang database kosong"
docker compose run --rm --no-deps -T cadangan \
	bash -c 'dropdb --force --if-exists "$PGDATABASE" && createdb "$PGDATABASE"'

langkah "3/6 Memuat isi cadangan $nama"
docker compose run --rm --no-deps -T cadangan \
	bash -c 'pg_restore --dbname="$PGDATABASE" --no-owner --exit-on-error "/cadangan/$1"' _ "$nama"

langkah "4/6 Migrasi database"
docker compose run --rm --no-deps app node_modules/.bin/drizzle-kit migrate

if [[ -n "$arsip" ]]; then
	langkah "5/6 Memulihkan folder unggahan dari $arsip"
	# Layanan cadangan memasang volume unggahan hanya-baca, jadi untuk restore volume itu dipasang lagi dengan
	# akses tulis di /unggahan-pulih. Pemilik berkas diambil dari angka di arsip, sama dengan pengguna aplikasi.
	docker compose run --rm --no-deps -T --volume unggahan:/unggahan-pulih cadangan \
		bash -c 'find /unggahan-pulih -mindepth 1 -delete &&
			tar --extract --gzip --numeric-owner --file="/cadangan/$1" --directory=/unggahan-pulih' _ "$arsip"
else
	langkah "5/6 Folder unggahan tidak disentuh"
	printf '  %s\n' "$tanpa_arsip"
fi

langkah "6/6 Menyalakan aplikasi dan layanan cadangan"
docker compose up --detach --wait --wait-timeout 300 app cadangan

if [[ -n "$arsip" ]]; then
	printf '\n✓ Database dipulihkan dari %s, dan folder unggahan dari %s.\n' "$nama" "$arsip"
else
	printf '\n✓ Database dipulihkan dari %s. Folder unggahan tidak disentuh, karena arsip unggahan bertanggal %s tidak ada.\n%s\n' \
		"$nama" "$tanggal" "$langkah_tanpa_arsip"
fi
