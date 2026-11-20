// Skema database Drizzle. Tabel ditambahkan oleh tiket yang membutuhkannya,
// lalu migrasinya dibuat dengan `pnpm exec drizzle-kit generate`.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL,
  PERSEN_BIAYA_TRANSAKSI_AWAL,
} from "../../domain/biaya-transaksi";
import { JENIS_CAKUPAN, JENIS_POTONGAN } from "../../domain/isian-voucher";
import { STATUS_ITEM_STOK } from "../../domain/item-stok";
import { STATUS_PESANAN } from "../../domain/status-pesanan";
import { AMBANG_STOK_MENIPIS_AWAL } from "../../domain/stok-menipis";
import { JENIS_RIWAYAT_SALDO } from "../../domain/ubah-saldo-admin";

// Tabel login Better Auth untuk email dan password (ADR-0001). Nama tabel dan kolom mengikuti
// skema bawaan Better Auth, supaya adaptor Drizzle-nya bisa memakainya tanpa pemetaan.
const instan = (nama: string) => timestamp(nama, { withTimezone: true });

// Peran akun login (PRD §2.1). Satu email hanya bisa menjadi Admin atau Member, tidak keduanya
// (PRD §7.2 ▶ Keputusan 2026-11-17), jadi peran disimpan di baris user yang emailnya unik.
export const PERAN_AKUN = ["Admin", "Member"] as const;
export const peranAkun = pgEnum("peran_akun", PERAN_AKUN);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    peran: peranAkun("peran").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    // Member nonaktif (PRD §2.3): dinonaktifkan Admin, sehingga tidak bisa login maupun checkout dengan
    // emailnya. Hanya Member yang bisa dinonaktifkan; Admin selalu false.
    nonaktif: boolean("nonaktif").default(false).notNull(),
    // Saldo Member (PRD §15.1): rupiah bulat yang dimulai dari Rp 0 dan tidak pernah negatif. Setiap perubahannya
    // ditulis bersama satu baris riwayat_saldo dalam transaksi yang sama. Admin selalu Rp 0.
    saldo: bigint("saldo", { mode: "number" }).default(0).notNull(),
    image: text("image"),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (tabel) => [check("user_saldo_tidak_negatif", sql`${tabel.saldo} >= 0`)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: instan("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (tabel) => [index("session_user_id_idx").on(tabel.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instan("access_token_expires_at"),
    refreshTokenExpiresAt: instan("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (tabel) => [index("account_user_id_idx").on(tabel.userId)],
);

// Better Auth mewajibkan tabel ini walaupun login Admin belum memakainya (kode sekali pakai,
// misalnya untuk verifikasi email atau atur ulang password).
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instan("expires_at").notNull(),
    createdAt: instan("created_at").defaultNow().notNull(),
    updatedAt: instan("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (tabel) => [index("verification_identifier_idx").on(tabel.identifier)],
);

// Batas salah password login (PRD §7.7), satu baris per email dalam bentuk bakunya (PRD §7.4).
// Baris juga dibuat untuk email yang tidak terdaftar, supaya penolakannya sama dengan email Admin.
export const batasLogin = pgTable("batas_login", {
  email: text("email").primaryKey(),
  jumlahSalah: integer("jumlah_salah").default(0).notNull(),
  terkunciSampai: instan("terkunci_sampai"),
});

// Batas salah password lama di form ganti password (PRD §7.6 ▶ Keputusan 2026-11-17), satu baris
// per Member. Hitungannya terpisah dari batas_login, jadi kunci ganti password tidak memengaruhi login.
export const batasGantiPassword = pgTable("batas_ganti_password", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  jumlahSalah: integer("jumlah_salah").default(0).notNull(),
  terkunciSampai: instan("terkunci_sampai"),
});

// Pendaftar (PRD §7.2 ▶ Keputusan 2026-11-17): orang yang sudah membuat password tetapi belum memasukkan
// Kode verifikasi yang benar. Pendaftar belum menjadi Member, jadi disimpan terpisah dari tabel user:
// ia tidak bisa login dan tidak terhitung sebagai Member. Satu baris per email dalam bentuk bakunya
// (PRD §7.4). Password disimpan sebagai hash dengan format Better Auth. Hanya Kode verifikasi terakhir
// yang disimpan, jadi setiap kode baru membuat kode sebelumnya tidak berlaku (PRD §7.2, §7.3).
// Jumlah salah kode menghitung kesalahan memasukkan kode terakhir itu, dan kembali ke 0 setiap kali kode
// baru dikirim; kode hangus setelah 5 kali salah (PRD §7.7).
export const pendaftar = pgTable("pendaftar", {
  email: text("email").primaryKey(),
  password: text("password").notNull(),
  kodeVerifikasi: text("kode_verifikasi").notNull(),
  kodeDikirimPada: instan("kode_dikirim_pada").notNull(),
  jumlahSalahKode: integer("jumlah_salah_kode").default(0).notNull(),
});

// Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17): satu baris untuk setiap tautan yang
// dikirim ke Member aktif. Yang disimpan hanya hash SHA-256 dari bagian acak tautannya, supaya isi
// database saja tidak cukup untuk membuka tautan. Tautan lama tetap disimpan, supaya tautan yang sudah
// diganti tautan lebih baru bisa ditolak dengan alasannya. Dipakai pada terisi setelah password baru
// disimpan lewat tautan itu, karena tautan hanya sekali pakai.
export const tautanAturUlangPassword = pgTable(
  "tautan_atur_ulang_password",
  {
    hashTautan: text("hash_tautan").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dikirimPada: instan("dikirim_pada").notNull(),
    dipakaiPada: instan("dipakai_pada"),
  },
  (tabel) => [
    index("tautan_atur_ulang_password_user_id_dikirim_pada_idx").on(
      tabel.userId,
      tabel.dikirimPada,
    ),
  ],
);

// Kategori (PRD §3.1): satu tingkat, dengan nama dan gambar ikon. Kolom ikon berisi nama berkas
// gambar di folder unggahan (src/server/berkas-unggahan.ts). Nama Kategori unik (PRD §3.1 ▶ Keputusan
// 2026-11-11); aturannya diperiksa namaKategoriDipakai di domain. Indeks unik atas nama tanpa huruf
// besar-kecil dan tanpa spasi tepi menjaganya juga bila dua Admin menyimpan bersamaan.
export const kategori = pgTable(
  "kategori",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    ikon: text("ikon").notNull(),
  },
  (tabel) => [
    uniqueIndex("kategori_nama_unik").on(sql`lower(btrim(${tabel.nama}))`),
  ],
);

