// Pembaca nominal dari Qrispy (ADR-0004). Uji API sungguhan (docs/referensi/qrispy-api.md bagian 9)
// menunjukkan bahwa Qrispy mengirim sebagian nominal sebagai angka dan sebagian sebagai teks desimal seperti
// "10281.00". Keduanya dibaca menjadi rupiah bulat, baik di jawaban API maupun di payload webhook.
import { z } from "zod";

/** Teks angka bulat yang boleh diikuti titik dan nol saja, misalnya "10281" atau "10281.00". */
const POLA_TEKS_NOMINAL = /^\d+(?:\.0+)?$/;

/**
 * Nominal dari Qrispy sebagai rupiah bulat. Diterima: angka bulat, atau teks berisi angka bulat yang boleh
 * diikuti titik dan nol saja, sehingga `10281`, `"10281"`, dan `"10281.00"` menjadi 10281. Selain itu,
 * misalnya `"10281.50"`, `"10.281"`, `10281.5`, atau `-1`, tidak sah, dan seluruh data yang memuatnya ditolak.
 * Nominal yang punya sen tidak dibulatkan, karena nominal QRIS rupiah selalu bulat (ADR-0004).
 */
export const NominalQrispy = z
  .union([z.number(), z.string()])
  .transform((nilai, ctx) => {
    const rupiah =
      typeof nilai === "number"
        ? nilai
        : POLA_TEKS_NOMINAL.test(nilai)
          ? Number(nilai)
          : Number.NaN;
    if (Number.isSafeInteger(rupiah) && rupiah >= 0) return rupiah;
    ctx.issues.push({
      code: "custom",
      input: nilai,
      message: `nominal ${JSON.stringify(nilai)} tidak sah: nominal Qrispy harus rupiah bulat, berupa angka bulat atau teks seperti "10281" atau "10281.00"`,
    });
    return z.NEVER;
  });
