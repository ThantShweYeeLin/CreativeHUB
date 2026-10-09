import { test, expect } from '@playwright/test';

test('search by initial returns profiles', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('input[placeholder*="Search by name"]');
  await expect(search).toBeVisible();

  // Type a single initial (case-insensitive)
  await search.fill('m');

  // Wait for debounce + network
  await page.waitForTimeout(800);

  // Freelancer names render as the bold caption on each result card, not as
  // a heading element.
  const cards = page.locator('.explore-card-perspective p.text-lg.font-bold');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const first = (await cards.nth(0).textContent()) || '';
  expect(first.toLowerCase()).toContain('m');
});