// Produk (PRD §3.2, §3.3, §3.6, §3.7) di tepat satu Kategori. Kategori yang masih berisi Produk tidak
// bisa dihapus (PRD §3.1), jadi rujukannya restrict. Format Item stok (PRD §4.1) disimpan sebagai
// daftar nama kolom berurutan; aturan isinya (issue T07) diperiksa periksaFormatItemStok di domain.
// Foto Produk (PRD §3.3) adalah daftar nama berkas gambar di folder unggahan menurut urutannya; foto
// pertama menjadi sampul. Batas 5 foto diperiksa tambahFoto di domain.
export const produk = pgTable(
  "produk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategori.id, { onDelete: "restrict" }),
    deskripsi: text("deskripsi").notNull(),
    ketentuanGaransi: text("ketentuan_garansi").notNull(),
    unggulan: boolean("unggulan").default(false).notNull(),
    aktif: boolean("aktif").default(true).notNull(),
    formatItemStok: text("format_item_stok").array().notNull(),
    foto: text("foto").array().default([]).notNull(),
  },
  (tabel) => [index("produk_kategori_id_idx").on(tabel.kategoriId)],
);

// Varian (PRD §3.2, §3.5, §3.7): pilihan di dalam sebuah Produk, dengan Harga jual dan Harga normal
// opsional dalam rupiah bulat. Aturan harganya diperiksa periksaHarga di domain. Harga normal tidak
// dibatasi maksimum, jadi disimpan sebagai bigint. Varian tidak ada tanpa Produknya, jadi ikut
// terhapus bersama Produk (T29).
// Harga modal (PRD §14.1) diperiksa periksaHargaModal dan juga tidak dibatasi maksimum, jadi bigint. Kolom ini
// null hanya untuk Varian yang dibuat sebelum fitur Harga modal tayang; form Varian selalu mengisinya.
export const varian = pgTable(
  "varian",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produkId: uuid("produk_id")
      .notNull()
      .references(() => produk.id, { onDelete: "cascade" }),
    nama: text("nama").notNull(),
    hargaJual: integer("harga_jual").notNull(),
    hargaNormal: bigint("harga_normal", { mode: "number" }),
    hargaModal: bigint("harga_modal", { mode: "number" }),
    aktif: boolean("aktif").default(true).notNull(),
  },
  (tabel) => [index("varian_produk_id_idx").on(tabel.produkId)],
);

