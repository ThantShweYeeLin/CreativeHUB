// Security coverage for the /admin/* route restructure
// (src/app/pages/admin/*, src/components/AdminRoute.tsx). Confirms the
// AdminRoute client-side gate actually redirects logged-out and non-admin
// sessions away from every admin route — including the newly added :id
// detail routes, which is exactly where route-level gaps tend to appear
// even when the parent page is correctly protected.
//
// Set these env vars before running (a client/freelancer test account and,
// separately, a real admin test account — never the platform's real admin
// login). Without them, the spec is skipped rather than failing the suite.
//
//   ADMIN_ACCESS_NON_ADMIN_EMAIL / _PASSWORD  - any ordinary client or freelancer account
//   ADMIN_ACCESS_ADMIN_EMAIL / _PASSWORD      - an account with users.role = 'admin'
//   ADMIN_ACCESS_SAMPLE_USER_ID               - any real user id, for the /admin/users/:id checks

import { test, expect, type Page } from '@playwright/test';

const NON_ADMIN_EMAIL = process.env.ADMIN_ACCESS_NON_ADMIN_EMAIL;
const NON_ADMIN_PASSWORD = process.env.ADMIN_ACCESS_NON_ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_ACCESS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_ACCESS_ADMIN_PASSWORD;
const SAMPLE_USER_ID = process.env.ADMIN_ACCESS_SAMPLE_USER_ID;

const ADMIN_PATHS = ['/admin', '/admin/users', '/admin/bookings', '/admin/disputes', '/admin/attendance', '/admin/reports', '/admin/audit-logs'];

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  const loginTrigger = page.locator('text=/log in|sign in/i').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click();
  }
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(1000);
}

test.describe('admin route access control', () => {
  test('logged out — every /admin/* path is unreachable (falls through to the unauthenticated catch-all)', async ({ page }) => {
    for (const path of ADMIN_PATHS) {
      await page.goto(path);
      // App.tsx only allow-lists /login, /reset-password, /signup while
      // unauthenticated — everything else (including /admin/*) falls
      // through its own catch-all to /signup, never actually reaching
      // AdminRoute's logic at all. Either way, the important property is
      // the same: no admin content renders.
      await expect(page).toHaveURL(/\/(login|signup)/);
    }
  });

  test.describe('authenticated non-admin', () => {
    test.skip(!NON_ADMIN_EMAIL || !NON_ADMIN_PASSWORD, 'Requires ADMIN_ACCESS_NON_ADMIN_EMAIL/_PASSWORD.');

    test('every /admin/* path, including :id detail routes, redirects to /explore', async ({ page }) => {
      await login(page, NON_ADMIN_EMAIL!, NON_ADMIN_PASSWORD!);
      for (const path of ADMIN_PATHS) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/explore/);
      }
      if (SAMPLE_USER_ID) {
        await page.goto(`/admin/users/${SAMPLE_USER_ID}`);
        await expect(page).toHaveURL(/\/explore/);
      }
    });
  });

  test.describe('authenticated admin', () => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Requires ADMIN_ACCESS_ADMIN_EMAIL/_PASSWORD pointing at a real admin account.');

    test('can reach every top-level admin page directly by URL', async ({ page }) => {
      await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
      for (const path of ADMIN_PATHS) {
        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
        // AdminLayout's sidebar/topbar always shows this badge, regardless
        // of which page's own title is rendered below it.
        await expect(page.getByText('Admin', { exact: true }).first()).toBeVisible();
      }
    });

    test('can deep-link into a user detail page on hard refresh', async ({ page }) => {
      test.skip(!SAMPLE_USER_ID, 'Requires ADMIN_ACCESS_SAMPLE_USER_ID.');
      await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
      await page.goto(`/admin/users/${SAMPLE_USER_ID}`);
      await page.reload();
      await expect(page.getByText('Change role')).toBeVisible({ timeout: 10000 });
    });
  });
});
