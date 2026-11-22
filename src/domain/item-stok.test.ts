import { describe, expect, it } from "vitest";

import kembar from "../../tests/golden/item-stok-kembar.json";
import golden from "../../tests/golden/tempel-item-stok.json";
import {
  isiBarisTempelan,
  itemStokBolehDiubah,
  kolomItemStok,
  periksaItemStok,
  STATUS_ITEM_STOK,
  tempelItemStok,
  type LetakItemStok,
} from "./item-stok";

/** Letak contoh untuk Item stok yang sudah ada, bila letaknya tidak diperiksa test itu. */
const LETAK_VARIAN_INI: LetakItemStok = {
  id: "item-stok-ada",
  produk: "Netflix Premium",
  varian: "1 Bulan",
  status: "Tersedia",
};

/** Tanpa Item stok lain di toko. */
const tanpaItemStok = () => [];

// PRD §4.2: satu baris satu Item stok, kolom dipisah |. Baris dengan jumlah kolom yang salah, kolom
// kosong, sama persis dengan Item stok yang sudah ada, atau kembar dengan baris sebelumnya di tempelan
// ditolak. Baris kosong diabaikan, tetapi tetap dihitung nomornya.
describe("tempelItemStok", () => {
  it.each(golden.kasus)("$nama", ({ input, output }) => {
    // Fixture menulis Item stok yang sudah ada dalam bentuk baris tempelan. Dari tempelan, isi
    // kolomnya tidak pernah memuat |, jadi menyambungnya kembali dengan | menghasilkan baris itu.
    const hasil = tempelItemStok({
      kolom: input.kolom,
      teks: input.baris.join("\n"),
      itemStokSama: (nilai) =>
        input.itemStokAda.includes(nilai.join("|")) ? [LETAK_VARIAN_INI] : [],
    });

    expect(hasil.tersimpan.map((nilai) => nilai.join("|"))).toEqual(
      output.tersimpan,
    );
    expect(hasil).toMatchObject({
      ditolak: output.ditolak,
      ringkasan: output.ringkasan,
    });
  });
});

describe("tempelItemStok: bahan setiap penolakan", () => {
  const kolom = ["Email", "Password", "Profil"];

  it("menyebut jumlah kolom yang terbaca, dan baris pertama yang dikembari (UAT-D1)", () => {
    const hasil = tempelItemStok({
      kolom,
      teks: [
        "a@mail.com|pass1|Profil 1",
        "b@mail.com|pass2|Profil 2",
        "c@mail.com|pass3",
        "a@mail.com|pass1|Profil 1",
        "d@mail.com|pass4|Profil 4",
      ].join("\n"),
      itemStokSama: tanpaItemStok,
    });

    expect(hasil.ditolak).toEqual([
      {
        baris: 3,
        teks: "c@mail.com|pass3",
        alasan: "jumlah-kolom-salah",
        jumlahKolom: 2,
      },
      {
        baris: 4,
        teks: "a@mail.com|pass1|Profil 1",
        alasan: "kembar-dalam-tempelan",
        samaDenganBaris: 1,
      },
    ]);
  });

  it("menyebut nomor setiap kolom yang kosong", () => {
    const hasil = tempelItemStok({
      kolom,
      teks: "|rahasia123| ",
      itemStokSama: tanpaItemStok,
    });

    expect(hasil.ditolak).toEqual([
      {
        baris: 1,
        teks: "|rahasia123| ",
        alasan: "kolom-kosong",
        nomorKolom: [1, 3],
      },
    ]);
  });

  it("membaca tempelan berakhiran baris Windows (\\r\\n) dan baris kosong di akhir", () => {
    const hasil = tempelItemStok({
      kolom,
      teks: "budi@mail.com|rahasia123|Profil 2\r\nsiti@mail.com|rahasia456|Profil 3\r\n",
      itemStokSama: tanpaItemStok,
    });

    expect(hasil).toEqual({
      tersimpan: [
        ["budi@mail.com", "rahasia123", "Profil 2"],
        ["siti@mail.com", "rahasia456", "Profil 3"],
      ],
      ditolak: [],
      ringkasan: "2 tersimpan, 0 ditolak",
    });
  });

  it("membuang spasi di awal dan akhir kolom, jadi baris yang hanya berbeda spasi itu kembar", () => {
    const hasil = tempelItemStok({
      kolom,
      teks: "budi@mail.com | rahasia123 | Profil 2\nbudi@mail.com|rahasia123|Profil 2",
      itemStokSama: tanpaItemStok,
    });

    expect(hasil.tersimpan).toEqual([
      ["budi@mail.com", "rahasia123", "Profil 2"],
    ]);
    expect(hasil.ditolak).toEqual([
      expect.objectContaining({
        baris: 2,
        alasan: "kembar-dalam-tempelan",
        samaDenganBaris: 1,
      }),
    ]);
  });

  it("menolak baris yang sama dengan Item stok yang sudah ada sebagai sudah-ada, walau kembar di tempelan", () => {
    const hasil = tempelItemStok({
      kolom: ["Kode"],
      teks: "KODE-111\nKODE-111",
      itemStokSama: ([kode]) => (kode === "KODE-111" ? [LETAK_VARIAN_INI] : []),
    });

    const sudahAda = {
      teks: "KODE-111",
      alasan: "sudah-ada",
      letak: LETAK_VARIAN_INI,
      pesan: "Sudah ada di Netflix Premium – 1 Bulan (Tersedia)",
    };
    expect(hasil.ditolak).toEqual([
      { baris: 1, ...sudahAda },
      { baris: 2, ...sudahAda },
    ]);
  });
});

