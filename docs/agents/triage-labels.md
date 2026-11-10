# Label triase

Skill di mattpocock-skills memakai lima peran triase. Tabel ini memetakan setiap peran ke label yang benar-benar dipakai di repo ini. Sumber nama labelnya adalah bagian `labels` di `.github/jalankan-tiket.json`, dan `/tiket:cek-proyek` memeriksa bahwa kedua berkas itu sama.

| Label in mattpocock/skills | Label in our tracker | Arti |
|---|---|---|
| `needs-triage` | `needs-triage` | Pemilik perlu menilai issue ini |
| `needs-info` | `needs-info` | Menunggu jawaban pemilik. Koordinator melewatinya |
| `ready-for-agent` | `ready-for-agent` | Spesifikasinya lengkap dan siap dikerjakan agent |
| `ready-for-human` | `ready-for-human` | Perlu dikerjakan manusia, misalnya karena menyangkut kredensial atau domain |
| `wontfix` | `wontfix` | Tidak akan dikerjakan |

Selain kelima label itu ada label `disetujui-pemilik`. Label ini dipasang pemilik pada PR yang mengubah berkas terlindungi. Agent tidak pernah memasangnya.
