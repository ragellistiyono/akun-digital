---
status: accepted
date: 2026-11-11
---

# Qrispy lewat satu adaptor, dengan Qrispy tiruan untuk pengembangan dan test

Toko menerbitkan QRIS dan menerima kabar pembayaran dari Qrispy (PRD §5). Ada tiga kendala. Qrispy tidak punya mode uji. Webhook-nya hanya bisa mencapai server yang sudah terpasang. Beberapa perilakunya juga belum dijelaskan dokumentasi resmi (`docs/referensi/qrispy-api.md` bagian 6). Karena itu semua tiket harus bisa dikerjakan dan diuji tanpa Qrispy sungguhan, dan toko tidak boleh bergantung pada satu jalur kabar pembayaran saja.

## Keputusan

- **Satu adaptor.** Semua panggilan ke Qrispy lewat satu antarmuka di `src/server/`. Antarmuka itu punya dua implementasi:
  - **Qrispy sungguhan:** memanggil API dengan `fetch`, tanpa dependency baru;
  - **Qrispy tiruan:** dipakai di pengembangan, test, dan e2e. Tiruan menerbitkan QRIS dengan gambar contoh, Kode unik, dan waktu kedaluwarsa 15 menit. Tiruan juga menyediakan cara memicu pembayaran, yang hanya aktif saat tiruan dipakai.

  Variabel `QRISPY_MODE` (`tiruan` atau `sungguhan`) memilih implementasinya. `.env.example` dan `.env.ci` memakai `tiruan`.
- **Data dari Qrispy divalidasi dengan Zod** sebelum dipakai, termasuk respons API dan payload webhook.
- **Total bayar dan Kode unik diambil dari Qrispy.** Total bayar adalah `amount`, dan Kode unik adalah `unique_id`. Bila `requested_amount` tidak sama dengan nominal yang dikirim toko, atau `amount` tidak sama dengan `requested_amount + unique_id`, QRIS itu dibatalkan dan checkout gagal dengan pesan yang menyuruh Pembeli mencoba lagi.
- **Yang dikirim ke Qrispy:** `payment_reference` berisi Nomor Pesanan. `return_url` tidak dikirim, karena Tautan Pesanan bersifat rahasia (PRD §6.2) dan tidak boleh sampai ke pihak ketiga. `checkout_url` tidak dipakai.
- **Gagal membuat QRIS.** Bila Qrispy menolak atau tidak menjawab, tidak ada Pesanan yang tersisa dan tidak ada Item stok yang ditahan.
- **Webhook:**
  - Route handler membaca body mentah dengan `request.text()` sebelum di-parse.
  - Signature dihitung dengan HMAC-SHA256 memakai `QRISPY_WEBHOOK_SECRET`. Selama formatnya belum dipastikan, signature diterima bila sama dengan digest dalam hex atau base64. Perbandingannya memakai `timingSafeEqual`, setelah panjangnya dicek sama.
  - Signature salah dijawab `401` tanpa perubahan apa pun. Event selain `payment.success` dijawab `200` dan diabaikan.
  - Kabar pembayaran diproses dalam satu transaksi database, lalu dijawab `200`. Kabar dengan `qris_id` yang sama hanya diproses sekali (PRD §5.7).
- **Nominal diterima** adalah `amount` dari webhook, atau dari cek status bila statusnya `paid`. Nominal ini dibandingkan dengan Total bayar menurut PRD §5.9.
- **Dua jalur kabar pembayaran.** Webhook bukan satu-satunya jalur:
  - Halaman bayar menanyakan status ke server toko, bukan ke Qrispy.
  - Server toko menanyakan status ke Qrispy paling sering sekali per 15 detik untuk setiap Pesanan, dan sekali lagi tepat sebelum Pesanan dijadikan Kedaluwarsa.
  - Kedua jalur memanggil fungsi pemroses kabar pembayaran yang sama.
- **Pembatalan (PRD §5.8).** Toko meminta pembatalan ke Qrispy. Bila permintaan itu gagal, toko memeriksa status QRIS-nya:
  - `paid`: Pesanan diproses sebagai sudah dibayar;
  - `cancelled` atau `expired`: Pesanan menjadi Dibatalkan;
  - selain itu: Pembeli melihat pesan gagal, dan Pesanan tetap Menunggu Pembayaran.
- **Kedaluwarsa** dihitung dari `expired_at` yang diberikan Qrispy dan disimpan di Pesanan. Pekerjaan latar pg-boss dijadwalkan pada waktu itu.
- **Gambar QR** disimpan dari `qris_image_base64` dan disajikan dari server toko. Toko tidak memakai `qris_image_url` milik Qrispy.

## Considered Options

- **Mengikuti draf integrasi dari pemilik apa adanya.** Ditolak. Draf itu berbeda dari dokumentasi resmi dalam nama event, bentuk payload, dan nominal (`docs/referensi/qrispy-api.md` bagian 8).
- **Hanya mengandalkan webhook.** Ditolak. Kebijakan kirim ulang dan format signature-nya belum pasti. Bila satu webhook hilang, Pesanan yang sudah dibayar akan menjadi Kedaluwarsa.
- **Menafsirkan error pembatalan dari kode HTTP.** Ditolak. Dokumentasi resmi tidak menjelaskan arti kode itu untuk pembatalan.

## Consequences

- Semua tiket checkout dan pembayaran bisa diuji di CI tanpa uang sungguhan.
- Hal yang belum pasti, yaitu format signature dan arti `amount` di webhook, baru terbukti pada pembayaran sungguhan pertama (UAT-A1). Setelah terbukti, penerimaan dua format signature dipersempit menjadi satu lewat tiket baru.
- Toko memanggil API status Qrispy secara berkala. Bila Qrispy menjawab `429`, toko menunggu sampai giliran cek berikutnya.