// PRD §4.2 ▶ Keputusan 2026-11-22: Item stok kembar diperiksa di seluruh toko, dari Varian dan Produk mana pun,
// berstatus Tersedia, Ditahan, maupun Terkirim. Kasus dengan sedangDiubah null adalah tempelan; kasus lainnya
// mengubah Item stok ke-sedangDiubah di itemStokToko menjadi baris satu-satunya, lewat periksaItemStok.
describe("Item stok kembar di seluruh toko", () => {
  /** Status dari fixture, yang ditulis sebagai teks. */
  function status(teks: string) {
    const hasil = STATUS_ITEM_STOK.find((satu) => satu === teks);
    if (!hasil) throw new Error(`Status "${teks}" di fixture tidak dikenal.`);
    return hasil;
  }

  it.each(kembar.kasus)("$nama", ({ input, output }) => {
    // Lapisan server mengenali Item stok yang sama persis dari sidik jari isinya. Di sini isi yang tersimpan
    // dibandingkan langsung, kolom demi kolom, dan id-nya adalah indeksnya di itemStokToko.
    const itemStokSama = (nilai: readonly string[]) =>
      input.itemStokToko.flatMap((satu, indeks) =>
        satu.kolom.length === nilai.length &&
        satu.kolom.every((isi, i) => isi === nilai[i])
          ? [
              {
                id: String(indeks),
                produk: satu.produk,
                varian: satu.varian,
                status: status(satu.status),
              },
            ]
          : [],
      );
    const pesan = (masalah: { alasan: string; pesan?: string }) =>
      masalah.alasan === "sudah-ada" ? masalah.pesan : null;

    if (input.sedangDiubah === null) {
      const hasil = tempelItemStok({
        kolom: input.kolom,
        teks: input.baris.join("\n"),
        itemStokSama,
      });

      expect(hasil.tersimpan.map((nilai) => nilai.join("|"))).toEqual(
        output.tersimpan,
      );
      expect(
        hasil.ditolak.map((satu) => ({
          baris: satu.baris,
          alasan: satu.alasan,
          pesan: pesan(satu),
        })),
      ).toEqual(output.ditolak);
      expect(hasil.ringkasan).toBe(output.ringkasan);
    } else {
      const hasil = periksaItemStok({
        kolom: input.kolom,
        nilai: input.baris[0].split("|"),
        itemStokSama,
        sedangDiubah: String(input.sedangDiubah),
      });

      expect(hasil.sah ? [hasil.nilai.join("|")] : []).toEqual(
        output.tersimpan,
      );
      expect(
        hasil.sah
          ? []
          : [
              {
                baris: 1,
                alasan: hasil.masalah.alasan,
                pesan: pesan(hasil.masalah),
              },
            ],
      ).toEqual(output.ditolak);
    }
  });
});

describe("periksaItemStok (form satu Item stok)", () => {
  const kolom = ["Email", "Password", "Profil"];

  it("menerima Item stok contoh PRD §4.2", () => {
    expect(
      periksaItemStok({
        kolom,
        nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
        itemStokSama: tanpaItemStok,
      }),
    ).toEqual({
      sah: true,
      nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
    });
  });

  it("membuang spasi di awal dan akhir setiap kolom", () => {
    expect(
      periksaItemStok({
        kolom,
        nilai: [" budi@mail.com ", "rahasia123\t", "Profil 2"],
        itemStokSama: tanpaItemStok,
      }),
    ).toEqual({
      sah: true,
      nilai: ["budi@mail.com", "rahasia123", "Profil 2"],
    });
  });

  it("menolak kolom kosong dan menyebut nomor kolomnya", () => {
    expect(
      periksaItemStok({
        kolom,
        nilai: ["budi@mail.com", "  ", ""],
        itemStokSama: tanpaItemStok,
      }),
    ).toEqual({
      sah: false,
      masalah: { alasan: "kolom-kosong", nomorKolom: [2, 3] },
    });
  });

  it("menolak Item stok yang sama persis dengan Item stok yang sudah ada, dan menyebut letaknya", () => {
    expect(
      periksaItemStok({
        kolom: ["Kode"],
        nilai: [" KODE-111 "],
        itemStokSama: ([kode]) =>
          kode === "KODE-111" ? [LETAK_VARIAN_INI] : [],
      }),
    ).toEqual({
      sah: false,
      masalah: {
        alasan: "sudah-ada",
        letak: LETAK_VARIAN_INI,
        pesan: "Sudah ada di Netflix Premium – 1 Bulan (Tersedia)",
      },
    });
  });

  it("menolak isian yang jumlah kolomnya tidak sama dengan Format Item stok", () => {
    expect(
      periksaItemStok({
        kolom,
        nilai: ["budi@mail.com", "rahasia123"],
        itemStokSama: tanpaItemStok,
      }),
    ).toEqual({
      sah: false,
      masalah: { alasan: "jumlah-kolom-salah", jumlahKolom: 2 },
    });
  });
});

