import { PemandanganSenja } from "./_components/pemandangan-senja";

export default function HalamanAwal() {
  return (
    <>
      {/* Pita langit Beranda (DESIGN.md): senja keemasan di mode terang, senja akhir berbintang di mode gelap. */}
      <div className="relative h-[236px] overflow-hidden bg-langit lebar:h-80">
        <PemandanganSenja jenis="pita" t={{ terang: 0.16, gelap: 0.82 }} />
      </div>
      <main className="mx-auto max-w-[1120px] px-4 pt-2 pb-28 lebar:pb-16">
        <h1 className="mt-4">MIWE Digital Store</h1>
      </main>
    </>
  );
}
