#!/usr/bin/env bash
# Cadangan database harian (PRD §12). Dijalankan layanan cadangan di compose.prod.yml, di dalam image postgres
# yang memuat pg_dump. Koneksi ke database dibaca pg_dump dari PGHOST, PGUSER, PGPASSWORD, dan PGDATABASE.
#
# Setiap jam, dan sekali saat layanan menyala, skrip ini memeriksa apakah cadangan bertanggal hari ini (WIB)
# sudah ada. Bila belum, pg_dump membuat satu cadangan di /cadangan, lalu cadangan yang lebih lama dari tujuh
# cadangan terakhir dihapus. Jadi cadangan dibuat sekali sehari, pada pemeriksaan pertama setelah pukul
# 00.00 WIB. Cara memulihkannya ada di deploy/pulihkan.sh dan docs/DEPLOY.md.
set -uo pipefail
shopt -s nullglob

FOLDER=/cadangan
SIMPAN=7
JEDA_PERIKSA_DETIK=3600

# Nama berkas cadangan, misalnya akun-digital-2026-11-15-000512.dump. Urutan nama sama dengan urutan waktu.
AWALAN=akun-digital-

hapus_cadangan_lama() {
	local semua=("$FOLDER/$AWALAN"*.dump)
	local lebih=$((${#semua[@]} - SIMPAN))
	if ((lebih > 0)); then
		rm -f -- "${semua[@]:0:lebih}"
		echo "Cadangan lama dihapus: ${lebih} berkas. Yang tersimpan: ${SIMPAN} cadangan terakhir."
	fi
}

# Membuat satu cadangan. Berkas ditulis dengan nama sementara dan baru diberi nama akhir setelah isinya
# terbaca utuh, jadi cadangan yang gagal di tengah jalan tidak pernah terhitung sebagai cadangan.
buat_cadangan() {
	local nama sementara
	nama="$AWALAN$(date +%Y-%m-%d-%H%M%S).dump"
	sementara="$FOLDER/.$nama.sementara"
	if pg_dump --format=custom --file="$sementara" &&
		pg_restore --list "$sementara" >/dev/null &&
		mv -- "$sementara" "$FOLDER/$nama"; then
		echo "Cadangan dibuat: $nama"
		hapus_cadangan_lama
	else
		rm -f -- "$sementara"
		echo "Cadangan gagal dibuat; lihat galat di atas. Pemeriksaan berikutnya mencoba lagi dalam ${JEDA_PERIKSA_DETIK} detik." >&2
	fi
}

periksa() {
	local hari_ini=("$FOLDER/$AWALAN$(date +%Y-%m-%d)-"*.dump)
	if ((${#hari_ini[@]} == 0)); then
		buat_cadangan
	fi
}

mkdir -p "$FOLDER"
# Sisa cadangan yang terputus, misalnya karena layanan dihentikan saat pg_dump berjalan.
rm -f -- "$FOLDER"/.*.sementara
echo "Layanan cadangan berjalan: cadangan harian di ${FOLDER}, ${SIMPAN} cadangan terakhir disimpan."
while true; do
	periksa
	sleep "$JEDA_PERIKSA_DETIK"
done
