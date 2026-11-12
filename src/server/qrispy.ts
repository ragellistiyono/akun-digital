// Satu adaptor untuk semua panggilan ke Qrispy (ADR-0004). QRISPY_MODE memilih implementasinya:
// - `sungguhan` memanggil API Qrispy di QRISPY_BASE_URL dengan QRISPY_API_TOKEN (qrispy-sungguhan.ts);
// - `tiruan` menerbitkan QRIS contoh tanpa uang sungguhan, untuk pengembangan, test, dan e2e
//   (qrispy-tiruan.ts).
import { qrispySungguhan } from "./qrispy-sungguhan";
import { bayarQrisTiruan, qrispyTiruan } from "./qrispy-tiruan";

/**
 * QRIS yang baru diterbitkan Qrispy, dengan arti field seperti respons Qrispy
 * (docs/referensi/qrispy-api.md bagian 3).
 */
export type QrisBaru = {
  qrisId: string;
  /** Nominal yang harus dibayar Pembeli: `requested_amount` ditambah Kode unik. */
  amount: number;
  /** Nominal yang dikirim toko. */
  requestedAmount: number;
  /** Kode unik. */
  uniqueId: number;
  expiredAt: Date;
  /** Gambar QR sebagai data URL PNG (`qris_image_base64`). */
  gambarQr: string;
};

/**
 * Status pembayaran sebuah QRIS (docs/referensi/qrispy-api.md bagian 4). Bila sudah dibayar, `amount`
 * adalah nominal diterima (ADR-0004) dan `paidAt` waktu bayarnya.
 */
export type StatusQris =
  | { paymentStatus: "paid"; amount: number; paidAt: Date }
  | { paymentStatus: "pending" | "expired" | "cancelled" };

/** Antarmuka adaptor Qrispy. Setiap kegagalan, termasuk Qrispy yang menolak atau tidak menjawab, dilempar. */
export type Qrispy = {
  /** Membuat QRIS baru. `paymentReference` berisi Nomor Pesanan. */
  buatQris(masukan: {
    amount: number;
    paymentReference: string;
  }): Promise<QrisBaru>;
  /** Membatalkan QRIS yang belum dibayar. */
  batalkanQris(qrisId: string): Promise<void>;
  /** Menanyakan status pembayaran sebuah QRIS. */
  cekStatusQris(qrisId: string): Promise<StatusQris>;
};

/** Isi variabel lingkungan itu tanpa spasi di tepinya, dibaca saat dipakai. */
const isiVariabel = (nama: string) => process.env[nama]?.trim() ?? "";

/** Nilai QRISPY_MODE, dibaca saat dipakai. */
const modeQrispy = () => isiVariabel("QRISPY_MODE");

/** Nama-nama variabel itu yang masih kosong, sebagai teks seperti "A, B, dan C", atau null bila terisi semua. */
function variabelKosong(nama: readonly string[]) {
  const kosong = nama.filter((n) => isiVariabel(n) === "");
  if (kosong.length === 0) return null;
  if (kosong.length === 1) return kosong[0];
  return `${kosong.slice(0, -1).join(", ")}${kosong.length > 2 ? "," : ""} dan ${kosong.at(-1)}`;
}

/**
 * Memastikan konfigurasi Qrispy lengkap saat aplikasi mulai (src/instrumentation.ts). Bila
 * QRISPY_MODE=sungguhan tetapi QRISPY_BASE_URL, QRISPY_API_TOKEN, atau QRISPY_WEBHOOK_SECRET belum diisi,
 * aplikasi ditolak berjalan dengan pesan yang menyebut variabelnya: tanpa itu QRIS tidak bisa dibuat dan
 * kabar pembayaran tidak bisa diperiksa. Qrispy tiruan tidak membutuhkannya. Isi variabelnya tidak pernah
 * ikut di pesan.
 */
export function periksaKonfigurasiQrispy() {
  if (modeQrispy() !== "sungguhan") return;
  const kosong = variabelKosong([
    "QRISPY_BASE_URL",
    "QRISPY_API_TOKEN",
    "QRISPY_WEBHOOK_SECRET",
  ]);
  if (kosong) {
    throw new Error(
      `QRISPY_MODE=sungguhan, tetapi ${kosong} belum diisi, jadi toko tidak dijalankan: tanpa itu QRIS tidak bisa dibuat dan kabar pembayaran Qrispy tidak bisa diperiksa. Isi ${kosong} di berkas .env server menurut .env.example, atau pakai QRISPY_MODE=tiruan untuk pengembangan, lalu jalankan ulang aplikasinya.`,
    );
  }
}

/**
 * Adaptor Qrispy menurut QRISPY_MODE. Dibaca saat dipakai, bukan saat modul dimuat, supaya `next build`
 * tidak membutuhkannya.
 */
export function qrispyAktif(): Qrispy {
  const mode = modeQrispy();
  if (mode === "tiruan") return qrispyTiruan;
  if (mode === "sungguhan") {
    const kosong = variabelKosong(["QRISPY_BASE_URL", "QRISPY_API_TOKEN"]);
    if (kosong) {
      throw new Error(
        `QRISPY_MODE=sungguhan, tetapi ${kosong} belum diisi, jadi Qrispy tidak bisa dipanggil. Isi ${kosong} di berkas .env server menurut .env.example, lalu jalankan ulang aplikasinya.`,
      );
    }
    return qrispySungguhan({
      alamatDasar: isiVariabel("QRISPY_BASE_URL"),
      token: isiVariabel("QRISPY_API_TOKEN"),
    });
  }
  throw new Error(
    `QRISPY_MODE bernilai "${mode}", padahal hanya "sungguhan" dan "tiruan" yang dikenal, jadi Qrispy tidak bisa dipanggil. Isi QRISPY_MODE=sungguhan di server, atau QRISPY_MODE=tiruan untuk pengembangan, di berkas .env, lalu jalankan ulang aplikasinya.`,
  );
}

/**
 * Pemicu pembayaran Qrispy tiruan (ADR-0004): Pembeli tiruan membayar QRIS itu dengan nominal yang
 * diatur, termasuk nominal kurang dari Total bayar. Hanya aktif bila QRISPY_MODE=tiruan; selain itu tidak
 * ada yang dicatat.
 */
export function picuPembayaranTiruan(pembayaran: {
  qrisId: string;
  amount: number;
}) {
  if (modeQrispy() !== "tiruan") return { hasil: "tidak-aktif" } as const;
  bayarQrisTiruan(pembayaran);
  return { hasil: "dibayar" } as const;
}
