# Referensi API Qrispy

Berkas ini menjelaskan perilaku layanan luar Qrispy yang dipakai toko untuk QRIS. Aturan bisnisnya tetap di `docs/PRD.md` (§5), dan keputusan teknis integrasinya di ADR-0004.

- **Sumber:**
  1. Dokumentasi publik Qrispy API v1.0 di <https://api.qrispy.id> dan halaman <https://qrispy.id>, dibaca pada 2026-11-11.
  2. Dokumentasi di dashboard merchant Qrispy, yaitu halaman dokumentasi API dan pengaturan webhook. Pemilik menyalinnya pada 2026-11-14.
  3. Uji API sungguhan pada 2026-11-14, dan pembayaran sungguhan pada 2026-11-15 (bagian 9).
- **Asal berkas:** draf pemilik yang sebagian ditulis AI lain, lalu dicocokkan dengan dokumentasi publik. Perbedaannya tercatat di bagian 8.
- **Bila sumber berbeda:**
  - Hasil uji sungguhan yang berlaku.
  - Untuk hal yang belum diuji dan dijelaskan berbeda oleh kedua dokumentasi, toko menerima kedua bentuk sampai uji sungguhan membuktikan salah satunya (ADR-0004).
  - Hal yang belum dijelaskan dokumentasi mana pun ditandai **belum pasti**, dan tidak boleh dianggap benar tanpa dicek.

## 1. Lingkungan dan autentikasi

Variabel lingkungan di proyek ini. Namanya pilihan proyek, bukan ketentuan Qrispy.

| Variabel | Isi |
|---|---|
| `QRISPY_BASE_URL` | `https://api.qrispy.id` |
| `QRISPY_API_TOKEN` | Token API dari tab API Tokens di dashboard Qrispy. Token hanya tampil sekali saat dibuat. |
| `QRISPY_WEBHOOK_SECRET` | Secret untuk memeriksa signature webhook, dari pengaturan webhook di dashboard Qrispy. Dokumentasi dashboard mencontohkan awalan `whsec_`. |

Setiap request ke Qrispy membawa tiga header:
- `X-API-TOKEN: <QRISPY_API_TOKEN>`. Dokumentasi dashboard menulisnya `X-API-Token`, dan keduanya sama karena nama header HTTP tidak membedakan huruf besar dan kecil.
- `Content-Type: application/json`
- `Accept: application/json`

Token dan secret hanya dipakai di server. Keduanya tidak boleh sampai ke browser.

## 2. Ringkasan endpoint

| Method | Path | Kegunaan | Sukses (uji 2026-11-14) |
|---|---|---|---|
| `POST` | `/api/payment/qris/generate` | Membuat QRIS baru | `201 Created` |
| `GET` | `/api/payment/qris/{qrisId}/status` | Status pembayaran QRIS | `200` |
| `GET` | `/api/payment/qris/{qrisId}` | Detail QRIS, termasuk gambarnya | `200` |
| `POST` | `/api/payment/qris/{qrisId}/cancel` | Membatalkan QRIS | `200` |
| `GET` | `/api/payment/transactions` | Daftar transaksi merchant | `200` |
| `GET` | `/api/payment/balance` | Saldo merchant | belum diuji |

Toko memakai tiga endpoint: membuat QRIS, status, dan pembatalan. Detail QRIS, daftar transaksi, dan saldo tidak dipakai, karena PRD tidak memintanya.

## 3. Membuat QRIS

`POST /api/payment/qris/generate`

**Request:**

| Field | Wajib | Isi |
|---|---|---|
| `amount` | ya | Nominal rupiah bulat. Maksimal Rp 499.000 untuk merchant standar, dan Rp 5.000.000 untuk merchant terverifikasi. |
| `payment_reference` | tidak | Rujukan dari sistem toko |
| `return_url` | tidak | Alamat tujuan setelah bayar di halaman checkout Qrispy |

```json
{
  "amount": 10000,
  "payment_reference": "MIWE-7K3P9Q"
}
```

**Respons `201 Created`,** sesuai uji sungguhan 2026-11-14. ID dan nama merchant diganti contoh.

```json
{
  "status": "success",
  "message": "QRIS generated successfully",
  "data": {
    "qris_id": "550e8400-e29b-41d4-a716-446655440000",
    "qris_image_url": "https://api.qrispy.id/api/public/qris/550e8400-e29b-41d4-a716-446655440000/image",
    "qris_image_base64": "data:image/png;base64,iVBORw0KGgo...",
    "amount": "10281.00",
    "requested_amount": 10000,
    "unique_id": 281,
    "merchant_name": "<nama merchant>",
    "expired_at": "2026-11-15T00:11:14+07:00",
    "expires_in_seconds": -898.897257,
    "payment_reference": "MIWE-7K3P9Q",
    "checkout_url": "https://qrispy.id/payment/550e8400-e29b-41d4-a716-446655440000",
    "return_url": null
  }
}
```

