# Keputusan terbuka

Daftar hal yang belum diputuskan pemilik produk. Agent tidak boleh mengisi nilainya sendiri.

Bila sebuah tiket membutuhkan salah satu keputusan ini:
- pakai nilai contohnya di seed dan test, dengan tanda `[CONTOH]`;
- sebut ID OD-nya di PR.

Setelah pemilik memutuskan lewat `/tiket:catat-keputusan`, keputusan itu ditulis ke `docs/PRD.md` sebagai blok ▶ Keputusan, dan barisnya dihapus dari tabel ini.

| ID | Pertanyaan | Pemilik keputusan | Yang terblokir | Nilai contoh untuk pengujian |
|---|---|---|---|---|
| OD-3 | Bila potongan voucher menjadi Rp 0 karena batas bawah Rp 1.000 (Varian dengan Harga jual tepat Rp 1.000), apakah Voucher ditolak atau tetap tercatat dipakai? | Pemilik | Tiket penerapan Voucher di checkout (M2), PRD §8.3, §8.7 | Voucher ditolak dengan pesan "Voucher tidak memberi potongan untuk produk ini", dan tidak tercatat di Pesanan `[CONTOH]` |
