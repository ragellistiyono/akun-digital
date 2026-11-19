import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Tombol kontak WhatsApp (PRD §9.8) yang membuka https://wa.me/<nomor> dari Pengaturan toko. Selama
 * nomor belum diisi, tombol tidak tampil. Gayanya tombol kedua (DESIGN.md Buttons), dan labelnya
 * ditentukan halaman yang memasangnya.
 */
export function TombolWhatsApp({
  nomor,
  children,
}: {
  nomor: string | null;
  children: ReactNode;
}) {
  if (!nomor) return null;

  return (
    <a
      href={`https://wa.me/${nomor}`}
      target="_blank"
      rel="noopener noreferrer"
      className="tombol tombol-kedua"
    >
      <MessageCircle
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-6 shrink-0"
      />
      {children}
    </a>
  );
}
