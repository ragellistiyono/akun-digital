import { expect, test } from "@playwright/test";

test("halaman awal menampilkan nama produk", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "MIWE Digital Store" }),
  ).toBeVisible();
});