// Status Item stok (GLOSSARY): Tersedia, Ditahan, atau Terkirim. Stok Varian dihitung dari status ini
// oleh stokVarian di domain (PRD §5.3).
export const statusItemStok = pgEnum("status_item_stok", STATUS_ITEM_STOK);

// Item stok (PRD §4) milik satu Varian. Isinya, yaitu isi kolom-kolom Format Item stok, disimpan
// terenkripsi (PRD §12) oleh src/server/enkripsi-item-stok.ts. Sidik jari HMAC dari isinya dipakai
// untuk menolak Item stok yang sama persis di Varian yang sama (PRD §4.2) tanpa membuka Item stok
// lain; indeks unik menjaganya juga bila dua Admin mengisi bersamaan. Item stok tidak ada tanpa
// Variannya, jadi ikut terhapus bersama Varian.
// Item stok Ditahan mencatat Pesanan yang menahannya di pesanan_id (PRD §5.3), dan Item stok Terkirim
// mencatat Pesanan penerimanya. Satu Pesanan hanya pernah mendapat satu Item stok (PRD §5.7), jadi
// pesanan_id unik; Item stok Tersedia tidak punya Pesanan. Item stok Terkirim juga mencatat nama kolom
// Format Item stok saat dikirim, karena Item stok Terkirim tetap tampil dengan kolom lamanya (PRD §4.1).
export const itemStok = pgTable(
  "item_stok",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    varianId: uuid("varian_id")
      .notNull()
      .references(() => varian.id, { onDelete: "cascade" }),
    isiTerenkripsi: text("isi_terenkripsi").notNull(),
    sidikJari: text("sidik_jari").notNull(),
    status: statusItemStok("status").default("Tersedia").notNull(),
    pesananId: uuid("pesanan_id").references((): AnyPgColumn => pesanan.id, {
      onDelete: "restrict",
    }),
    formatSaatTerkirim: text("format_saat_terkirim").array(),
  },
  (tabel) => [
    uniqueIndex("item_stok_varian_id_sidik_jari_idx").on(
      tabel.varianId,
      tabel.sidikJari,
    ),
    uniqueIndex("item_stok_pesanan_id_unik").on(tabel.pesananId),
  ],
);