Arti field yang penting:
- `amount` adalah nominal yang harus dibayar Pembeli, yaitu `requested_amount` ditambah Kode unik. Ini Total bayar. Nilainya berupa **teks desimal**, seperti `"10281.00"`, bukan angka.
- `requested_amount` adalah nominal yang dikirim toko, berupa angka.
- `unique_id` adalah Kode unik, Rp 1–499, berupa angka.
- `expired_at` adalah waktu kedaluwarsa QRIS. Masa berlakunya 15 menit.
- `expires_in_seconds` bernilai negatif pada uji, sekitar −899 tepat setelah QRIS dibuat, jadi tidak bisa dipakai. Toko memakai `expired_at`.
- `merchant_name` adalah nama merchant di akun Qrispy. Toko tidak memakainya.

Kedua dokumentasi keliru soal respons ini:
- Dokumentasi publik menulis `amount` sebagai angka.
- Contoh di dokumentasi dashboard menulis `amount` sama dengan nominal yang dikirim, tanpa `requested_amount` dan `unique_id`.

**Biaya:** dokumentasi API menulis bahwa transaksi di atas Rp 499.000 dikenakan biaya tambahan 0,7%, yang otomatis ditambahkan ke total bayar. Halaman depan qrispy.id justru menyebut MDR 0,7% untuk transaksi Rp 100.000 ke atas, yang ditanggung merchant dan dipotong dari saldo. Kedua keterangan ini **belum pasti** dan perlu ditanyakan ke Qrispy.

**Batas nominal:** bila `amount` melewati batas, Qrispy menolak dengan body error, misalnya `"Maximum QRIS amount is Rp 499,000 for security purposes."`

## 4. Status dan detail QRIS

`GET /api/payment/qris/{qrisId}/status`, sesuai uji sungguhan 2026-11-14:

```json
{
  "status": "success",
  "data": {
    "qris_id": "550e8400-e29b-41d4-a716-446655440000",
    "payment_status": "pending",
    "amount": "10281.00",
    "merchant_name": "<nama merchant>",
    "created_at": "2026-11-14T23:56:14+07:00",
    "expired_at": "2026-11-15T00:11:14+07:00",
    "paid_at": null,
    "payment_reference": "MIWE-7K3P9Q"
  }
}
```

- `payment_status` bernilai `pending`, `paid`, `expired`, atau `cancelled`. Yang sudah teruji: `pending` dan `cancelled` (2026-11-14), serta `paid` (2026-11-15). `expired` belum teruji.
- `amount` berupa teks desimal, sama seperti respons membuat QRIS.
- `paid_at` bernilai `null` selama belum dibayar.
- Status `paid` terbukti terbaca pada pembayaran sungguhan 2026-11-15: `amount` berupa teks desimal, dan `paid_at` berisi waktu bayar dengan zona waktu (bagian 9).

`GET /api/payment/qris/{qrisId}` mengembalikan detail QRIS di dalam `data`:
- `qris_id`, `qris_image_url`, `qris_image_base64`, dan `amount` (teks desimal);
- penanda `is_active`, `is_expired`, dan `is_paid` (boolean);
- `created_at`, `expired_at`, `paid_at`, `payment_reference`, dan `merchant_name`;
- `expires_in_seconds`, yang juga bernilai negatif pada uji.

## 5. Membatalkan QRIS

`POST /api/payment/qris/{qrisId}/cancel`

Respons `200`:

```json
{
  "status": "success",
  "message": "QRIS cancelled successfully"
}
```

Membatalkan QRIS yang sudah dibatalkan juga dijawab `200` dengan `"status": "success"`, tetapi pesannya `"QRIS already cancelled"`. Ini sudah teruji.

Dokumentasi dashboard menyebut dua error untuk pembatalan:
- `400`: QRIS yang sudah dibayar tidak bisa dibatalkan;
- `404`: QRIS tidak ditemukan, atau bukan milik akun itu.

Arti kedua error itu **belum diuji**. Karena itu, kegagalan pembatalan tidak boleh ditafsirkan dari kode HTTP saja. Cara menanganinya ada di ADR-0004.

## 6. Webhook

Qrispy mengirim `POST` ke URL webhook setiap kali pembayaran berhasil. Qrispy tidak mengirim webhook untuk QRIS yang kedaluwarsa atau dibatalkan.

