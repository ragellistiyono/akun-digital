// Persen hemat dari Harga normal (PRD §3.5).

type HasilPersenHemat =
  | {
      tampil: true;
      persenHemat: number;
      hargaNormal: number;
      hargaJual: number;
    }
  | { tampil: false; persenHemat: null; hargaNormal: null; hargaJual: number };

/**
 * Persen hemat sebuah Varian, yang tampil sebagai label "Hemat N%": N = (Harga normal − Harga jual) ÷
 * Harga normal × 100, dibulatkan ke bawah ke bilangan bulat (PRD §3.5). Label ini hanya tampil bila
 * Harga normal diisi. Hasilnya membawa Harga normal dan Harga jual sebagai bahan hitungnya.
 */
export function persenHemat({
  hargaNormal,
  hargaJual,
}: {
  hargaNormal: number | null;
  hargaJual: number;
}): HasilPersenHemat {
  if (hargaNormal === null) {
    return { tampil: false, persenHemat: null, hargaNormal: null, hargaJual };
  }
  // Kali 100 lebih dulu supaya pembagiannya tidak membawa galat pecahan sebelum dibulatkan ke bawah.
  const persen = Math.floor(((hargaNormal - hargaJual) * 100) / hargaNormal);
  return { tampil: true, persenHemat: persen, hargaNormal, hargaJual };
}
