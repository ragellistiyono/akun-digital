# Keputusan terbuka

Daftar hal yang belum diputuskan pemilik produk. Agent tidak boleh mengisi nilainya sendiri.

Bila sebuah tiket membutuhkan salah satu keputusan ini:
- pakai nilai contohnya di seed dan test, dengan tanda `[CONTOH]`;
- sebut ID OD-nya di PR.

Setelah pemilik memutuskan lewat `/tiket:catat-keputusan`, keputusan itu ditulis ke `docs/PRD.md` sebagai blok ▶ Keputusan, dan barisnya dihapus dari tabel ini.

| ID | Pertanyaan | Pemilik keputusan | Yang terblokir | Nilai contoh untuk pengujian |
|---|---|---|---|---|
| OD-1 | Domain apa yang dipakai untuk alamat web toko dan pengirim email? | Pemilik | Pengiriman email ke Pembeli sungguhan dan pemasangan di VPS (PRD §10.1, §12). Pengembangan dan test tidak terblokir. | Domain `miwe.example`, pengirim `MIWE Digital Store <no-reply@miwe.example>` `[CONTOH]` |
| OD-3 | Bila potongan voucher menjadi Rp 0 karena batas bawah Rp 1.000 (Varian dengan Harga jual tepat Rp 1.000), apakah Voucher ditolak atau tetap tercatat dipakai? | Pemilik | Tiket penerapan Voucher di checkout (M2), PRD §8.3, §8.7 | Voucher ditolak dengan pesan "Voucher tidak memberi potongan untuk produk ini", dan tidak tercatat di Pesanan `[CONTOH]` |