// Pengaturan toko (PRD §9.8): tepat satu baris untuk seluruh toko, dengan id 1. Nomor WhatsApp null
// berarti belum diisi. Ambang stok menipis bernilai awal 5 (PRD §9.4); aturan rentangnya diperiksa
// periksaAmbangStokMenipis di domain.
export const pengaturanToko = pgTable(
  "pengaturan_toko",
  {
    id: integer("id").primaryKey().default(1),
    nomorWhatsapp: text("nomor_whatsapp"),
    syaratKetentuan: text("syarat_ketentuan").default("").notNull(),
    kebijakanPrivasi: text("kebijakan_privasi").default("").notNull(),
    ambangStokMenipis: integer("ambang_stok_menipis")
      .default(AMBANG_STOK_MENIPIS_AWAL)
      .notNull(),
    // Biaya transaksi (PRD §14.3): persen 0 sampai 10 dengan paling banyak 2 angka di belakang koma, dan
    // minimal Total bayar yang dikenai biaya dalam rupiah bulat. Keduanya diperiksa
    // periksaIsianBiayaTransaksi sebelum disimpan.
    persenBiayaTransaksi: numeric("persen_biaya_transaksi", {
      precision: 4,
      scale: 2,
      mode: "number",
    })
      .default(PERSEN_BIAYA_TRANSAKSI_AWAL)
      .notNull(),
    minimalTotalBayarBiayaTransaksi: bigint(
      "minimal_total_bayar_biaya_transaksi",
      { mode: "number" },
    )
      .default(MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL)
      .notNull(),
  },
  (tabel) => [
    check("pengaturan_toko_satu_baris", sql`${tabel.id} = 1`),
    check(
      "pengaturan_toko_persen_biaya_transaksi_rentang",
      sql`${tabel.persenBiayaTransaksi} between 0 and 10`,
    ),
    check(
      "pengaturan_toko_minimal_biaya_transaksi_tidak_negatif",
      sql`${tabel.minimalTotalBayarBiayaTransaksi} >= 0`,
    ),
  ],
);

// Status Pesanan (GLOSSARY, PRD §5.7).
export const statusPesanan = pgEnum("status_pesanan", STATUS_PESANAN);

// Pesanan (PRD §5.1): satu pembelian satu Varian. Harga jual dan potongan voucher dicatat saat checkout,
// jadi perubahan harga sesudahnya tidak mengubah Pesanan ini. Kode unik, Total bayar, waktu kedaluwarsa,
// dan gambar QR diambil dari QRIS yang diterbitkan Qrispy (ADR-0004); qris_id menautkan Pesanan ke QRIS
// itu. Nomor Pesanan (PRD §9.6) dan Tautan Pesanan (PRD §6.2) unik. Varian yang sudah pernah dipesan
// tidak bisa dihapus (PRD §3.7), jadi rujukannya restrict. Waktu bayar dari kabar pembayaran Qrispy
// dicatat begitu kabar itu diproses, dan null selama belum dibayar. Tanda "Email gagal" (PRD §6.4) dipasang
// bila semua percobaan kirim email "Pesanan selesai" gagal, dan dihapus begitu email itu berhasil dikirim.
// Pesanan yang memakai Voucher mencatat rujukan ke Voucher itu beserta kodenya (PRD §8.8 ▶ Keputusan
// 2026-11-17); keduanya null untuk Pesanan tanpa Voucher. Voucher yang pernah tercatat di Pesanan tidak bisa
// dihapus (PRD §8.8), jadi rujukannya restrict.
// Harga modal Varian juga dicatat saat checkout (PRD §14.1), dan null bila Varian itu belum punya Harga modal.
// Pesanan tanpa Harga modal ikut diisi saat Harga modal Varian-nya diisi untuk pertama kalinya (ubahVarian).
// Biaya transaksi (PRD §14.3) dihitung dan dicatat saat kabar pembayaran diproses, dari Pengaturan toko saat
// itu, dan null selama Pesanan belum dibayar. Pengaturan yang diubah sesudahnya tidak mengubahnya.
export const pesanan = pgTable(
  "pesanan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nomorPesanan: text("nomor_pesanan").notNull(),
    tautan: text("tautan").notNull(),
    email: text("email").notNull(),
    varianId: uuid("varian_id")
      .notNull()
      .references(() => varian.id, { onDelete: "restrict" }),
    hargaJual: integer("harga_jual").notNull(),
    hargaModal: bigint("harga_modal", { mode: "number" }),
    biayaTransaksi: integer("biaya_transaksi"),
    potonganVoucher: integer("potongan_voucher").notNull(),
    kodeUnik: integer("kode_unik").notNull(),
    totalBayar: integer("total_bayar").notNull(),
    qrisId: text("qris_id").notNull(),
    kedaluwarsaPada: instan("kedaluwarsa_pada").notNull(),
    /** Gambar QR dari Qrispy sebagai data URL PNG (qris_image_base64). */
    gambarQr: text("gambar_qr").notNull(),
    status: statusPesanan("status").notNull(),
    waktuBayar: instan("waktu_bayar"),
    emailGagal: boolean("email_gagal").default(false).notNull(),
    voucherId: uuid("voucher_id").references(() => voucher.id, {
      onDelete: "restrict",
    }),
    kodeVoucher: text("kode_voucher"),
  },
  (tabel) => [
    uniqueIndex("pesanan_nomor_pesanan_unik").on(tabel.nomorPesanan),
    uniqueIndex("pesanan_tautan_unik").on(tabel.tautan),
    uniqueIndex("pesanan_qris_id_unik").on(tabel.qrisId),
    index("pesanan_varian_id_idx").on(tabel.varianId),
    index("pesanan_voucher_id_idx").on(tabel.voucherId),
    check(
      "pesanan_voucher_dan_kode_bersama",
      sql`(${tabel.voucherId} is null) = (${tabel.kodeVoucher} is null)`,
    ),
  ],
);

