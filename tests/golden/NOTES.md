# Fixture golden

Folder ini berisi contoh hitungan yang benar, yang diturunkan dari PRD.

Folder ini hanya-baca. Agent tidak boleh mengubahnya, karena folder ini termasuk berkas terlindungi. Kalau sebuah test merah, yang diperbaiki adalah kodenya, bukan fixture di sini.

Setiap aturan PRD punya satu berkas JSON, misalnya `denda-keterlambatan.json`. Isinya kasus-kasus dengan input, output yang diharapkan, dan rujukan ke PRD §.

## Aturan yang belum punya golden

<!-- Catat di sini aturan PRD yang belum punya contoh hitungan. -->

Aturan PRD yang memuat angka tetapi belum atau tidak punya berkas golden:

- **§2.3 total belanja Member** memakai hitungan yang sama dengan `pendapatan.json`, hanya untuk Pesanan Member itu dan tanpa batas rentang waktu.
- **§3.3 hingga 5 foto per Produk** adalah batas isian form, sehingga diuji lewat test form biasa.
- **§5.5 Kode unik Rp 1–499** ditentukan Qrispy, bukan dihitung toko. Toko hanya mencatat angka yang diberikan Qrispy.
- **§5.6 hitung mundur** hanya tampilan dari waktu kedaluwarsa. Aturan waktunya ada di `kedaluwarsa-pesanan.json`.
- **§6.4 kirim ulang email otomatis "beberapa kali"**: jumlah dan jedanya keputusan teknis, bukan aturan bisnis.
- **§7.5 lama sesi login** belum diputuskan (OD-2). Nilai contohnya, Member 30 hari dan Admin 12 jam, dipakai dengan tanda `[CONTOH]`.
- **§8.3 Voucher dengan potongan Rp 0** belum diputuskan (OD-3). Hitungan potongannya sendiri sudah ada di `potongan-voucher.json`.
- **§9.2 kartu ringkasan** berupa hitungan jumlah dalam rentang dari `rentang-waktu-toko.json`. Pendapatannya ada di `pendapatan.json`.
- **§10.1 batas paket gratis Resend** adalah batas layanan luar, bukan aturan aplikasi.
- **§11.1 lebar layar 360 piksel** diuji lewat test end-to-end di ukuran ponsel.
- **§12 tujuh cadangan harian** diatur oleh skrip di server, bukan oleh modul domain.
