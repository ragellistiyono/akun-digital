import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db, koneksi } from "./db";
import { pesanan, varian } from "./db/schema";
import type { PengirimEmail } from "./email";
import { emailTiruanKe } from "./email-tiruan";
import { cekStatusPembayaran, prosesKabarPembayaran } from "./kabar-pembayaran";
import {
  kerjakanEmailPesananSelesai,
  pekerjaanEmailPesananSelesai,
} from "./pekerjaan-latar";
import { bacaPengaturanToko } from "./pengaturan-toko";
import { bacaPesananLewatTautan } from "./pesanan";
import { bayarQrisTiruan } from "./qrispy-tiruan";
import { sisipkanProduk } from "./uji-katalog";
import { sisipkanPesanan } from "./uji-pesanan";

// Test integrasi dengan database app_test, Qrispy tiruan, dan email tiruan dari .env.ci (EMAIL_MODE=tiruan,
// EMAIL_FROM dan APP_URL bernilai contoh OD-1). Pekerja pg-boss tidak berjalan di proses test, jadi setiap
// test menjalankan sendiri pekerjaan email yang dijadwalkan untuk Pesanan-nya.
//
// Baris Pengaturan toko dipakai bersama test lain yang berjalan bersamaan (aksi.test.ts menimpanya), jadi
// nomor WhatsApp yang dibaca email diatur lewat bacaPengaturanToko tiruan.
vi.mock("./pengaturan-toko", async (asli) => ({
  ...(await asli<typeof import("./pengaturan-toko")>()),
  bacaPengaturanToko: vi.fn(),
}));

/** Nomor WhatsApp toko [CONTOH], dalam bentuk yang disimpan (tests/golden/nomor-whatsapp.json). */
const NOMOR_WHATSAPP = "6281234567890";

