# Issue tracker: GitHub Issues

Tiket di repo ini adalah GitHub Issues, dan diakses dengan `gh`. `gh` mengenali repo dari `git remote`.

## Operasi

- **Membaca tiket** beserta jawaban pemilik: `gh issue view <n> --json title,body,comments`. Dengan `--comments` saja, `gh` hanya mencetak komentar tanpa isi tiket.
- **Daftar tiket siap:** `gh issue list --state open --label ready-for-agent --json number,title,body,labels`.
- **Membuat tiket:**

  ```
  gh issue create --title "[Txx] ..." --label ready-for-agent --milestone <tahap> --body-file <berkas>
  ```

  Isi tiket memakai format `.github/ISSUE_TEMPLATE/ticket.md`.
- **Komentar:** `gh issue comment <n> --body-file <berkas>`.
- **Label:** `gh issue edit <n> --add-label <label>`, atau `--remove-label <label>`.
- **Menutup issue:** issue ditutup oleh `Closes #n` di PR yang di-merge, bukan dengan `gh issue close`.

## Ketergantungan antar-tiket

Ketergantungan ditulis di bagian "Blocked by" di isi tiket, sebagai `- #12`, atau "Tidak ada" bila tiket tidak bergantung pada tiket lain. Koordinator membaca bagian teks itu. Karena itu, repo ini tidak memakai fitur dependensi bawaan GitHub, juga tidak memakai sub-issue.

## Bentuk tiket

Satu tiket dikerjakan dalam satu PR. Bagian wajibnya:
- Yang dibangun.
- Dalam scope.
- Di luar scope.
- Kriteria penerimaan. Setiap butir harus bisa dicek lulus atau gagal.
- Rujukan: PRD §, ADR, golden, UAT.
- Blocked by.

Kriteria yang menyebut angka mengutip `tests/golden/` atau PRD.

## Pull request

- **Membuat:** `gh pr create --title "T<nn>: <ringkasan>" --body-file <berkas>`, dengan isi yang mengikuti `.github/pull_request_template.md`.
- **Pembaruan** ditulis sebagai komentar PR. Deskripsi PR tidak diedit setelah dibuat.
- **Permintaan fitur** dari manusia selalu dibuat sebagai issue, tidak pernah lewat PR.

**PRs as a request surface: no.**

## Saat sebuah skill menyebut "publish to the issue tracker"

Buat issue GitHub dengan format di atas.

## Saat sebuah skill menyebut "fetch the relevant ticket"

Baca issue-nya dengan `gh issue view <n> --json title,body,comments`.