// Riwayat status Pesanan: satu baris untuk setiap perubahan status, berisi waktu, status baru, dan
// pelakunya, misalnya Pembeli saat checkout. Baris pertama ditulis saat Pesanan dibuat.
export const riwayatStatusPesanan = pgTable(
  "riwayat_status_pesanan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pesananId: uuid("pesanan_id")
      .notNull()
      .references(() => pesanan.id, { onDelete: "cascade" }),
    waktu: instan("waktu").notNull(),
    status: statusPesanan("status").notNull(),
    pelaku: text("pelaku").notNull(),
  },
  (tabel) => [
    index("riwayat_status_pesanan_pesanan_id_idx").on(tabel.pesananId),
  ],
);

// Jenis potongan Voucher (PRD §8.2): nominal tetap atau persen.
export const jenisPotongan = pgEnum("jenis_potongan", JENIS_POTONGAN);

// Jenis Cakupan voucher (PRD §8.4 ▶ Keputusan 2026-11-17): semua Produk, Produk tertentu, atau Kategori tertentu.
export const jenisCakupan = pgEnum("jenis_cakupan", JENIS_CAKUPAN);

// Voucher (PRD §8.1, §8.2, §8.4). Kode disimpan dalam huruf besar tanpa spasi tepi, dan unik tanpa membedakan
// huruf besar dan kecil (PRD §8.4 ▶ Keputusan 2026-11-17); aturannya diperiksa periksaKodeVoucher di domain,
// dan indeks unik menjaganya juga bila dua Admin menyimpan bersamaan. Nilai berisi rupiah untuk nominal tetap
// atau persen untuk jenis persen. Batas maksimum hanya untuk jenis persen. Null di Kuota voucher, Batas per
// email, dan batas maksimum berarti tanpa batas; null di minimal Harga jual, mulai, dan berakhir berarti
// syarat itu tidak diisi. Aturan isiannya diperiksa periksaIsianVoucher di domain. Kolom cakupan menyimpan
// jenis Cakupan voucher; daftar Produk atau Kategori-nya ada di voucher_produk atau voucher_kategori. Voucher
// yang dibuat sebelum cakupan disimpan (T53) berlaku untuk semua Produk. Waktu dibuat menentukan urutan
// daftar Voucher.
export const voucher = pgTable(
  "voucher",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kode: text("kode").notNull(),
    jenisPotongan: jenisPotongan("jenis_potongan").notNull(),
    nilai: integer("nilai").notNull(),
    batasMaksimum: integer("batas_maksimum"),
    kuotaVoucher: integer("kuota_voucher"),
    batasPerEmail: integer("batas_per_email"),
    minimalHargaJual: integer("minimal_harga_jual"),
    mulai: instan("mulai"),
    berakhir: instan("berakhir"),
    cakupan: jenisCakupan("cakupan").default("semua").notNull(),
    khususMember: boolean("khusus_member").default(false).notNull(),
    aktif: boolean("aktif").default(true).notNull(),
    dibuatPada: instan("dibuat_pada").defaultNow().notNull(),
  },
  (tabel) => [
    uniqueIndex("voucher_kode_unik").on(sql`upper(btrim(${tabel.kode}))`),
  ],
);

