---
status: accepted
date: 2026-11-11
---

# Pesanan ditautkan ke Member lewat email

Pembeli boleh checkout tanpa akun, dan baru diajak membuat akun Member setelah membayar. Karena itu Pesanan menyimpan email Pembeli, bukan ID Member. Riwayat Pesanan seorang Member adalah semua Pesanan yang emailnya sama dengan email Member itu, dengan perbandingan tanpa membedakan huruf besar dan kecil (PRD §7.4). Penautan ini dihitung dari email setiap kali dibutuhkan, bukan disalin ke Pesanan saat Member mendaftar.

## Considered Options

- **Menautkan Pesanan ke ID Member saat checkout.** Ditolak. Pesanan yang dibuat sebagai Tamu sebelum mendaftar tidak akan masuk riwayat, padahal alur yang diminta pemilik justru "beli dulu, buat akun sesudahnya".
- **Menyalin ID Member ke Pesanan lama saat Member mendaftar.** Ditolak. Ada dua sumber kebenaran yang bisa berbeda, misalnya setelah Admin mengoreksi email Pesanan (PRD §6.4).

## Consequences

- Email Member wajib dibuktikan lewat Kode verifikasi sebelum akun aktif (PRD §7.3). Tanpa itu, orang yang mengetik email orang lain saat checkout bisa membuka Item stok milik pemilik email.
- Email Member tidak bisa diganti (PRD §7.6). Mengizinkan ganti email butuh keputusan baru, karena riwayatnya ikut berpindah.
- Saat Admin mengoreksi email sebuah Pesanan, Pesanan itu pindah ke Riwayat Pesanan Member yang memegang email baru.
- Batas per email pada Voucher (PRD §8.5) dan batas Pesanan menunggu (PRD §5.4) memakai perbandingan email yang sama.
