// Monogram MDS bertulisan spidol Kalam (DESIGN.md Typography), dengan label bagian toko yang sedang dibuka.
// Monogram ini tegak, karena dasbor admin tidak memakai rotasi (DESIGN.md Navigation, Dasbor admin).
export function MerekAdmin() {
  return (
    <span className="flex items-baseline gap-2">
      <span className="inline-block font-spidol text-[30px] leading-none font-bold text-aksi">
        MDS
      </span>
      <span className="font-spidol text-[16px] leading-none text-pensil-redup">
        Dasbor admin
      </span>
    </span>
  );
}
