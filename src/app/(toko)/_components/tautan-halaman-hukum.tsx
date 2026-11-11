import Link from "next/link";

// Halaman Syarat & Ketentuan dan Kebijakan Privasi (PRD §9.8), ditautkan di footer toko dan tab Akun.
const HALAMAN_HUKUM = [
  { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
  { href: "/kebijakan-privasi", label: "Kebijakan Privasi" },
];

/** Deret tautan teks ungu bergaris bawah, seperti tautan hukum di prototipe DESIGN.md. */
export function TautanHalamanHukum() {
  return (
    <ul className="flex flex-wrap gap-4 text-sm font-bold text-aksi-teks">
      {HALAMAN_HUKUM.map(({ href, label }) => (
        <li key={href}>
          <Link
            href={href}
            className="underline decoration-[1.5px] underline-offset-4"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
