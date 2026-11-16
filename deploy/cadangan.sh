#!/usr/bin/env bash
# Cadangan harian database dan folder unggahan (PRD §12, Keputusan #121). Dijalankan layanan cadangan di
# compose.prod.yml, di dalam image postgres yang memuat pg_dump dan tar. Koneksi ke database dibaca pg_dump dari
# PGHOST, PGUSER, PGPASSWORD, dan PGDATABASE. Volume unggahan dipasang hanya-baca di /unggahan.
#
# Setiap jam, dan sekali saat layanan menyala, skrip ini memeriksa apakah cadangan bertanggal hari ini (WIB)
# sudah ada. Bila cadangan database belum ada, pg_dump membuat satu cadangan di /cadangan. Setelah cadangan
# database hari ini ada, folder unggahan diarsipkan sekali dengan tanggal yang sama. Cadangan database dan arsip
# unggahan masing-masing menyimpan tujuh cadangan terakhir; yang lebih lama dihapus setiap kali cadangan baru
# jenis itu berhasil dibuat. Jadi cadangan dibuat sekali sehari, pada pemeriksaan pertama setelah pukul
# 00.00 WIB. Cara memulihkannya ada di deploy/pulihkan.sh dan docs/DEPLOY.md.
set -uo pipefail
shopt -s nullglob

FOLDER=/cadangan
UNGGAHAN=/unggahan
SIMPAN=7
JEDA_PERIKSA_DETIK=3600

# Nama berkas cadangan, misalnya akun-digital-2026-11-16-000512.dump dan
# akun-digital-unggahan-2026-11-16-000512.tar.gz. Urutan nama sama dengan urutan waktu.
AWALAN=akun-digital-
AWALAN_UNGGAHAN=akun-digital-unggahan-

# Menghapus berkas satu jenis cadangan yang lebih lama dari SIMPAN berkas terakhir. Jenis cadangan dikenali dari
# awalan dan akhiran namanya.
hapus_cadangan_lama() {
	local jenis=$1 awalan=$2 akhiran=$3
	local semua=("$FOLDER/$awalan"[0-9]*"$akhiran")
	local lebih=$((${#semua[@]} - SIMPAN))
	if ((lebih > 0)); then
		rm -f -- "${semua[@]:0:lebih}"
		echo "${jenis^} lama dihapus: ${lebih} berkas. Yang tersimpan: ${SIMPAN} ${jenis} terakhir."
	fi
}

# Membuat satu cadangan database. Berkas ditulis dengan nama sementara dan baru diberi nama akhir setelah isinya
# terbaca utuh, jadi cadangan yang gagal di tengah jalan tidak pernah terhitung sebagai cadangan.
buat_cadangan() {
	local nama sementara
	nama="$AWALAN$1.dump"
	sementara="$FOLDER/.$nama.sementara"
	if pg_dump --format=custom --file="$sementara" &&
		pg_restore --list "$sementara" >/dev/null &&
		mv -- "$sementara" "$FOLDER/$nama"; then
		echo "Cadangan dibuat: $nama"
		hapus_cadangan_lama "cadangan" "$AWALAN" .dump
	else
		rm -f -- "$sementara"
		echo "Cadangan gagal dibuat; lihat galat di atas. Pemeriksaan berikutnya mencoba lagi dalam ${JEDA_PERIKSA_DETIK} detik." >&2
		return 1
	fi
}

# Membuat satu arsip folder unggahan dengan pola yang sama: nama sementara, diperiksa terbaca, baru nama akhir.
# Folder unggahan yang kosong tetap menghasilkan arsip kosong yang sah.
buat_arsip_unggahan() {
	local nama sementara
	nama="$AWALAN_UNGGAHAN$1.tar.gz"
	sementara="$FOLDER/.$nama.sementara"
	if tar --create --gzip --file="$sementara" --directory="$UNGGAHAN" . &&
		tar --list --gzip --file="$sementara" >/dev/null &&
		mv -- "$sementara" "$FOLDER/$nama"; then
		echo "Arsip unggahan dibuat: $nama"
		hapus_cadangan_lama "arsip unggahan" "$AWALAN_UNGGAHAN" .tar.gz
	else
		rm -f -- "$sementara"
		echo "Arsip unggahan gagal dibuat; lihat galat di atas. Cadangan database hari ini tetap tersimpan. Pemeriksaan berikutnya mencoba lagi dalam ${JEDA_PERIKSA_DETIK} detik." >&2
		return 1
	fi
}

periksa() {
	local waktu tanggal
	waktu="$(date +%Y-%m-%d-%H%M%S)"
	tanggal="${waktu:0:10}"
	local database=("$FOLDER/$AWALAN$tanggal-"*.dump)
	local unggahan=("$FOLDER/$AWALAN_UNGGAHAN$tanggal-"*.tar.gz)
	if ((${#database[@]} == 0)); then
		buat_cadangan "$waktu" || return 0
	fi
	if ((${#unggahan[@]} == 0)); then
		buat_arsip_unggahan "$waktu" || return 0
	fi
}

mkdir -p "$FOLDER"
# Sisa cadangan yang terputus, misalnya karena layanan dihentikan saat pg_dump atau tar berjalan.
rm -f -- "$FOLDER"/.*.sementara
echo "Layanan cadangan berjalan: cadangan harian database dan folder unggahan di ${FOLDER}, ${SIMPAN} cadangan terakhir dari masing-masing disimpan."
while true; do
	periksa
	sleep "$JEDA_PERIKSA_DETIK"
done
