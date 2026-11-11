import { TautanHalamanHukum } from "./tautan-halaman-hukum";

// Footer toko dengan tautan halaman Syarat & Ketentuan dan Kebijakan Privasi (PRD §9.8). Padding bawah
// 112 px di ponsel menjaga footer tidak tertutup navigasi bawah (DESIGN.md Layout).
export function FooterToko() {
  return (
    <footer className="mx-auto max-w-[1120px] px-4 pb-28 lebar:pb-16">
      <nav aria-label="Halaman hukum" className="border-t border-garis pt-6">
        <TautanHalamanHukum />
      </nav>
    </footer>
  );
}
