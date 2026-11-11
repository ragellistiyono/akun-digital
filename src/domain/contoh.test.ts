import { describe, expect, it } from "vitest";

// Test contoh dari T00: memastikan Vitest menjalankan test di src/domain/.
// Hapus berkas ini begitu modul domain punya aturan pertama beserta test-nya.
describe("modul domain", () => {
  it("menjalankan test Vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
