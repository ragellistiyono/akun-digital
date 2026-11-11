// Qrispy tiruan untuk pengembangan, test, dan e2e (ADR-0004): menerbitkan QRIS dengan Kode unik acak
// Rp 1–499, waktu kedaluwarsa 15 menit dari sekarang, dan gambar QR contoh yang tidak bisa dibayar dengan
// e-wallet. Pembayarannya dipicu lewat bayarQrisTiruan, lalu cek status QRIS itu menjawab `paid`. QRIS yang
// belum dibayar bisa dibatalkan, lalu cek statusnya menjawab `cancelled`; pembatalannya bisa diatur gagal
// lewat tolakPembatalanTiruan.
import { randomInt, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

import type { Qrispy } from "./qrispy";

const MASA_BERLAKU_MS = 15 * 60 * 1000;

// Gambar QR contoh: 29 × 29 modul berpola acak tetap dengan tiga penanda sudut seperti kode QR, ditambah
// tepi kosong 4 modul, masing-masing 6 × 6 piksel hitam atau putih.
const MODUL = 29;
const TEPI = 4;
const PIKSEL_PER_MODUL = 6;

/** Apakah modul (x, y) termasuk penanda sudut 7 × 7, dan berwarna hitam di penanda itu. */
function modulPenanda(x: number, y: number): boolean | null {
  for (const [kiri, atas] of [
    [0, 0],
    [MODUL - 7, 0],
    [0, MODUL - 7],
  ]) {
    const dx = x - kiri;
    const dy = y - atas;
    if (dx < -1 || dx > 7 || dy < -1 || dy > 7) continue;
    // Jarak cincin dari pusat penanda: 3 = cincin luar hitam, 2 = cincin putih, 0–1 = inti hitam.
    const cincin = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return cincin === 3 || cincin <= 1;
  }
  return null;
}

/** Potongan berkas PNG: panjang, jenis, isi, lalu CRC-32 dari jenis dan isi. */
function potonganPng(jenis: string, isi: Buffer) {
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(isi.length);
  const jenisDanIsi = Buffer.concat([Buffer.from(jenis, "ascii"), isi]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(jenisDanIsi));
  return Buffer.concat([panjang, jenisDanIsi, crc]);
}

/** Gambar QR contoh sebagai data URL PNG abu-abu 8 bit. */
function buatGambarQrContoh() {
  // Pola acak tetap (LCG), supaya gambar contohnya selalu sama.
  let benih = 7;
  const acak = () => (benih = (benih * 9301 + 49297) % 233280) / 233280;
  const hitam: boolean[][] = Array.from({ length: MODUL }, (_, y) =>
    Array.from(
      { length: MODUL },
      (_, x) => modulPenanda(x, y) ?? acak() > 0.52,
    ),
  );

  const sisi = (MODUL + 2 * TEPI) * PIKSEL_PER_MODUL;
  const baris = Array.from({ length: sisi }, (_, py) => {
    const isi = Buffer.alloc(1 + sisi, 0xff);
    isi[0] = 0; // Filter PNG: tanpa filter.
    const my = Math.floor(py / PIKSEL_PER_MODUL) - TEPI;
    for (let px = 0; px < sisi; px++) {
      const mx = Math.floor(px / PIKSEL_PER_MODUL) - TEPI;
      if (hitam[my]?.[mx]) isi[1 + px] = 0x00;
    }
    return isi;
  });

  const kepala = Buffer.alloc(13);
  kepala.writeUInt32BE(sisi, 0);
  kepala.writeUInt32BE(sisi, 4);
  kepala[8] = 8; // 8 bit per piksel
  kepala[9] = 0; // abu-abu
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potonganPng("IHDR", kepala),
    potonganPng("IDAT", deflateSync(Buffer.concat(baris))),
    potonganPng("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

let gambarQrContoh: string | undefined;

/** Pembayaran QRIS tiruan yang sudah dipicu: nominal yang dibayar dan waktu bayarnya. */
type PembayaranTiruan = { amount: number; paidAt: Date };

// Pembayaran yang sudah dipicu, QRIS yang sudah dibatalkan, dan QRIS yang pembatalannya diatur gagal,
// menurut qris_id. Disimpan di globalThis, karena Next.js bisa memuat modul ini lebih dari sekali dalam
// satu proses server (misalnya untuk route handler dan untuk halaman), padahal pemicu dan cek status harus
// melihat data yang sama. Data ini hilang saat server dimulai ulang.
const wadah = globalThis as typeof globalThis & {
  __pembayaranQrispyTiruan?: Map<string, PembayaranTiruan>;
  __qrisDibatalkanTiruan?: Set<string>;
  __pembatalanDitolakTiruan?: Set<string>;
};
const pembayaranTiruan = (wadah.__pembayaranQrispyTiruan ??= new Map());
const qrisDibatalkan = (wadah.__qrisDibatalkanTiruan ??= new Set());
const pembatalanDitolak = (wadah.__pembatalanDitolakTiruan ??= new Set());

/**
 * Pembeli tiruan membayar sebuah QRIS dengan nominal itu, yang boleh berbeda dari Total bayar. Sesudahnya
 * cek status QRIS itu menjawab `paid`. Waktu bayarnya bisa diganti untuk test.
 */
export function bayarQrisTiruan(
  { qrisId, amount }: { qrisId: string; amount: number },
  { sekarang = new Date() }: { sekarang?: Date } = {},
) {
  pembayaranTiruan.set(qrisId, { amount, paidAt: sekarang });
}

/**
 * Mengatur Qrispy tiruan supaya menolak setiap permintaan pembatalan QRIS itu, misalnya untuk menguji
 * pembatalan yang gagal (PRD §5.8, ADR-0004). Status QRIS-nya tidak berubah karena penolakan itu.
 */
export function tolakPembatalanTiruan(qrisId: string) {
  pembatalanDitolak.add(qrisId);
}

export const qrispyTiruan: Qrispy = {
  async buatQris({ amount }) {
    const uniqueId = randomInt(1, 500);
    gambarQrContoh ??= buatGambarQrContoh();
    return {
      qrisId: randomUUID(),
      amount: amount + uniqueId,
      requestedAmount: amount,
      uniqueId,
      expiredAt: new Date(Date.now() + MASA_BERLAKU_MS),
      gambarQr: gambarQrContoh,
    };
  },
  async batalkanQris(qrisId) {
    if (pembatalanDitolak.has(qrisId)) {
      throw new Error(
        `Qrispy tiruan diatur menolak pembatalan QRIS ${qrisId}, jadi QRIS itu tidak dibatalkan.`,
      );
    }
    if (pembayaranTiruan.has(qrisId)) {
      throw new Error(
        `Qrispy tiruan menolak pembatalan QRIS ${qrisId}, karena QRIS itu sudah dibayar.`,
      );
    }
    qrisDibatalkan.add(qrisId);
  },
  // QRIS yang pembayarannya belum dipicu dan belum dibatalkan, termasuk QRIS yang tidak dikenal, dijawab
  // pending.
  async cekStatusQris(qrisId) {
    const dibayar = pembayaranTiruan.get(qrisId);
    if (dibayar) return { paymentStatus: "paid", ...dibayar };
    if (qrisDibatalkan.has(qrisId)) return { paymentStatus: "cancelled" };
    return { paymentStatus: "pending" };
  },
};
