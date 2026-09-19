// Deep links must be unreachable without a session. Mirrors the manual test:
// log in in one browser, copy the URL, open it in a second browser with no
// session -> it must show the sign-in page, never the page's data.
//
// Each test uses a fresh, empty browser context (Playwright's default), i.e.
// exactly "another browser where nobody is logged in".
//
// Set AUTH_TEST_EMAIL / AUTH_TEST_PASSWORD (any real account) to also cover
// the round trip (log in, land back on the deep link); skipped without them.

import { test, expect } from '@playwright/test';

const EMAIL = process.env.AUTH_TEST_EMAIL;
const PASSWORD = process.env.AUTH_TEST_PASSWORD;

const DEEP_LINKS = [
  '/explore',
  '/map',
  '/for-you',
  '/my-bookings',
  '/tickets',
  '/tickets/00000000-0000-0000-0000-000000000000',
  '/tickets/dispute/00000000-0000-0000-0000-000000000000',
  '/booking/00000000-0000-0000-0000-000000000000',
  '/freelancer-booking/00000000-0000-0000-0000-000000000000',
  '/profile/00000000-0000-0000-0000-000000000000',
  '/team/00000000-0000-0000-0000-000000000000',
  '/post/00000000-0000-0000-0000-000000000000',
  '/messages',
  '/admin',
  '/admin/disputes',
];

for (const link of DEEP_LINKS) {
  test(`logged-out visitor opening ${link} is sent to the sign-in page`, async ({ page }) => {
    await page.goto(link);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
}

test('public pages (terms, privacy) stay reachable while logged out', async ({ page }) => {
  await page.goto('/terms');
  await expect(page).toHaveURL(/\/terms$/);
});

test.describe('login returns to the deep link that was requested', () => {
  test.skip(!EMAIL || !PASSWORD, 'Requires AUTH_TEST_EMAIL/AUTH_TEST_PASSWORD.');

  test('sign in from a redirected deep link lands back on it', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page).toHaveURL(/\/login$/);
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/tickets$/, { timeout: 15000 });
  });
});
