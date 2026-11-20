import Link from "next/link";

// Halaman tidak ditemukan untuk Nomor Top up yang tidak dikenal atau milik Member lain (PRD §15.3). Pesannya tidak
// membedakan keduanya, supaya Top up Member lain tidak bisa ditebak. Pola Fokus (DESIGN.md "Tata letak halaman"):
// kolom 560 px di tengah, dengan tombol utama selebar kolom.
export default function TopUpTidakDitemukan() {
  return (
    <div className="tata-fokus mt-4">
      <h1>Top up tidak ditemukan</h1>
      <p className="mt-4 text-pensil-redup">
        Top up ini tidak ada di akun Anda. Periksa lagi alamatnya, atau kembali
        ke tab Akun.
      </p>
      <Link href="/akun" className="tombol mt-6 flex w-full">
        Buka tab Akun
      </Link>
    </div>
  );
}
