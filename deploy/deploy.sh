#!/usr/bin/env bash
# Memasang satu commit di server produksi (PRD §12, docs/DEPLOY.md). Dijalankan workflow Deploy
# (.github/workflows/deploy.yml) lewat SSH setelah CI hijau di main, atau oleh pengelola server:
#
#   bash /opt/akun-digital/repo/deploy/deploy.sh <commit>
#
# Urutannya:
#   1. ambil commit itu dari GitHub;
#   2. build image aplikasi;
#   3. jalankan migrasi database;
#   4. nyalakan ulang aplikasi tanpa menghapus data (volume tidak pernah dihapus);
#   5. cek kesehatan: halaman awal terbuka lewat HTTPS, dan http:// dialihkan ke https://.
#
# Berkas env produksi dibaca dari BERKAS_ENV, bawaannya /opt/akun-digital/produksi.env. Docker Compose memakai
# compose.prod.yml di repo ini, kecuali COMPOSE_FILE sudah diisi.
#
# Keluaran skrip ini masuk log GitHub Actions, yang terbuka untuk umum karena repo-nya publik. Karena itu skrip
# ini tidak pernah mencetak log container atau galat database, yang bisa memuat email Pembeli, nomor Pesanan,
# atau IP pengunjung. Bila ada yang gagal, skrip menyebut perintah untuk melihatnya langsung di server.
#
# Semua langkah ada di dalam fungsi, dan baris terakhir berkas ini memanggilnya, sehingga bash sudah membaca
# seluruh berkas sebelum `git checkout` menggantinya. Setelah commit diambil, langkah 2–5 dijalankan oleh
# deploy.sh dari commit itu sendiri, yang dipanggil ulang dengan DEPLOY_COMMIT_DIAMBIL berisi commit tersebut.
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BERKAS_ENV="${BERKAS_ENV:-/opt/akun-digital/produksi.env}"
export COMPOSE_FILE="${COMPOSE_FILE:-$REPO/compose.prod.yml}"
export COMPOSE_ENV_FILES="$BERKAS_ENV"

# Percobaan cek HTTPS, berjeda 5 detik. Pada deploy pertama, Caddy butuh waktu untuk mengambil sertifikat.
PERCOBAAN_CEK_HTTPS=36

langkah() {
	printf '\n▶ %s\n' "$*"
}

gagal() {
	printf '\n✗ %s\n' "$*" >&2
	exit 1
}

ambil_commit() {
	local commit=$1 sebelumnya
	langkah "1/5 Mengambil commit $commit"
	cd "$REPO"
	sebelumnya="$(git rev-parse HEAD)"
	git fetch --quiet --prune origin ||
		gagal "Repo GitHub tidak bisa diambil. Periksa koneksi internet server, lalu jalankan ulang deploy."
	git cat-file -e "$commit^{commit}" 2>/dev/null ||
		gagal "Commit $commit tidak ada di GitHub. Periksa commit-nya, lalu jalankan ulang deploy."
	git merge-base --is-ancestor "$commit" origin/main ||
		gagal "Commit $commit bukan bagian dari branch main, jadi tidak dipasang. Pilih commit dari main, lalu jalankan ulang deploy."
	git checkout --quiet --detach "$commit" ||
		gagal "Commit $commit tidak bisa diambil karena ada berkas yang diubah langsung di $REPO. Lihat \`git -C $REPO status\`, kembalikan berkas itu, lalu jalankan ulang deploy."
	commit="$(git rev-parse HEAD)"
	DEPLOY_COMMIT_DIAMBIL="$commit" DEPLOY_COMMIT_SEBELUMNYA="$sebelumnya" \
		exec bash "$REPO/deploy/deploy.sh" "$commit"
}

# Awalan perintah docker compose yang bisa disalin pengelola server, dengan berkas compose dan env yang sama
# seperti deploy ini.
perintah_compose() {
	printf 'cd %s && COMPOSE_FILE=%s COMPOSE_ENV_FILES=%s docker compose' "$REPO" "$COMPOSE_FILE" "$BERKAS_ENV"
}

# Dipanggil lewat trap EXIT bila deploy gagal setelah commit diambil: menampilkan keadaan layanan, termasuk
# status health, tanpa isi log-nya.
# shellcheck disable=SC2317
tampilkan_keadaan() {
	printf '\n--- Keadaan layanan ---\n' >&2
	docker compose ps --all >&2 || true
	printf '\nLog aplikasi dan Caddy tidak ditampilkan di sini, karena log GitHub Actions terbuka untuk umum. Lihat log itu di server dengan:\n  %s logs --tail 100 app caddy\n' \
		"$(perintah_compose)" >&2
	printf '\n✗ Deploy %s gagal. Data tidak dihapus. Untuk kembali ke versi sebelumnya, jalankan:\n  bash %s/deploy/deploy.sh %s\n' \
		"${DEPLOY_COMMIT_DIAMBIL:-}" "$REPO" "${DEPLOY_COMMIT_SEBELUMNYA:-<commit sebelumnya>}" >&2
}

