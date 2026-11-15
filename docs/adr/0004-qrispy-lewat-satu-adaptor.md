---
status: accepted
date: 2026-11-11
---

# Qrispy lewat satu adaptor, dengan Qrispy tiruan untuk pengembangan dan test

Toko menerbitkan QRIS dan menerima kabar pembayaran dari Qrispy (PRD §5). Ada tiga kendala. Qrispy tidak punya mode uji. Webhook-nya hanya bisa mencapai server yang sudah terpasang. Beberapa perilakunya juga belum dijelaskan dokumentasi resmi (`docs/referensi/qrispy-api.md` bagian 6). Karena itu semua tiket harus bisa dikerjakan dan diuji tanpa Qrispy sungguhan, dan toko tidak boleh bergantung pada satu jalur kabar pembayaran saja.

Diperbarui 2026-11-15. Uji API Qrispy sungguhan menunjukkan bahwa nominal dikirim sebagai teks desimal. Selain itu, dokumentasi di dashboard Qrispy memakai bentuk webhook yang berbeda dari dokumentasi publik (`docs/referensi/qrispy-api.md` bagian 6 dan 9).

Diperbarui lagi 2026-11-15 (#118). Dua pembayaran sungguhan membuktikan bahwa Qrispy mengirim webhook dalam bentuk dashboard, jadi bentuk referensi tidak lagi diterima.

## Keputusan

- **Satu adaptor.** Semua panggilan ke Qrispy lewat satu antarmuka di `src/server/`. Antarmuka itu punya dua implementasi:
  - **Qrispy sungguhan:** memanggil API dengan `fetch`, tanpa dependency baru;
  - **Qrispy tiruan:** dipakai di pengembangan, test, dan e2e. Tiruan menerbitkan QRIS dengan gambar contoh, Kode unik, dan waktu kedaluwarsa 15 menit. Tiruan juga menyediakan cara memicu pembayaran, yang hanya aktif saat tiruan dipakai.

  Variabel `QRISPY_MODE` (`tiruan` atau `sungguhan`) memilih implementasinya. `.env.example` dan `.env.ci` memakai `tiruan`.
- **Data dari Qrispy divalidasi dengan Zod** sebelum dipakai, termasuk respons API dan payload webhook.
- **Nominal dari Qrispy.** `amount`, `requested_amount`, `unique_id`, dan `received_amount` diterima sebagai angka bulat atau sebagai teks desimal seperti `"10281.00"`, lalu dipakai sebagai rupiah bulat. Teks yang punya sen selain `.00`, atau yang bukan angka, membuat seluruh jawaban atau payload itu tidak sah, sama seperti data yang tidak lolos Zod.
- **Total bayar dan Kode unik diambil dari Qrispy.** Total bayar adalah `amount`, dan Kode unik adalah `unique_id`. Bila `requested_amount` tidak sama dengan nominal yang dikirim toko, atau `amount` tidak sama dengan `requested_amount + unique_id`, QRIS itu dibatalkan dan checkout gagal dengan pesan yang menyuruh Pembeli mencoba lagi.
- **Yang dikirim ke Qrispy:** `payment_reference` berisi Nomor Pesanan. `return_url` tidak dikirim, karena Tautan Pesanan bersifat rahasia (PRD §6.2) dan tidak boleh sampai ke pihak ketiga. `checkout_url` tidak dipakai.
- **Gagal membuat QRIS.** Bila Qrispy menolak atau tidak menjawab, tidak ada Pesanan yang tersisa dan tidak ada Item stok yang ditahan.
- **Webhook:**
  - Route handler membaca body mentah dengan `request.text()` sebelum di-parse.
  - Signature dihitung dengan HMAC-SHA256 memakai `QRISPY_WEBHOOK_SECRET`. Selama formatnya belum dipastikan, signature diterima bila sama dengan digest dalam hex atau base64. Perbandingannya memakai `timingSafeEqual`, setelah panjangnya dicek sama.
  - Signature salah dijawab `401` tanpa perubahan apa pun.
  - Kabar pembayaran hanya diterima dalam **bentuk dashboard**: event `payment.received` dengan field di dalam `data`. Bentuk ini terbukti pada pembayaran sungguhan 2026-11-15 (`docs/referensi/qrispy-api.md` bagian 9).
  - Event `payment.test` dari tombol "Test Webhook" di dashboard Qrispy dikenali sebagai **webhook uji**. Webhook ini dijawab `200` dan tidak mengubah apa pun.
  - Event lain dijawab `200` dan diabaikan. Ini termasuk `payment.success`, yang dulu diterima sebagai bentuk referensi.
  - Pada `payment.received` tanpa `received_amount`, webhook dijawab `400` tanpa perubahan apa pun. Pembayarannya tetap tertangkap lewat cek status.
  - Setiap webhook yang signature-nya cocok dicatat satu baris di log server. Isinya hanya:
    - bentuknya: `dashboard` untuk `payment.received`, `uji` untuk `payment.test`, atau `tidak dikenal`;
    - nama event-nya;
    - format signature yang cocok, yaitu `hex` atau `base64`.

    ▶ Keputusan 2026-11-15 (#113): Peringatan penolakan `400` tetap ditulis sebagai baris tersendiri, di samping baris log bentuk.
    - Peringatan itu boleh memuat alasan penolakan, termasuk nilai nominal yang tidak sah, misalnya `nominal "45123.50" tidak sah`.
    - Alasannya, isi penolakan itulah petunjuk untuk memastikan bentuk webhook pada pembayaran sungguhan pertama, dan nilai nominal bukan rahasia.
  - Kabar pembayaran diproses dalam satu transaksi database, lalu dijawab `200`. Kabar dengan `qris_id` yang sama hanya diproses sekali (PRD §5.7).
- **Nominal diterima** diambil dari:
  - `received_amount`, pada webhook `payment.received`;
  - `amount` dari cek status, bila statusnya `paid`.

  Nominal ini dibandingkan dengan Total bayar menurut PRD §5.9.
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

- **Mengikuti draf integrasi dari pemilik apa adanya.** Ditolak. Draf itu berbeda dari dokumentasi publik dalam nama event, bentuk payload, dan nominal (`docs/referensi/qrispy-api.md` bagian 8). Pada 2026-11-15, bentuk webhook di draf ternyata sama dengan dokumentasi dashboard, jadi bentuk itu kini ikut diterima sebagai bentuk dashboard.
- **Hanya menerima bentuk webhook dashboard sejak awal.** Ditolak pada 2026-11-15 pagi. Waktu itu dokumentasi dashboard terbukti keliru soal jawaban membuat QRIS (`docs/referensi/qrispy-api.md` bagian 9), jadi contoh webhook-nya juga belum tentu benar. Setelah pembayaran sungguhan membuktikan bentuk dashboard, keputusan ini diganti (#118).
- **Tetap menerima bentuk referensi.** Ditolak (#118). Qrispy terbukti tidak memakainya, dan bentuk yang tidak terpakai hanya menambah jalur yang harus dijaga.
- **Menolak `payment.success` dengan `400`.** Ditolak (#118). Event ini tidak dipakai Qrispy. Jawaban `200` mencegah Qrispy mengirim ulang event yang memang tidak diproses toko.
- **Membulatkan nominal yang punya sen.** Ditolak. Nominal QRIS rupiah selalu bulat. Bila ada sen, berarti API Qrispy berubah, dan itu harus dicek dulu, bukan ditebak.
- **Server Qrispy tiruan yang mengirim JSON lewat HTTP.** Ditolak. Server seperti itu menambah bagian baru tanpa menambah bukti. Bentuk JSON Qrispy sudah diuji lewat contoh jawaban di test adaptor dan contoh webhook di test e2e.
- **Hanya mengandalkan webhook.** Ditolak. Kebijakan kirim ulang dan format signature-nya belum pasti. Bila satu webhook hilang, Pesanan yang sudah dibayar akan menjadi Kedaluwarsa.
- **Menafsirkan error pembatalan dari kode HTTP.** Ditolak. Dokumentasi publik tidak menjelaskan arti kode itu untuk pembatalan. Dokumentasi dashboard menjelaskannya, tetapi arti itu belum diuji.

## Consequences

- Semua tiket checkout dan pembayaran bisa diuji di CI tanpa uang sungguhan.
- Contoh jawaban Qrispy di test adaptor dan contoh webhook di test e2e memakai bentuk dari uji sungguhan (`docs/referensi/qrispy-api.md` bagian 9). Qrispy tiruan bekerja di tingkat adaptor, jadi bentuk JSON tidak memengaruhinya.
- Bentuk webhook sudah terbukti pada pembayaran sungguhan 2026-11-15, dan bentuk referensi dihapus (#118). Dua hal masih menunggu bukti:
  - format signature. Log webhook kini mencatat format yang cocok. Setelah terbukti, format yang tidak terpakai dihapus lewat tiket baru;
  - apakah `received_amount` sudah termasuk Kode unik (`docs/referensi/qrispy-api.md` bagian 6).
- Toko memanggil API status Qrispy secara berkala. Bila Qrispy menjawab `429`, toko menunggu sampai giliran cek berikutnya.
