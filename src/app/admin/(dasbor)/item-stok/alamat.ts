/** Alamat menu Item stok di dasbor admin (PRD §4.2 ▶ Keputusan 2026-11-20). */
export const ALAMAT_ITEM_STOK = "/admin/item-stok";

/** Alamat menu Item stok dengan Varian itu terpilih. */
export const alamatVarianTerpilih = (varianId: string) =>
  `${ALAMAT_ITEM_STOK}?${new URLSearchParams({ varian: varianId })}`;
