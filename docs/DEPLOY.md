# Runbook deploy

Toko berjalan di satu server (VPS) lewat Docker Compose, dan hanya bisa dibuka lewat HTTPS (PRD §12, ADR-0001). Setiap kali CI hijau di `main`, workflow **Deploy** di GitHub Actions masuk ke server lewat SSH dan memasang versi baru. Runbook ini menjelaskan deploy pertama, pembaruan, cek kesehatan, backup, dan restore.

## Gambaran server

| Hal | Isi |
|---|---|
| Server | Ubuntu, pengguna `deploy` (anggota grup `docker`, tanpa sudo, login hanya dengan kunci deploy) |
| Alamat SSH | `deploy@akun.miwedigital.store`, karena domain toko menunjuk ke server. Alamat IP server adalah nilai secret `VPS_HOST`, dan sengaja tidak ditulis di repo publik ini. |
| Alamat toko | `https://akun.miwedigital.store` (PRD §12) |
| Repo di server | `/opt/akun-digital/repo`, salinan repo GitHub. Jangan ubah berkas di folder ini, karena deploy menggantinya. |
| Berkas env produksi | `/opt/akun-digital/produksi.env`, berisi pengaturan dan rahasia. Berkas ini tidak pernah masuk repo. |
| Skrip | `deploy/deploy.sh` (deploy), `deploy/pulihkan.sh` (restore), `deploy/cadangan.sh` (backup harian, dijalankan layanan `cadangan`) |

Layanan di `compose.prod.yml`:

| Layanan | Isi |
|---|---|
| `app` | Aplikasi toko, termasuk pekerja latar pg-boss |
| `postgres` | Database PostgreSQL 17 |
| `caddy` | Proxy HTTPS. Caddy mengambil dan memperbarui sertifikat Let's Encrypt sendiri, dan mengalihkan `http://` ke `https://`. |
| `cadangan` | Backup database harian dengan `pg_dump` |

Data yang bertahan antar-deploy disimpan di volume Docker:

| Volume | Isi |
|---|---|
| `akun-digital_postgres-data` | Database |
| `akun-digital_unggahan` | Ikon Kategori dan Foto Produk yang diunggah Admin (`UPLOAD_DIR`) |
| `akun-digital_cadangan` | Tujuh backup database terakhir |
| `akun-digital_caddy-data`, `akun-digital_caddy-config` | Sertifikat HTTPS dan pengaturan Caddy |

Deploy tidak pernah menghapus volume. **Jangan pernah menjalankan `docker compose down -v`**, karena `-v` menghapus semua volume beserta datanya.

### Menjalankan perintah `docker compose` di server

Setiap kali membuka sesi SSH baru, jalankan dua baris ini sekali. Setelah itu perintah `docker compose …` di runbook ini bisa dijalankan apa adanya.

```bash
cd /opt/akun-digital/repo
export COMPOSE_FILE=compose.prod.yml COMPOSE_ENV_FILES=/opt/akun-digital/produksi.env
```

## Berkas env produksi

Aplikasi membaca pengaturannya dari `/opt/akun-digital/produksi.env`. Daftar di bawah memuat semua variabel di `.env.example`, ditambah satu variabel khusus server, beserta nilai produksinya.