**Pengaturan di dashboard.** URL webhook dan webhook secret diatur di dashboard Qrispy, menu API Docs, tab Webhooks.
- **Save Settings** menyimpan URL. Pada pembayaran sungguhan pertama 2026-11-15, webhook tidak sampai ke toko. Webhook baru sampai setelah pengaturan ini disimpan lagi (bagian 9).
- **Test Webhook** mengirim webhook uji ke URL itu (lihat di bawah).
- **Regenerate** membuat webhook secret baru. Setelah itu, `QRISPY_WEBHOOK_SECRET` di server harus ikut diganti.

**Header:**
- `Content-Type: application/json`
- `X-Qrispy-Signature`: HMAC-SHA256 dari body payload, dengan `QRISPY_WEBHOOK_SECRET` sebagai kunci. Contoh PHP di dokumentasi dashboard memakai `hash_hmac('sha256', $payload, $secret)` pada body mentah. Fungsi itu menghasilkan hex huruf kecil.

**Payload.** Pembayaran sungguhan 2026-11-15 membuktikan bentuk dashboard: event `payment.received`, dengan field di dalam `data`, termasuk `received_amount` (bagian 9). Contoh di bawah berasal dari dokumentasi dashboard. Nilai pada pembayaran sungguhan tidak dicatat di log.

```json
{
  "event": "payment.received",
  "data": {
    "qris_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "amount": 50000,
    "received_amount": 50000,
    "payment_reference": "Order-123",
    "paid_at": "2026-01-14T03:00:00+00:00",
    "unique_id": 123
  }
}
```

**Webhook uji.** Tombol Test Webhook mengirim event `payment.test` dalam bentuk yang sama, ditambah field `message`. Contoh di bawah adalah payload yang tampil di dashboard pada 2026-11-15. Toko menjawab webhook uji dengan `200` tanpa mengubah apa pun (ADR-0004).

```json
{
  "event": "payment.test",
  "data": {
    "qris_id": "test-a62c12ad-56f1-4a90-aa40-cc588327aebe",
    "amount": 15000,
    "received_amount": 15000,
    "payment_reference": "TEST-REF-7063",
    "paid_at": "2026-11-15T13:14:02+07:00",
    "unique_id": 836
  },
  "message": "This is a test webhook from Qrispy to verify your integration."
}
```

**Bentuk referensi** dari dokumentasi publik di bawah ini tidak pernah terlihat pada pembayaran sungguhan. Sejak #118, toko tidak menerimanya lagi. Event `payment.success` dijawab `200` dan diabaikan.

```json
{
  "event": "payment.success",
  "qris_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50123,
  "requested_amount": 50000,
  "unique_id": 123,
  "payment_reference": "MIWE-7K3P9Q",
  "paid_at": "2026-03-09T13:45:21+07:00",
  "merchant_id": 42
}
```

**Belum pasti.** Hal-hal berikut belum terbukti:
- apakah signature ditulis sebagai hex atau base64. Contoh dashboard menunjuk ke hex. Sejak #118, log webhook mencatat format yang cocok;
- apakah `received_amount` sudah termasuk Kode unik, dan apa arti `amount` di webhook. Pada pembayaran sungguhan 2026-11-15, Pesanan sudah Selesai lewat cek status sebelum webhook datang, jadi nilai itu belum dibandingkan dengan Total bayar. Contoh dashboard memberi `amount` 50000 dengan `unique_id` 123, sehingga tidak cocok dengan respons membuat QRIS;
- apakah nominal di webhook berupa angka atau teks desimal. Webhook uji memakai angka. Toko menerima keduanya;
- respons apa yang diharapkan dari server toko;
- apakah webhook dikirim ulang bila gagal;
- apakah ada daftar IP pengirim;
- apakah QRIS yang sudah kedaluwarsa masih bisa dibayar.

Cara toko menghadapi ketidakpastian ini ada di ADR-0004.

## 7. Error

Body error umum:

```json
{
  "status": "error",
  "message": "..."
}
```

| Kode | Arti |
|---|---|
| `200` | Sukses |
| `201` | Berhasil dibuat |
| `400` | Request salah atau validasi gagal |
| `401` | Token tidak valid |
| `429` | Terlalu banyak request |
| `500` | Kesalahan di server Qrispy |

Kedua dokumentasi tidak menyebut batas jumlah request. Qrispy juga tidak punya mode uji, jadi pembayaran sungguhan hanya bisa dicoba dengan uang sungguhan.

## 8. Koreksi terhadap draf awal

