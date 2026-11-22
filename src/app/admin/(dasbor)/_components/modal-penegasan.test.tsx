// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalPenegasan } from "./modal-penegasan";

afterEach(cleanup);

const RINCIAN =
  "Hapus Voucher HEMAT5? Voucher ini beserta syaratnya terhapus dan tidak bisa dikembalikan.";

/**
 * Pemakai Modal penegasan seperti panel hapus di dasbor: tombol pemicu membuka modal, dan `jalankan` mewakili
 * Server Action-nya. Setelah aksi selesai, modal ditutup (PRD §9.10).
 */
function PanelUji({
  jalankan,
}: {
  jalankan: (formData: FormData) => Promise<void>;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const pemicu = useRef<HTMLButtonElement>(null);
  const [, aksi, sedangMemproses] = useActionState<null, FormData>(
    async (_sebelumnya, formData) => {
      await jalankan(formData);
      setTerbuka(false);
      return null;
    },
    null,
  );
  return (
    <>
      <button type="button" ref={pemicu} onClick={() => setTerbuka(true)}>
        Hapus Voucher
      </button>
      {terbuka && (
        <ModalPenegasan
          pemicu={pemicu}
          judul="Hapus Voucher?"
          rincian={RINCIAN}
          labelYa="Ya, hapus Voucher HEMAT5"
          labelProses="Menghapus…"
          aksi={aksi}
          isian={{ id: "voucher-1" }}
          sedangMemproses={sedangMemproses}
          onBatal={() => setTerbuka(false)}
        />
      )}
    </>
  );
}

/** Lapisan latar di belakang panel modal. Ia tidak punya peran ARIA, jadi dicari lewat atribut penandanya. */
function latar() {
  const elemen = document.querySelector<HTMLElement>("[data-latar-modal]");
  if (!elemen)
    throw new Error("Lapisan latar Modal penegasan tidak ditemukan.");
  return elemen;
}

function pasang() {
  const jalankan = vi.fn(async (formData: FormData) => {
    void formData;
  });
  const pengguna = userEvent.setup();
  render(<PanelUji jalankan={jalankan} />);
  const pemicu = screen.getByRole("button", { name: "Hapus Voucher" });
  return { jalankan, pengguna, pemicu };
}

describe("ModalPenegasan", () => {
  it("terbuka sebagai alertdialog modal berjudul pertanyaan dan berisi rincian akibatnya, dengan fokus di Batal", async () => {
    const { pengguna, pemicu } = pasang();

    await pengguna.click(pemicu);

    const modal = screen.getByRole("alertdialog", { name: "Hapus Voucher?" });
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(modal.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe(RINCIAN);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Batal" }),
    );
  });

  it.each([
    [
      "Batal",
      async (pengguna: ReturnType<typeof userEvent.setup>) =>
        pengguna.click(screen.getByRole("button", { name: "Batal" })),
    ],
    [
      "Esc",
      async (pengguna: ReturnType<typeof userEvent.setup>) =>
        pengguna.keyboard("{Escape}"),
    ],
    [
      "ketukan di latar",
      async (pengguna: ReturnType<typeof userEvent.setup>) =>
        pengguna.click(latar()),
    ],
  ])(
    "%s menutup modal tanpa menjalankan aksi, lalu fokus kembali ke tombol pemicu",
    async (_cara, tutup) => {
      const { jalankan, pengguna, pemicu } = pasang();
      await pengguna.click(pemicu);

      await tutup(pengguna);

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(jalankan).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(pemicu);
    },
  );

  it("ketukan di dalam panel tidak menutup modal", async () => {
    const { pengguna, pemicu } = pasang();
    await pengguna.click(pemicu);

    await pengguna.click(screen.getByText(RINCIAN));

    expect(screen.getByRole("alertdialog")).toBeDefined();
  });

  it("menekan latar tidak memindahkan fokus dari Batal", async () => {
    const { pengguna, pemicu } = pasang();
    await pengguna.click(pemicu);

    await pengguna.pointer({ keys: "[MouseLeft>]", target: latar() });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Batal" }),
    );
  });

  it('klik kedua dari klik ganda pada tombol pemicu, yang jatuh di latar, di rincian, di tombol "Ya, …", atau di Batal, diabaikan dan tidak memindahkan fokus', async () => {
    const { jalankan, pengguna, pemicu } = pasang();
    await pengguna.click(pemicu);

    // `fireEvent` bernilai false bila bawaan peramban, di sini pindah fokus, dicegah.
    expect(fireEvent.mouseDown(latar(), { detail: 2 })).toBe(false);
    expect(fireEvent.mouseDown(screen.getByText(RINCIAN), { detail: 2 })).toBe(
      false,
    );
    fireEvent.click(latar(), { detail: 2 });
    fireEvent.click(
      screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" }),
      { detail: 2 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Batal" }), {
      detail: 2,
    });

    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(jalankan).not.toHaveBeenCalled();
  });

  it("Tab dan Shift+Tab berputar di dalam modal", async () => {
    const { pengguna, pemicu } = pasang();
    await pengguna.click(pemicu);
    const ya = screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" });
    const batal = screen.getByRole("button", { name: "Batal" });

    await pengguna.tab();
    expect(document.activeElement).toBe(ya);
    await pengguna.tab();
    expect(document.activeElement).toBe(batal);
    await pengguna.tab({ shift: true });
    expect(document.activeElement).toBe(ya);
    await pengguna.tab({ shift: true });
    expect(document.activeElement).toBe(batal);
  });

  it("selama aksi diproses, kedua tombol nonaktif, tombol aksi menampilkan teks proses, dan Esc maupun ketukan di latar tidak menutup modal", async () => {
    let selesaikan = () => {};
    const jalankan = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          selesaikan = resolve;
        }),
    );
    const pengguna = userEvent.setup();
    render(<PanelUji jalankan={jalankan} />);
    await pengguna.click(screen.getByRole("button", { name: "Hapus Voucher" }));

    await pengguna.click(
      screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" }),
    );

    const modal = screen.getByRole("alertdialog");
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Menghapus…" })).toHaveProperty(
        "disabled",
        true,
      ),
    );
    expect(screen.getByRole("button", { name: "Batal" })).toHaveProperty(
      "disabled",
      true,
    );
    await pengguna.keyboard("{Escape}");
    await pengguna.click(latar());
    await pengguna.tab();
    expect(screen.getByRole("alertdialog")).toBe(modal);
    expect(modal.contains(document.activeElement)).toBe(true);
    expect(jalankan).toHaveBeenCalledTimes(1);

    selesaikan();
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });

  it('aksi baru berjalan setelah tombol "Ya, …" ditekan, dengan isiannya, lalu modal tertutup', async () => {
    const { jalankan, pengguna, pemicu } = pasang();
    await pengguna.click(pemicu);
    expect(jalankan).not.toHaveBeenCalled();

    await pengguna.click(
      screen.getByRole("button", { name: "Ya, hapus Voucher HEMAT5" }),
    );

    await vi.waitFor(() => expect(jalankan).toHaveBeenCalledTimes(1));
    expect(jalankan.mock.calls[0]?.[0].get("id")).toBe("voucher-1");
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });
});