| Variabel | Nilai produksi | Keterangan |
|---|---|---|
| `DATABASE_URL` | Jangan ditulis | Diisi `compose.prod.yml`: `postgres://app:<POSTGRES_PASSWORD>@postgres:5432/app` |
| `BETTER_AUTH_SECRET` | Rahasia acak | Buat dengan `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://akun.miwedigital.store` | |
| `UPLOAD_DIR` | Jangan ditulis | Diisi `compose.prod.yml`: `/data/unggahan`, di volume `akun-digital_unggahan` |
| `ITEM_STOK_KEY` | Rahasia acak | Buat dengan `openssl rand -base64 32`. Simpan salinannya di tempat aman. Jangan pernah diganti setelah ada Item stok, karena Item stok yang tersimpan tidak bisa dibuka lagi. Restore juga membutuhkan kunci yang sama. |
| `QRISPY_MODE` | `sungguhan` | Setiap QRIS dibayar dengan uang sungguhan |
| `QRISPY_BASE_URL` | `https://api.qrispy.id` | Dari `docs/referensi/qrispy-api.md` bagian 1 |
| `QRISPY_API_TOKEN` | Rahasia dari T32 | Token API dari tab API Tokens di dashboard Qrispy |
| `QRISPY_WEBHOOK_SECRET` | Rahasia dari T32 | Dari Webhook Settings di dashboard Qrispy |
| `EMAIL_MODE` | `resend` | |
| `RESEND_API_KEY` | Rahasia dari T32 | API key Resend |
| `EMAIL_FROM` | `MIWE Digital Store <no-reply@akun.miwedigital.store>` | PRD §10.1 |
| `APP_URL` | `https://akun.miwedigital.store` | Tanpa garis miring di akhir. Alamat ini dipakai Tautan Pesanan di email, dan juga alamat yang dilayani Caddy. |
| `POSTGRES_PASSWORD` | Rahasia acak, khusus server | Password database. Buat dengan `openssl rand -hex 32`. Jangan diganti setelah deploy pertama, karena database yang sudah ada tetap memakai password lama. |

Isi berkasnya, dengan setiap `<…>` diganti nilai sungguhan:

```
BETTER_AUTH_SECRET=<hasil openssl rand -base64 32>
BETTER_AUTH_URL=https://akun.miwedigital.store
ITEM_STOK_KEY=<hasil openssl rand -base64 32>
QRISPY_MODE=sungguhan
QRISPY_BASE_URL=https://api.qrispy.id
QRISPY_API_TOKEN=<token API Qrispy>
QRISPY_WEBHOOK_SECRET=<webhook secret Qrispy>
EMAIL_MODE=resend
RESEND_API_KEY=<API key Resend>
EMAIL_FROM=MIWE Digital Store <no-reply@akun.miwedigital.store>
APP_URL=https://akun.miwedigital.store
POSTGRES_PASSWORD=<hasil openssl rand -hex 32>
```