// PRD §4.4: Item stok yang Tersedia boleh diubah atau dihapus. Item stok yang Ditahan atau Terkirim tidak bisa
// diubah atau dihapus. Belum ada fixture golden untuk aturan ini, jadi ekspektasinya diambil langsung dari
// PRD §4.4 dan kriteria penerimaan issue T27.
describe("itemStokBolehDiubah", () => {
  it("Item stok Tersedia boleh diubah atau dihapus", () => {
    expect(itemStokBolehDiubah("Tersedia")).toBe(true);
  });

  it.each(["Ditahan", "Terkirim"] as const)(
    "Item stok %s tidak bisa diubah atau dihapus",
    (status) => {
      expect(itemStokBolehDiubah(status)).toBe(false);
    },
  );
});

// PRD §4.1 dan §9.7: daftar Item stok menampilkan isi lengkap setiap Item stok. Item stok yang sudah Terkirim
// tetap tampil dengan kolom lamanya. Contoh baris dari PRD §4.2 untuk format `Email`, `Password`, `Profil`:
// `budi@mail.com|rahasia123|Profil 2`.
describe("kolomItemStok", () => {
  const nilai = ["budi@mail.com", "rahasia123", "Profil 2"];

  it.each(["Tersedia", "Ditahan"] as const)(
    "Item stok %s tampil dengan nama kolom Format Item stok yang berlaku sekarang",
    (status) => {
      expect(
        kolomItemStok({
          status,
          formatItemStok: ["Email", "Password", "Profil"],
          formatSaatTerkirim: null,
          nilai,
        }),
      ).toEqual([
        { nama: "Email", nilai: "budi@mail.com" },
        { nama: "Password", nilai: "rahasia123" },
        { nama: "Profil", nilai: "Profil 2" },
      ]);
    },
  );

  it("Item stok Terkirim tampil dengan nama kolom yang dicatat saat Terkirim, walau nama kolomnya sudah diganti", () => {
    expect(
      kolomItemStok({
        status: "Terkirim",
        formatItemStok: ["Email login", "Kata sandi", "Profil"],
        formatSaatTerkirim: ["Email", "Password", "Profil"],
        nilai,
      }),
    ).toEqual([
      { nama: "Email", nilai: "budi@mail.com" },
      { nama: "Password", nilai: "rahasia123" },
      { nama: "Profil", nilai: "Profil 2" },
    ]);
  });

  it("Item stok Terkirim yang tidak mencatat nama kolomnya ditolak dengan galat", () => {
    expect(() =>
      kolomItemStok({
        status: "Terkirim",
        formatItemStok: ["Email", "Password", "Profil"],
        formatSaatTerkirim: null,
        nilai,
      }),
    ).toThrow(/tidak mencatat nama kolom/);
  });

  it("Item stok Tersedia yang jumlah isi kolomnya tidak sama dengan Format Item stok ditolak dengan galat", () => {
    expect(() =>
      kolomItemStok({
        status: "Tersedia",
        formatItemStok: ["Email", "Password"],
        formatSaatTerkirim: null,
        nilai,
      }),
    ).toThrow(/3 isi kolom.*2 kolom/);
  });
});

// Lapisan server membaca Item stok toko yang mungkin sama persis dengan isi setiap baris tempelan, sebelum
// tempelan diperiksa (PRD §4.2). Contoh baris dari PRD §4.2 dan UAT-D1.
describe("isiBarisTempelan", () => {
  it("memuat isi setiap baris yang tidak kosong, dengan spasi di awal dan akhir kolom dibuang", () => {
    expect(
      isiBarisTempelan(
        "budi@mail.com | rahasia123 | Profil 2\r\n\n   \nc@mail.com|pass3\n",
      ),
    ).toEqual([
      ["budi@mail.com", "rahasia123", "Profil 2"],
      ["c@mail.com", "pass3"],
    ]);
  });
});
