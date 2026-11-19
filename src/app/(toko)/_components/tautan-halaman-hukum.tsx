import Link from "next/link";

// Halaman Syarat & Ketentuan dan Kebijakan Privasi (PRD §9.8), ditautkan di footer toko.
const HALAMAN_HUKUM = [
  { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
  { href: "/kebijakan-privasi", label: "Kebijakan Privasi" },
];

/**
 * Deret tautan teks pulpen biru bergaris bawah, rata tengah dan berjarak 32 px. Setiap tautan setinggi
 * 40 px supaya mudah disentuh (DESIGN.md "Target ukuran"). Saat hover, garis bawahnya menjadi gelombang
 * coretan merah.
 */
export function TautanHalamanHukum() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-8 text-[17px] text-pulpen">
      {HALAMAN_HUKUM.map(({ href, label }) => (
        <li key={href}>
          <Link
            href={href}
            className="inline-flex min-h-10 items-center underline decoration-2 underline-offset-4 hover:decoration-spidol hover:decoration-wavy"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