Setelah berkas ini diubah, jalankan deploy lagi (bagian [Pembaruan](#pembaruan)) supaya aplikasi memakai nilai barunya.

## Deploy pertama

Syaratnya, tiket T32 sudah selesai: server dan pengguna `deploy` siap, domain menunjuk ke server, port 80 dan 443 terbuka, dan secret `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` sudah terpasang di repo.

Workflow Deploy yang berjalan otomatis sebelum langkah 3 dan 4 di bawah selesai akan gagal, karena repo dan berkas env belum ada di server. Itu wajar: setelah langkah 4, jalankan deploy lagi lewat langkah 5.

1. Masuk ke server dengan kunci deploy:

   ```bash
   ssh -i <berkas kunci deploy> deploy@akun.miwedigital.store
   ```

2. Pastikan keempat perintah ini menampilkan versi. Bila salah satunya galat, pasang dari akun server yang punya sudo. Misalnya, bila `docker buildx version` galat, pasang dengan `sudo apt install docker-buildx`, karena `docker compose build` membutuhkannya.

   ```bash
   docker compose version
   docker buildx version
   git --version
   curl --version
   ```

3. Salin repo ke server:

   ```bash
   git clone https://github.com/ragellistiyono/akun-digital.git /opt/akun-digital/repo
   ```

4. Buat berkas env produksi yang hanya bisa dibaca pengguna `deploy`, lalu isi mengikuti bagian [Berkas env produksi](#berkas-env-produksi). Simpan dengan Ctrl+O lalu Enter, dan keluar dengan Ctrl+X.

   ```bash
   install -m 600 /dev/null /opt/akun-digital/produksi.env
   nano /opt/akun-digital/produksi.env
   ```

5. Jalankan deploy pertama dengan salah satu cara ini:
   - **Dari GitHub:** buka tab **Actions**, pilih workflow **Deploy**, klik **Run workflow**, pilih branch `main`, lalu klik **Run workflow** lagi.
   - **Dari server:** ambil dulu commit terbaru dari GitHub, lalu pasang commit teratas `main`:

     ```bash
     git -C /opt/akun-digital/repo fetch origin
     bash /opt/akun-digital/repo/deploy/deploy.sh "$(git -C /opt/akun-digital/repo rev-parse origin/main)"
     ```

   Deploy pertama butuh beberapa menit, karena image harus diunduh dan dibangun, dan Caddy mengambil sertifikat HTTPS. Deploy berhasil bila baris terakhirnya `✓ Deploy <commit> selesai.`

6. Buat akun Admin pertama. Ganti `<email>` dengan email Admin, lalu ketik password-nya dua kali saat diminta.

   ```bash
   cd /opt/akun-digital/repo
   export COMPOSE_FILE=compose.prod.yml COMPOSE_ENV_FILES=/opt/akun-digital/produksi.env
   docker compose run --rm app pnpm admin:buat <email>
   ```

7. Pastikan alamat webhook di dashboard Qrispy (Webhook Settings) adalah `https://akun.miwedigital.store/api/qrispy/webhook`.

8. Buka `https://akun.miwedigital.store` di browser. Coba juga `http://akun.miwedigital.store`: alamatnya harus berpindah ke `https://` (UAT-L1 langkah 1).

Runbook ini tidak menjalankan data seed. Perlu diketahui, `pnpm db:seed` membuat Admin `admin@miwe.example` dengan password yang tertulis di repo publik.

## Pembaruan

Setiap merge ke `main` yang membuat CI hijau otomatis memicu workflow **Deploy**. Hasilnya bisa dilihat di tab **Actions** GitHub, workflow **Deploy**. Deploy bisa juga dijalankan sendiri, misalnya setelah berkas env produksi diubah:
- **Dari GitHub:** tab **Actions** → **Deploy** → **Run workflow**, pada branch `main`.
- **Dari server:** `bash /opt/akun-digital/repo/deploy/deploy.sh <commit>`, dengan `<commit>` berupa hash commit di `main`. Jangan jalankan deploy dari server saat workflow Deploy sedang berjalan.

`deploy/deploy.sh` menjalankan lima langkah, dan berhenti di langkah pertama yang gagal:
1. Ambil commit itu dari GitHub. Commit di luar branch `main` ditolak.
2. Build image aplikasi. Image `postgres` dan `caddy` diperbarui ke rilis terbaru di versi utamanya.
3. Jalankan migrasi database.
4. Nyalakan ulang aplikasi. Volume tidak dihapus, jadi database, unggahan, backup, dan sertifikat tetap ada.
5. Cek kesehatan: `https://<domain>/` terbuka, dan `http://<domain>/` dialihkan ke `https://`.

Bila deploy gagal, keluarannya menampilkan keadaan layanan, perintah untuk melihat log aplikasi dan Caddy di server, serta perintah untuk kembali ke commit sebelumnya. Log GitHub Actions terbuka untuk umum karena repo ini publik, jadi log aplikasi dan galat database hanya dibaca di server, tidak pernah di log Actions. Keduanya bisa memuat email Pembeli, nomor Pesanan, dan IP pengunjung. Perintah untuk kembali ke commit sebelumnya:

```bash
bash /opt/akun-digital/repo/deploy/deploy.sh <commit sebelumnya>
```

Kembali ke commit sebelumnya tidak membatalkan migrasi database yang sudah berjalan.

## Cek kesehatan

Deploy selalu diakhiri cek kesehatan. Untuk memeriksa sendiri, jalankan di server, setelah dua baris di [Menjalankan perintah `docker compose` di server](#menjalankan-perintah-docker-compose-di-server):

| Perintah | Hasil yang benar |
|---|---|
| `docker compose ps` | `app` dan `postgres` berstatus `Up … (healthy)`, `caddy` dan `cadangan` berstatus `Up` |
| `curl -sS -o /dev/null -w '%{http_code}\n' https://akun.miwedigital.store/` | `200` |
| `curl -sSI http://akun.miwedigital.store/` | `HTTP/1.1 308 Permanent Redirect` dengan `Location: https://akun.miwedigital.store/` |
| `docker compose logs --tail 100 app` | Log aplikasi tanpa galat berulang |
| `docker compose logs --tail 100 caddy` | Log Caddy, termasuk pengambilan dan pembaruan sertifikat |

Bila aplikasi bermasalah tetapi kodenya tidak berubah, nyalakan ulang aplikasinya dengan `docker compose restart app`.

## Backup

- Layanan `cadangan` membuat satu backup database setiap hari dengan `pg_dump`. Backup dibuat pada pemeriksaan pertama setelah pukul 00.00 WIB, paling lambat sekitar pukul 01.00 WIB. Bila layanan baru menyala dan backup hari itu belum ada, backup langsung dibuat.
- Backup disimpan di volume `akun-digital_cadangan` dengan nama `akun-digital-<tahun>-<bulan>-<tanggal>-<jam><menit><detik>.dump`. Hanya tujuh backup terakhir yang disimpan. Backup yang lebih lama dihapus setiap kali backup baru selesai dibuat (PRD §12).
- Backup hanya berisi database. Foto dan ikon di volume unggahan tidak ikut.
- Isi Item stok di dalam backup tetap terenkripsi. Backup hanya bisa dipakai bersama `ITEM_STOK_KEY` yang sama.

Perintah di server:

| Perintah | Kegunaan |
|---|---|
| `docker compose exec cadangan ls -l /cadangan` | Melihat daftar backup |
| `docker compose logs --tail 50 cadangan` | Melihat kapan backup dibuat atau gagal |

Backup di volume ikut hilang bila servernya rusak. Karena itu, sesekali salin backup terbaru ke komputer Anda:

1. Di server, salin backup dari volume ke folder `/opt/akun-digital`:

   ```bash
   docker compose cp cadangan:/cadangan/<nama backup> /opt/akun-digital/<nama backup>
   ```

2. Di komputer Anda, ambil berkasnya, lalu hapus salinan di server:

   ```bash
   scp -i <berkas kunci deploy> deploy@akun.miwedigital.store:/opt/akun-digital/<nama backup> .
   ssh -i <berkas kunci deploy> deploy@akun.miwedigital.store rm /opt/akun-digital/<nama backup>
   ```

## Restore

Restore mengganti seluruh isi database dengan isi satu backup. Pesanan dan perubahan yang dibuat setelah backup itu hilang. Folder unggahan tidak disentuh.

### Restore di server yang sama

1. Jalankan dua baris di [Menjalankan perintah `docker compose` di server](#menjalankan-perintah-docker-compose-di-server), lalu lihat daftar backup dengan `docker compose exec cadangan ls -l /cadangan`.
2. Jalankan restore dengan nama backup yang dipilih:

   ```bash
   bash /opt/akun-digital/repo/deploy/pulihkan.sh <nama backup>
   ```

3. Ketik `PULIHKAN` saat diminta. Skrip ini menjalankan lima langkah:
   1. menghentikan aplikasi dan layanan cadangan;
   2. menghapus database, lalu membuatnya ulang kosong;
   3. memuat isi backup;
   4. menjalankan migrasi dari versi yang sedang terpasang;
   5. menyalakan aplikasi dan layanan cadangan lagi.

   Restore berhasil bila baris terakhirnya `✓ Database dipulihkan dari <nama backup>.` Bila salah satu langkah gagal, skrip menyebut langkah yang gagal, keadaan toko saat itu, dan perintah berikutnya, misalnya mengulang restore atau menyalakan lagi aplikasi.
4. Buka toko dan dasbor admin, lalu periksa datanya.

### Restore ke database kosong, misalnya di server baru

1. Jalankan [Deploy pertama](#deploy-pertama) langkah 1–5. Pakai `ITEM_STOK_KEY` yang sama dengan server lama. Setelah itu database berisi tabel kosong.
2. Dari komputer Anda, kirim berkas backup ke server. Ganti `<IP server>` dengan alamat IP server baru, karena domain toko mungkin masih menunjuk ke server lama:

   ```bash
   scp -i <berkas kunci deploy> <nama backup> deploy@<IP server>:/opt/akun-digital/
   ```

3. Di server, masukkan berkas itu ke volume backup:

   ```bash
   cd /opt/akun-digital/repo
   export COMPOSE_FILE=compose.prod.yml COMPOSE_ENV_FILES=/opt/akun-digital/produksi.env
   docker compose cp /opt/akun-digital/<nama backup> cadangan:/cadangan/<nama backup>
   ```

4. Ikuti [Restore di server yang sama](#restore-di-server-yang-sama) langkah 2–4. Akun Admin ikut terpulihkan dari backup, jadi langkah 6 deploy pertama tidak perlu dijalankan.
