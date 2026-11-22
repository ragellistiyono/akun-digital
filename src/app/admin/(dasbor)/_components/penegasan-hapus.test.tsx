// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PanelHapus } from "./penegasan-hapus";

afterEach(cleanup);

const PENOLAKAN =
  "Voucher ini tidak bisa dihapus, karena sudah tercatat di 1 Pesanan.";

function pasang(hasil: { galat?: string }) {
  const aksi = vi.fn(async (_sebelumnya: unknown, formData: FormData) => {
    void formData;
    return hasil;
  });
  const pengguna = userEvent.setup();
  render(
    <PanelHapus
      judul="Hapus Voucher"
      keterangan="Voucher hanya bisa dihapus bila belum pernah tercatat di Pesanan."
      aksi={aksi}
      isian={{ id: "voucher-1" }}
      nama="Voucher HEMAT5"
      akibat="Voucher ini beserta syaratnya terhapus dan tidak bisa dikembalikan."
    />,
  );
  return { aksi, pengguna };
}

// PRD §8.8, §9.10; DESIGN.md Navigation ▶ Keputusan 2026-11-22.
describe("PanelHapus", () => {
  it("tombol panel membuka Modal penegasan dengan teks penegasan hapusnya, dan aksi baru berjalan setelah tombol Ya", async () => {
    const { aksi, pengguna } = pasang({});

    await pengguna.click(screen.getByRole("button", { name: "Hapus Voucher" }));

    const modal = screen.getByRole("alertdialog", { name: "Hapus Voucher?" });
    expect(modal.textContent).toContain(
      "Hapus Voucher HEMAT5? Voucher ini beserta syaratnya terhapus dan tidak bisa dikembalikan.",
    );
    expect(aksi).not.toHaveBeenCalled();

    await pengguna.click(
      screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" }),
    );

    await vi.waitFor(() => expect(aksi).toHaveBeenCalledTimes(1));
    expect(aksi.mock.calls[0]?.[1].get("id")).toBe("voucher-1");
  });

  it("bila server menolak, modal tertutup dan pesan penolakannya tampil di panel", async () => {
    const { pengguna } = pasang({ galat: PENOLAKAN });

    await pengguna.click(screen.getByRole("button", { name: "Hapus Voucher" }));
    await pengguna.click(
      screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" }),
    );

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(PENOLAKAN);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Hapus Voucher" }),
    );
  });
});