beforeEach(() => {
  vi.mocked(bacaPengaturanToko).mockResolvedValue({
    nomorWhatsapp: NOMOR_WHATSAPP,
    syaratKetentuan: "",
    kebijakanPrivasi: "",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await koneksi.end();
});

/** Isi Item stok dari prototipe (docs/design/prototipe) [CONTOH]. */
const FORMAT = ["Email", "Password", "Profil"];
const ISI_ITEM_STOK = ["miwe.akun07@contoh.id", "Senja-7419", "Profil 3"];

/**
 * Pesanan Netflix Premium 1 Bulan [CONTOH] yang Menunggu Pembayaran dengan rincian contoh PRD §5.5
 * (Harga jual Rp 50.000, potongan voucher Rp 5.000, Kode unik Rp 123, Total bayar Rp 45.123) dan satu Item
 * stok Ditahan berisi isi itu, lalu dibayar lewat Qrispy tiruan dan diproses lewat jalur cek status.
 */
async function pesananDibayar(isiItemStok = ISI_ITEM_STOK) {
  const produkId = await sisipkanProduk({
    nama: `Netflix Premium ${randomUUID().slice(0, 8)}`,
    formatItemStok: FORMAT,
    varian: [{ nama: "1 Bulan", hargaJual: 50000 }],
  });
  const [{ id: varianId }] = await db
    .select({ id: varian.id })
    .from(varian)
    .where(eq(varian.produkId, produkId));
  const dipesan = await sisipkanPesanan({
    varianId,
    status: "Menunggu Pembayaran",
    itemStok: { status: "Ditahan", nilai: isiItemStok },
  });
  const [{ email, qrisId }] = await db
    .select({ email: pesanan.email, qrisId: pesanan.qrisId })
    .from(pesanan)
    .where(eq(pesanan.id, dipesan.id));

  bayarQrisTiruan({ qrisId, amount: 45123 });
  await cekStatusPembayaran(dipesan.tautan);
  return { ...dipesan, email, qrisId };
}

/** Status dan tanda "Email gagal" Pesanan itu langsung dari database. */
async function tandaPesanan(id: string) {
  const [baris] = await db
    .select({ status: pesanan.status, emailGagal: pesanan.emailGagal })
    .from(pesanan)
    .where(eq(pesanan.id, id));
  return baris;
}

/** Adaptor email yang selalu gagal, misalnya karena Resend tidak menjawab. */
function pengirimGagal() {
  return {
    kirim: vi.fn<PengirimEmail["kirim"]>(async () => {
      throw new Error("Resend menjawab 503");
    }),
  } satisfies PengirimEmail;
}

/**
 * Menjalankan pekerjaan email Pesanan itu dengan adaptor yang selalu gagal sampai percobaan ulangnya
 * habis, seperti pg-boss: percobaan pertama ber-retryCount 0, dan percobaan terakhir ber-retryCount sama
 * dengan retryLimit. Hasilnya adaptor itu dan batas percobaan ulangnya.
 */
async function gagalSampaiHabis(pesananId: string) {
  const pengirim = pengirimGagal();
  const [pekerjaan] = await pekerjaanEmailPesananSelesai(pesananId);
  for (let retryCount = 0; retryCount <= pekerjaan.retryLimit; retryCount++) {
    expect(
      await kerjakanEmailPesananSelesai(
        { ...pekerjaan, retryCount },
        { pengirim },
      ),
    ).toMatchObject({ status: "failed" });
    if (retryCount < pekerjaan.retryLimit) {
      expect(await tandaPesanan(pesananId)).toEqual({
        status: "Selesai",
        emailGagal: false,
      });
    }
  }
  return { pengirim, retryLimit: pekerjaan.retryLimit };
}

/** Menjalankan setiap pekerjaan email yang dijadwalkan untuk Pesanan itu, satu kali. */
async function jalankanPekerjaanEmail(pesananId: string) {
  for (const pekerjaan of await pekerjaanEmailPesananSelesai(pesananId)) {
    await kerjakanEmailPesananSelesai(pekerjaan);
  }
}

describe('email "Pesanan selesai" (PRD §6.3, §10.1, §10.2)', () => {
  it("setelah pembayaran lewat Qrispy tiruan, tepat satu email terkirim ke email Pesanan, berisi Item stok, rincian nominal, dan Tautan Pesanan yang membuka Pesanan itu", async () => {
    const dibayar = await pesananDibayar();

    expect(await pekerjaanEmailPesananSelesai(dibayar.id)).toHaveLength(1);
    await jalankanPekerjaanEmail(dibayar.id);

    const terkirim = emailTiruanKe(dibayar.email);
    expect(terkirim).toHaveLength(1);
    const [email] = terkirim;
    expect(email.dari).toBe("MIWE Digital Store <no-reply@miwe.example>");
    expect(email.subjek).toBe(`Pesanan selesai: ${dibayar.nomorPesanan}`);

    for (const isi of [email.teks, email.html]) {
      for (const nilai of [...FORMAT, ...ISI_ITEM_STOK]) {
        expect(isi).toContain(nilai);
      }
      for (const nominal of [
        "Rp 50.000",
        "− Rp 5.000",
        "Rp 123",
        "Rp 45.123",
      ]) {
        expect(isi).toContain(nominal);
      }
    }
    const baris = email.teks.split("\n");
    expect(baris).toEqual(
      expect.arrayContaining([
        "Email: miwe.akun07@contoh.id",
        "Password: Senja-7419",
        "Profil: Profil 3",
        "Harga jual: Rp 50.000",
        "Potongan voucher: − Rp 5.000",
        "Kode unik: Rp 123",
        "Total bayar: Rp 45.123",
      ]),
    );

    // Tautan Pesanan berupa alamat lengkap di APP_URL, yang membuka Pesanan ini beserta Item stoknya.
    const alamat = `https://miwe.example/pesanan/${dibayar.tautan}`;
    expect(baris).toContain(alamat);
    expect(email.html).toContain(`href="${alamat}"`);
    const tautan = /https:\/\/miwe\.example\/pesanan\/([A-Za-z0-9_-]{43})/.exec(
      email.teks,
    )?.[1];
    const dibuka = await bacaPesananLewatTautan(tautan ?? "");
    expect(dibuka).toMatchObject({
      nomorPesanan: dibayar.nomorPesanan,
      status: "Selesai",
      itemStok: FORMAT.map((nama, i) => ({ nama, nilai: ISI_ITEM_STOK[i] })),
    });
  });

  // PRD §10.2: setiap email punya footer "Butuh bantuan? Hubungi kami di WhatsApp" dengan nomor dari
  // Pengaturan toko, yang membuka https://wa.me/<nomor> seperti tombol WhatsApp di web (PRD §9.8).
  it("footer email memuat nomor WhatsApp dari Pengaturan toko", async () => {
    const dibayar = await pesananDibayar();
    await jalankanPekerjaanEmail(dibayar.id);

    const [email] = emailTiruanKe(dibayar.email);
    expect(email.teks.split("\n").at(-1)).toBe(
      "Butuh bantuan? Hubungi kami di WhatsApp +6281234567890 (https://wa.me/6281234567890)",
    );
    expect(email.html).toContain("Butuh bantuan? Hubungi kami di");
    expect(email.html).toContain(
      '<a href="https://wa.me/6281234567890">WhatsApp +6281234567890</a>',
    );
  });

  // PRD §9.8: selama nomor WhatsApp belum diisi, tombol WhatsApp tidak tampil. Email tanpa nomor tidak
  // memuat footer WhatsApp yang tidak bisa dihubungi.
  it("selama nomor WhatsApp belum diisi di Pengaturan toko, email tidak memuat footer WhatsApp", async () => {
    vi.mocked(bacaPengaturanToko).mockResolvedValue({
      nomorWhatsapp: null,
      syaratKetentuan: "",
      kebijakanPrivasi: "",
    });
    const dibayar = await pesananDibayar();
    await jalankanPekerjaanEmail(dibayar.id);

    const [email] = emailTiruanKe(dibayar.email);
    expect(email.teks).not.toContain("WhatsApp");
    expect(email.html).not.toContain("WhatsApp");
    expect(email.teks.split("\n").at(-1)).toBe(
      `https://miwe.example/pesanan/${dibayar.tautan}`,
    );
  });

  // PRD §5.7 dan ADR-0004: kabar pembayaran yang sama bisa datang berulang lewat webhook, cek status,
  // pembatalan, dan kedaluwarsa. Hanya kabar yang membuat Pesanan menjadi Selesai yang menjadwalkan email.
  it("kabar pembayaran yang datang berulang tidak mengirim email kedua", async () => {
    const dibayar = await pesananDibayar();

    for (let i = 0; i < 2; i++) {
      expect(
        await prosesKabarPembayaran({
          qrisId: dibayar.qrisId,
          nominalDiterima: 45123,
          waktuBayar: new Date(),
        }),
      ).toEqual({ hasil: "tidak-berubah" });
    }
    await jalankanPekerjaanEmail(dibayar.id);

    expect(await pekerjaanEmailPesananSelesai(dibayar.id)).toHaveLength(1);
    expect(emailTiruanKe(dibayar.email)).toHaveLength(1);
  });

  // PRD §6.4: bila pengiriman gagal, Pesanan tetap Selesai, sistem mencoba ulang sendiri beberapa kali, dan
  // Pesanan ditandai "Email gagal" bila semua percobaan gagal.
  it('bila adaptor email terus gagal, Pesanan tetap Selesai dan bertanda "Email gagal" setelah percobaan ulang habis', async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dibayar = await pesananDibayar();
    expect(await tandaPesanan(dibayar.id)).toEqual({
      status: "Selesai",
      emailGagal: false,
    });

    const { pengirim, retryLimit } = await gagalSampaiHabis(dibayar.id);

    expect(retryLimit).toBeGreaterThanOrEqual(2);
    expect(pengirim.kirim).toHaveBeenCalledTimes(retryLimit + 1);
    expect(await tandaPesanan(dibayar.id)).toEqual({
      status: "Selesai",
      emailGagal: true,
    });
    expect(emailTiruanKe(dibayar.email)).toEqual([]);
  });

  it('pengiriman yang berhasil sesudah tanda "Email gagal" menghapus tanda itu', async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dibayar = await pesananDibayar();
    await gagalSampaiHabis(dibayar.id);
    expect((await tandaPesanan(dibayar.id)).emailGagal).toBe(true);

    await jalankanPekerjaanEmail(dibayar.id);

    expect(emailTiruanKe(dibayar.email)).toHaveLength(1);
    expect(await tandaPesanan(dibayar.id)).toEqual({
      status: "Selesai",
      emailGagal: false,
    });
  });

  // Isi Item stok berupa teks bebas yang diisi Admin (PRD §4.2), jadi bisa memuat tanda HTML.
  it("isi Item stok yang memuat tanda HTML tampil apa adanya di email, tanpa menjadi HTML", async () => {
    const isi = ["budi@contoh.id", '<b>Senja&"7419"</b>', "Profil <3>"];
    const dibayar = await pesananDibayar(isi);
    await jalankanPekerjaanEmail(dibayar.id);

    const [email] = emailTiruanKe(dibayar.email);
    expect(email.teks.split("\n")).toEqual(
      expect.arrayContaining([
        'Password: <b>Senja&"7419"</b>',
        "Profil: Profil <3>",
      ]),
    );
    expect(email.html).toContain(
      "&lt;b&gt;Senja&amp;&quot;7419&quot;&lt;/b&gt;",
    );
    expect(email.html).toContain("Profil &lt;3&gt;");
    expect(email.html).not.toContain("<b>");
  });
});