Draf yang diberikan pemilik pada 2026-11-11 berbeda dari dokumentasi publik dalam hal-hal berikut. Draf itu tidak disimpan di repo, supaya tidak terpakai.

| Bagian | Draf awal | Dokumentasi publik | Dampak bila mengikuti draf |
|---|---|---|---|
| Respons generate | `200 OK`. `amount` sama dengan nominal yang dikirim. Tidak ada `requested_amount` dan `unique_id`. | `201 Created`. `amount` sudah termasuk Kode unik, dengan `requested_amount` dan `unique_id` terpisah. | Total bayar dan Kode unik di halaman bayar salah (PRD §5.5). Pembeli membayar nominal yang tidak cocok. |
| Nama event webhook | `payment.received` | `payment.success` | Semua webhook diabaikan, dan Pesanan yang sudah dibayar menjadi Kedaluwarsa. |
| Bentuk payload webhook | Field di dalam `data` | Field datar di tingkat atas | Pembacaan payload gagal. |
| Nominal di webhook | Ada `received_amount` | Tidak ada. Yang ada `amount` dan `requested_amount`. | Pemeriksaan nominal kurang (PRD §5.9) membaca field yang tidak ada. |
| Error pembatalan | `400` berarti sudah lunas, `404` berarti tidak ditemukan | Hanya tabel error umum. Arti khusus untuk pembatalan tidak dijelaskan. | Pesanan bisa salah dianggap sudah dibayar, atau sebaliknya (PRD §5.8). |
| Detail QRIS | Tidak disebut | `GET /api/payment/qris/{qrisId}` | Tidak ada dampak besar. |
| Batas nominal dan biaya | Tidak disebut | Maksimal Rp 499.000 (standar), dan biaya 0,7% di atasnya | Varian mahal gagal dibayar, atau Total bayar tidak sesuai rumus. |
| Format signature | Hex, dibandingkan langsung | Belum pasti | Contoh kode di draf melempar error bila panjang signature berbeda, karena `timingSafeEqual` tidak memeriksa panjang lebih dulu. |
| Contoh kode | `any`, `process.env.X!`, dan `res.json()` tanpa pemeriksaan | Tidak ada contoh kode | Melanggar `CODING_STANDARDS.md` (TypeScript tanpa `any`, data luar divalidasi Zod). |
| Bagian "Checklist untuk Claude Code" | Respons webhook `200 { "received": true }` disebut sebagai aturan | Tidak dijelaskan | Itu praktik umum, bukan ketentuan Qrispy. Keputusannya dipindah ke ADR-0004. |
| Header autentikasi | `X-API-Token` | `X-API-TOKEN` | Tidak berdampak, karena nama header HTTP tidak membedakan huruf besar dan kecil. |

▶ Pembaruan 2026-11-15. Dokumentasi dashboard (sumber 2) ternyata sama dengan draf awal dalam beberapa hal:
- respons generate;
- nama event, bentuk payload, dan `received_amount` pada webhook;
- arti error pembatalan;
- format signature hex.

Akibatnya terhadap tabel di atas:
- **Baris "Respons generate" tetap berlaku.** Uji sungguhan (bagian 9) membuktikan bahwa `requested_amount` dan `unique_id` memang ada. Bedanya, `amount` ternyata berupa teks desimal.
- **Baris "Nama event webhook", "Bentuk payload webhook", dan "Nominal di webhook" tidak lagi berarti draf keliru.** Pembayaran sungguhan 2026-11-15 membuktikan bentuk draf dan dashboard, yaitu `payment.received` dengan field di dalam `data` dan `received_amount`. Sejak #118, hanya bentuk itu yang diterima toko (bagian 6 dan 9, ADR-0004).
- **Baris "Error pembatalan" tetap berlaku.** Arti kode error itu belum diuji.

## 9. Hasil uji sungguhan

### Uji API tanpa pembayaran 2026-11-14

Pemilik menjalankan skrip uji dengan token API sungguhan. Skrip itu:
1. membuat satu QRIS Rp 10.000;
2. membaca status, detail, dan daftar transaksinya;
3. membatalkannya, lalu membatalkannya lagi.

Tidak ada pembayaran. ID QRIS, nama merchant, dan transaksi lain di akun itu tidak dicatat di sini, karena repo ini publik.

