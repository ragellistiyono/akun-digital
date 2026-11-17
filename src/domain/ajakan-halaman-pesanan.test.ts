import { describe, expect, it } from "vitest";

import { STATUS_PESANAN } from "./status-pesanan";
import { ajakanHalamanPesanan } from "./ajakan-halaman-pesanan";

// PRD §7.1 ▶ Keputusan 2026-11-17: yang tampil di bawah Item stok Halaman Pesanan Selesai bergantung pada
// siapa yang membukanya. Email dibandingkan menurut §7.4, dengan contoh `Budi@Mail.com` sama dengan
// `budi@mail.com`. `semuaMember` memuat Member aktif maupun nonaktif; Pendaftar dan Admin bukan Member.
// Data Member sintetis.
describe("ajakanHalamanPesanan", () => {
  const budi = { email: "budi@mail.com" };

  it('tidak ada yang login dan email Pesanan belum milik Member: ajakan "Buat akun untuk menyimpan riwayat"', () => {
    expect(
      ajakanHalamanPesanan({
        status: "Selesai",
        emailPesanan: "andi@mail.com",
        emailMemberLogin: null,
        semuaMember: [budi],
      }),
    ).toBe("buat-akun");
  });

  it('tidak ada yang login dan email Pesanan Budi@Mail.com milik Member budi@mail.com: "Login untuk melihat riwayat"', () => {
    expect(
      ajakanHalamanPesanan({
        status: "Selesai",
        emailPesanan: " Budi@Mail.com ",
        emailMemberLogin: null,
        semuaMember: [budi],
      }),
    ).toBe("login");
  });

  it('Member yang login membuka Pesanan dengan emailnya sendiri, walau huruf besarnya berbeda: tautan "Lihat Riwayat Pesanan"', () => {
    expect(
      ajakanHalamanPesanan({
        status: "Selesai",
        emailPesanan: "Budi@Mail.com",
        emailMemberLogin: "budi@mail.com",
        semuaMember: [budi],
      }),
    ).toBe("lihat-riwayat");
  });

  it("Member yang login membuka Pesanan dengan email lain: tidak ada ajakan apa pun, termasuk bila email itu belum milik Member", () => {
    for (const emailPesanan of ["budi@mail.com", "andi@mail.com"]) {
      expect(
        ajakanHalamanPesanan({
          status: "Selesai",
          emailPesanan,
          emailMemberLogin: "sinta@mail.com",
          semuaMember: [budi, { email: "sinta@mail.com" }],
        }),
      ).toBe("tidak-ada");
    }
  });

  it("Pesanan dengan status selain Selesai tidak mendapat ajakan", () => {
    for (const status of STATUS_PESANAN.filter((s) => s !== "Selesai")) {
      expect(
        ajakanHalamanPesanan({
          status,
          emailPesanan: "andi@mail.com",
          emailMemberLogin: null,
          semuaMember: [],
        }),
      ).toBe("tidak-ada");
    }
  });
});