cek_kesehatan() {
	local alamat host i hasil
	alamat="$(docker compose exec -T caddy printenv APP_URL)" ||
		gagal "APP_URL tidak bisa dibaca dari layanan caddy, karena layanan itu tidak berjalan. Lihat keadaan layanan dan perintah melihat log di bawah, perbaiki penyebabnya, lalu jalankan ulang deploy."
	[[ "$alamat" == https://* ]] ||
		gagal "APP_URL di $BERKAS_ENV bernilai \"$alamat\", padahal harus diawali https://. Perbaiki APP_URL, lalu jalankan ulang deploy."
	host="${alamat#https://}"
	host="${host%%/*}"

	for ((i = 1; ; i++)); do
		if curl --fail --silent --show-error --output /dev/null --max-time 10 \
			--resolve "$host:443:127.0.0.1" "https://$host/"; then
			break
		fi
		((i < PERCOBAAN_CEK_HTTPS)) ||
			gagal "https://$host/ belum terbuka setelah $PERCOBAAN_CEK_HTTPS percobaan. Bila ini deploy pertama, pastikan domain menunjuk ke server ini dan port 80 serta 443 terbuka. Lihat juga log Caddy di server dengan perintah di bawah."
		sleep 5
	done
	echo "  https://$host/ terbuka."

	hasil="$(curl --silent --show-error --output /dev/null --max-time 10 \
		--write-out '%{http_code} %{redirect_url}' \
		--resolve "$host:80:127.0.0.1" "http://$host/")" ||
		gagal "http://$host/ tidak bisa dibuka (galat curl di atas). Pastikan layanan caddy berjalan dan port 80 di server tidak dipakai program lain, lalu jalankan ulang deploy."
	case "$hasil" in
	"301 https://$host/" | "302 https://$host/" | "307 https://$host/" | "308 https://$host/") ;;
	*) gagal "http://$host/ tidak dialihkan ke https://$host/ (jawaban: $hasil). Periksa deploy/Caddyfile dan log Caddy di server dengan perintah di bawah." ;;
	esac
	echo "  http://$host/ dialihkan ke https://$host/."
}

pasang() {
	local commit=$1
	cd "$REPO"
	[[ -r "$BERKAS_ENV" ]] ||
		gagal "Berkas env produksi $BERKAS_ENV tidak ada atau tidak terbaca. Buat berkas itu mengikuti docs/DEPLOY.md, lalu jalankan ulang deploy."
	command -v curl >/dev/null ||
		gagal "Perintah curl tidak ada di server, padahal dipakai untuk cek kesehatan. Minta pemilik server memasang curl, lalu jalankan ulang deploy."
	trap '(($? == 0)) || tampilkan_keadaan' EXIT

	langkah "2/5 Build image aplikasi"
	docker compose pull --quiet --ignore-buildable
	docker compose build --pull app

	langkah "3/5 Migrasi database"
	docker compose up --detach --wait postgres
	# Galat migrasi bisa memuat isi baris database, jadi keluarannya tidak dicetak ke log Actions.
	docker compose run --rm --no-deps app node_modules/.bin/drizzle-kit migrate >/dev/null 2>&1 ||
		gagal "Migrasi database gagal. Galatnya tidak ditampilkan di sini, karena log GitHub Actions terbuka untuk umum dan galat database bisa memuat data toko. Lihat galatnya dengan menjalankan migrasi di server: $(perintah_compose) run --rm --no-deps app node_modules/.bin/drizzle-kit migrate"
	echo "  Migrasi selesai."

	langkah "4/5 Menyalakan ulang aplikasi"
	docker compose up --detach --wait --wait-timeout 300 --remove-orphans
	# Caddyfile dan skrip cadangan dari commit baru dipakai tanpa membuat ulang container-nya.
	docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
	docker compose restart cadangan

	langkah "5/5 Cek kesehatan"
	cek_kesehatan

	# Image aplikasi lama yang sudah tidak dipakai.
	docker image prune --force >/dev/null
	printf '\n✓ Deploy %s selesai.\n' "$commit"
}

utama() {
	local commit="${1:-}"
	[[ "$commit" =~ ^[0-9a-f]{7,40}$ ]] ||
		gagal "Commit belum diisi atau tidak sah. Jalankan \`bash $REPO/deploy/deploy.sh <commit>\`, dengan <commit> berupa hash commit di main, misalnya hasil \`git -C $REPO rev-parse origin/main\` setelah \`git -C $REPO fetch origin\`."
	if [[ "${DEPLOY_COMMIT_DIAMBIL:-}" == "$commit" ]]; then
		pasang "$commit"
	else
		ambil_commit "$commit"
	fi
}

utama "$@"; exit
