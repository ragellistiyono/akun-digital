# Referensi API Qrispy

Berkas ini menjelaskan perilaku layanan luar Qrispy yang dipakai toko untuk QRIS. Aturan bisnisnya tetap di `docs/PRD.md` (§5), dan keputusan teknis integrasinya di ADR-0004.

- **Sumber:** dokumentasi resmi Qrispy API v1.0 di <https://api.qrispy.id>, dan halaman <https://qrispy.id>. Keduanya dibaca pada 2026-11-11.
- **Asal berkas:** draf pemilik yang sebagian ditulis AI lain, lalu dicocokkan dengan dokumentasi resmi. Perbedaannya tercatat di bagian 8.
- **Bila berbeda:** dokumentasi resmi yang berlaku. Hal yang belum dijelaskan dokumentasi resmi ditandai **belum pasti**, dan tidak boleh dianggap benar tanpa dicek.

## 1. Lingkungan dan autentikasi

Variabel lingkungan di proyek ini. Namanya pilihan proyek, bukan ketentuan Qrispy.

| Variabel | Isi |
|---|---|
| `QRISPY_BASE_URL` | `https://api.qrispy.id` |
| `QRISPY_API_TOKEN` | Token API dari Client Dashboard Qrispy |
| `QRISPY_WEBHOOK_SECRET` | Secret untuk memeriksa signature webhook |

Setiap request ke Qrispy membawa tiga header:
- `X-API-TOKEN: <QRISPY_API_TOKEN>`
- `Content-Type: application/json`
- `Accept: application/json`

Token dan secret hanya dipakai di server. Keduanya tidak boleh sampai ke browser.

## 2. Ringkasan endpoint

| Method | Path | Kegunaan | Sukses |
|---|---|---|---|
| `POST` | `/api/payment/qris/generate` | Membuat QRIS baru | `201 Created` |
| `GET` | `/api/payment/qris/{qrisId}/status` | Status pembayaran QRIS | `200` |
| `GET` | `/api/payment/qris/{qrisId}` | Detail QRIS, termasuk gambarnya | `200` |
| `POST` | `/api/payment/qris/{qrisId}/cancel` | Membatalkan QRIS | `200` |
| `GET` | `/api/payment/transactions` | Daftar transaksi merchant | `200` |
| `GET` | `/api/payment/balance` | Saldo merchant | `200` |

Toko hanya memakai empat endpoint pertama. Daftar transaksi dan saldo tidak dipakai, karena PRD tidak memintanya.

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
  "amount": 50000,
  "payment_reference": "MIWE-7K3P9Q"
}
```

**Respons `201 Created`:**

```json
{
  "status": "success",
  "data": {
    "qris_id": "550e8400-e29b-41d4-a716-446655440000",
    "qris_image_url": "https://api.qrispy.id/api/public/qris/550e8400-e29b-41d4-a716-446655440000.png",
    "qris_image_base64": "data:image/png;base64,iVBORw0KGgo...",
    "amount": 50123,
    "requested_amount": 50000,
    "unique_id": 123,
    "expired_at": "2026-03-09T14:00:00+07:00",
    "expires_in_seconds": 900,
    "checkout_url": "https://qrispy.id/payment/550e8400-e29b-41d4-a716-446655440000",
    "payment_reference": "MIWE-7K3P9Q",
    "return_url": null
  }
}
```

Arti field yang penting:
- `amount` adalah nominal yang harus dibayar Pembeli, yaitu `requested_amount` ditambah Kode unik. Ini Total bayar.
- `requested_amount` adalah nominal yang dikirim toko.
- `unique_id` adalah Kode unik, Rp 1–499.
- `expired_at` adalah waktu kedaluwarsa QRIS. Masa berlakunya 15 menit.

**Biaya:** dokumentasi API menulis bahwa transaksi di atas Rp 499.000 dikenakan biaya tambahan 0,7%, yang otomatis ditambahkan ke total bayar. Halaman depan qrispy.id justru menyebut MDR 0,7% untuk transaksi Rp 100.000 ke atas, yang ditanggung merchant dan dipotong dari saldo. Kedua keterangan ini **belum pasti** dan perlu ditanyakan ke Qrispy.

**Batas nominal:** bila `amount` melewati batas, Qrispy menolak dengan body error, misalnya `"Maximum QRIS amount is Rp 499,000 for security purposes."`

## 4. Status dan detail QRIS

`GET /api/payment/qris/{qrisId}/status`

```json
{
  "status": "success",
  "data": {
    "qris_id": "550e8400-e29b-41d4-a716-446655440000",
    "payment_status": "pending",
    "amount": 50123,
    "paid_at": null,
    "expired_at": "2026-03-09T14:00:00+07:00",
    "payment_reference": "MIWE-7K3P9Q"
  }
}
```

- `payment_status` bernilai `pending`, `paid`, `expired`, atau `cancelled`.
- `paid_at` bernilai `null` selama belum dibayar.

`GET /api/payment/qris/{qrisId}` mengembalikan detail QRIS di dalam `data`:
- `qris_id`, `qris_image_url`, `qris_image_base64`, dan `amount`;
- penanda `is_active`, `is_expired`, dan `is_paid` (boolean);
- `expires_in_seconds` dan `paid_at`.

## 5. Membatalkan QRIS

`POST /api/payment/qris/{qrisId}/cancel`

Respons `200`:

```json
{
  "status": "success",
  "message": "QRIS cancelled successfully"
}
```

Dokumentasi resmi **tidak** menjelaskan respons bila QRIS sudah dibayar atau sudah kedaluwarsa. Yang ada hanya tabel error umum di bagian 7. Karena itu, kegagalan pembatalan tidak boleh ditafsirkan dari kode HTTP saja. Cara menanganinya ada di ADR-0004.

## 6. Webhook

Qrispy mengirim `POST` ke URL webhook setiap kali pembayaran berhasil. URL itu didaftarkan di Dashboard Qrispy → Webhook Settings. Qrispy tidak mengirim webhook untuk QRIS yang kedaluwarsa atau dibatalkan.

**Header:**
- `Content-Type: application/json`
- `X-Qrispy-Signature`: HMAC-SHA256 dari body payload, dengan `QRISPY_WEBHOOK_SECRET` sebagai kunci.

**Payload.** Bentuknya datar, tanpa pembungkus `data`.

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

**Belum pasti.** Dokumentasi resmi tidak menjelaskan hal-hal berikut:
- apakah signature ditulis sebagai hex atau base64;
- apakah `amount` di webhook adalah nominal yang benar-benar diterima, atau nominal tagihan. Tidak ada field `received_amount`;
- respons apa yang diharapkan dari server toko;
- apakah webhook dikirim ulang bila gagal;
- apakah ada daftar IP pengirim;
- apakah QRIS yang sudah kedaluwarsa masih bisa dibayar;
- tipe `merchant_id`: angka di webhook, tetapi UUID di respons saldo.

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

Dokumentasi resmi tidak menyebut batas jumlah request. Qrispy juga tidak punya mode uji, jadi pembayaran sungguhan hanya bisa dicoba dengan uang sungguhan.

## 8. Koreksi terhadap draf awal

Draf yang diberikan pemilik pada 2026-11-11 berbeda dari dokumentasi resmi dalam hal-hal berikut. Draf itu tidak disimpan di repo, supaya tidak terpakai.

| Bagian | Draf awal | Dokumentasi resmi | Dampak bila mengikuti draf |
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