// Produk dalam Cakupan voucher berjenis produk (PRD §8.4). Produk yang dihapus ikut hilang dari cakupan
// (T54), jadi rujukannya cascade.
export const voucherProduk = pgTable(
  "voucher_produk",
  {
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    produkId: uuid("produk_id")
      .notNull()
      .references(() => produk.id, { onDelete: "cascade" }),
  },
  (tabel) => [
    primaryKey({ columns: [tabel.voucherId, tabel.produkId] }),
    index("voucher_produk_produk_id_idx").on(tabel.produkId),
  ],
);

// Kategori dalam Cakupan voucher berjenis kategori (PRD §8.4). Kategori yang dihapus ikut hilang dari
// cakupan (T54), jadi rujukannya cascade.
export const voucherKategori = pgTable(
  "voucher_kategori",
  {
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategori.id, { onDelete: "cascade" }),
  },
  (tabel) => [
    primaryKey({ columns: [tabel.voucherId, tabel.kategoriId] }),
    index("voucher_kategori_kategori_id_idx").on(tabel.kategoriId),
  ],
);

// Biaya operasional (PRD §14.4): biaya toko di luar Harga modal dan Biaya transaksi yang dicatat Admin per tanggal.
// Tanggal adalah tanggal kalender dalam zona waktu toko (PRD §9.1), bukan instan, jadi disimpan sebagai date.
// Keterangan disimpan tanpa spasi di tepi. Aturan isiannya diperiksa periksaIsianBiayaOperasional di domain.
// Nominal tidak dibatasi maksimum, jadi bigint. Waktu dicatat hanya menentukan urutan biaya bertanggal sama di
// daftar, dengan yang terakhir dicatat di atas.
export const biayaOperasional = pgTable(
  "biaya_operasional",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: date("tanggal", { mode: "string" }).notNull(),
    keterangan: text("keterangan").notNull(),
    nominal: bigint("nominal", { mode: "number" }).notNull(),
    dicatatPada: instan("dicatat_pada").defaultNow().notNull(),
  },
  (tabel) => [
    index("biaya_operasional_tanggal_idx").on(tabel.tanggal),
    check("biaya_operasional_nominal_minimal", sql`${tabel.nominal} >= 1`),
  ],
);

// Jenis baris Riwayat saldo (PRD §15.2, GLOSSARY).
export const jenisRiwayatSaldo = pgEnum(
  "jenis_riwayat_saldo",
  JENIS_RIWAYAT_SALDO,
);

// Riwayat saldo (PRD §15.2): satu baris untuk setiap perubahan saldo seorang Member, ditulis dalam transaksi yang
// sama dengan perubahan saldonya. Nominal bertanda: positif menambah dan negatif mengurangi saldo. Saldo sesudah
// adalah saldo Member tepat setelah perubahan itu. Rujukan berisi Nomor Top up, Nomor Pesanan, atau keterangan
// Admin. Id-nya bertambah menurut urutan penulisan; karena perubahan saldo seorang Member ditulis satu per satu
// (baris user-nya dikunci), urutan id sama dengan urutan perubahan saldonya, dan menentukan urutan tampil.
export const riwayatSaldo = pgTable(
  "riwayat_saldo",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    waktu: instan("waktu").defaultNow().notNull(),
    jenis: jenisRiwayatSaldo("jenis").notNull(),
    nominal: bigint("nominal", { mode: "number" }).notNull(),
    saldoSesudah: bigint("saldo_sesudah", { mode: "number" }).notNull(),
    rujukan: text("rujukan").notNull(),
  },
  (tabel) => [
    index("riwayat_saldo_user_id_idx").on(tabel.userId, tabel.id),
    check("riwayat_saldo_nominal_bukan_nol", sql`${tabel.nominal} <> 0`),
    check(
      "riwayat_saldo_saldo_sesudah_tidak_negatif",
      sql`${tabel.saldoSesudah} >= 0`,
    ),
  ],
);