| Langkah | HTTP | Temuan |
|---|---|---|
| Membuat QRIS | `201` | `amount` `"10281.00"` (teks), `requested_amount` `10000`, dan `unique_id` `281` (angka). `expired_at` tepat 15 menit setelah dibuat. `expires_in_seconds` negatif. |
| Status QRIS baru | `200` | `payment_status` `pending`, dengan `amount` berupa teks desimal |
| Detail QRIS | `200` | `amount` berupa teks desimal; `is_active` `true`, `is_expired` dan `is_paid` `false`; `expires_in_seconds` negatif |
| Daftar transaksi | `200` | `amount` berupa teks desimal; ada `pagination` |
| Membatalkan | `200` | `"QRIS cancelled successfully"` |
| Status setelah dibatalkan | `200` | `payment_status` `cancelled` |
| Membatalkan lagi | `200` | `"status": "success"` dengan pesan `"QRIS already cancelled"` |

### Pembayaran sungguhan 2026-11-15

Setelah toko terpasang di `https://akun.miwedigital.store`, pemilik membeli dua kali Varian Rp 1.000 dan membayar QRIS-nya dengan e-wallet. Email Pembeli dan ID QRIS tidak dicatat di sini.

| Kejadian (WIB) | Temuan |
|---|---|
| Pembayaran 1: Pesanan dibuat 12.31, dibayar 12.34, Selesai 12.35 | Total bayar Rp 1.182, dengan Kode unik Rp 182. Webhook tidak sampai ke toko. Pesanan menjadi Selesai lewat cek status, jadi status `paid` dengan `amount` teks desimal terbaca. Email Pesanan selesai terkirim. |
| Pengaturan webhook disimpan lagi, lalu Test Webhook ditekan pukul 13.14 | Webhook `payment.test` sampai, signature-nya cocok, dan toko menjawab `200` tanpa perubahan |
| Pembayaran 2: Pesanan dibuat 13.18, dibayar 13.19.31, Selesai 13.19.32 | Total bayar Rp 1.234. Cek status lebih dulu menangkapnya. Webhook `payment.received` dalam bentuk dashboard sampai pukul 13.19.34, signature-nya cocok, payload-nya sah, dan karena sudah diproses, tidak ada perubahan ganda. Email Pesanan selesai terkirim. |

### Pesanan Bermasalah 2026-11-22

Pemilik membeli Varian Rp 1.000 di toko yang sudah terpasang, lalu membayar QRIS-nya dengan e-wallet. Email Pembeli, Nomor Pesanan, dan ID QRIS tidak dicatat di sini.

| Kejadian (WIB) | Temuan |
|---|---|
| Pesanan dibuat 22.26 | Total bayar Rp 1.212, dengan Kode unik Rp 212 |
| Pesanan menjadi Bermasalah 22.27, dengan pelaku "Qrispy" | Pembeli sudah membayar, tetapi Item stok tidak dikirim. Pesanan ini menahan Item stok sejak dibuat. Menurut kode, perpindahan dari Menunggu Pembayaran ke Bermasalah oleh Qrispy dalam keadaan itu hanya terjadi bila nominal yang dikabarkan kurang dari Total bayar (PRD §5.9 butir 2). Pada jalur itu, Item stok yang ditahan dilepas lagi. |

**Dugaan.** Jalur cek status tidak mungkin menghasilkan Bermasalah di sini, karena `amount`-nya sudah termasuk Kode unik (pembayaran 1 dan 2 di atas). Jadi kabar itu kemungkinan besar datang lewat webhook, dan `received_amount`-nya kurang dari Rp 1.212, misalnya Rp 1.000 tanpa Kode unik. Contoh dashboard di bagian 6 juga menulis `received_amount` 50000 dengan `unique_id` 123. Log tidak mencatat nominal, jadi dugaan ini belum terbukti. Detail transaksi di Dashboard Qrispy bisa memastikannya.

**Bukti dari pemilik 2026-11-23.** Dashboard Qrispy mencatat nominal transaksi ini Rp 1.000, dengan Rp 1.212 dicoret, dan statusnya Success. Mutasi saldo Qrispy toko juga hanya bertambah Rp 1.000. Dari situ ada dua kesimpulan:
- **Kode unik tidak masuk saldo toko.** Pembeli membayar Rp 1.212, tetapi toko menerima Rp 1.000. Aturan keuangannya diputuskan di PRD §5.5 (▶ Keputusan 2026-11-23, #254).
- **Nominal Rp 1.000 kemungkinan besar dikirim sebagai `received_amount`.** Ini cocok dengan Pesanan yang menjadi Bermasalah. Log webhook sesudah #246 akan memastikannya.

**Tindak lanjut.** Sejak #246, nominal diterima selalu diambil dari cek status, dan log webhook mencatat `received_amount` di samping `amount` cek status (ADR-0004).

**Belum diuji:**
- status `expired`;
- format signature (hex atau base64);
- arti `received_amount` terhadap Total bayar (bagian 6);
- error pembatalan QRIS yang sudah dibayar.
