import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Tombol kontak WhatsApp (PRD §9.8) yang membuka https://wa.me/<nomor> dari Pengaturan toko. Selama
 * nomor belum diisi, tombol tidak tampil. Gayanya tombol garis (DESIGN.md Buttons), dan labelnya
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
      className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-garis bg-permukaan px-6 text-base font-extrabold text-tinta hover:border-monogram"
    >
      <MessageCircle aria-hidden="true" className="size-6 shrink-0" />
      {children}
    </a>
  );
}
