// PRD §7.5: password minimal 8 karakter.
export const PANJANG_MINIMAL_PASSWORD = 8;

export function passwordCukupPanjang(password: string): boolean {
  return password.length >= PANJANG_MINIMAL_PASSWORD;
}
