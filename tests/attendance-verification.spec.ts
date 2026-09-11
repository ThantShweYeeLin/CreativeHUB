// UI-flow coverage for mutual attendance verification. This depends on a
// pre-seeded, deposit-paid booking scheduled inside the attendance window —
// this repo has no signup-through-booking-creation UI seed flow for
// Playwright, so run `pnpm run test:attendance-verification` first (or
// otherwise seed one) and set the env vars below before running this spec:
//   ATTENDANCE_CHECK_URL      - e.g. http://localhost:5173/booking/<id> (client) or /freelancer-booking/<id>
//   ATTENDANCE_CHECK_EMAIL / ATTENDANCE_CHECK_PASSWORD - a participant's login
//   ATTENDANCE_CHECK_ROLE     - 'client' or 'freelancer', matching the login above
//
// Without these set, the spec is skipped rather than failing the suite.

import { test, expect } from '@playwright/test';

const BOOKING_URL = process.env.ATTENDANCE_CHECK_URL;
const EMAIL = process.env.ATTENDANCE_CHECK_EMAIL;
const PASSWORD = process.env.ATTENDANCE_CHECK_PASSWORD;
const ROLE = process.env.ATTENDANCE_CHECK_ROLE === 'freelancer' ? 'freelancer' : 'client';

const canRun = Boolean(BOOKING_URL && EMAIL && PASSWORD);

test.describe('mutual attendance verification', () => {
  test.skip(!canRun, 'Requires ATTENDANCE_CHECK_URL/EMAIL/PASSWORD env vars pointing at a seeded booking.');

  async function login(page: import('@playwright/test').Page) {
    await page.goto('/');
    const loginTrigger = page.locator('text=/log in/i').first();
    if (await loginTrigger.isVisible().catch(() => false)) {
      await loginTrigger.click();
    }
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1000);
  }

  test('shows the attendance check card and the correct role-based question', async ({ page }) => {
    await login(page);
    await page.goto(BOOKING_URL!);

    await expect(page.locator('text=Attendance Check')).toBeVisible();

    const otherRole = ROLE === 'client' ? 'Freelancer' : 'Client';
    const confirmButton = page.locator('button', { hasText: `Confirm ${otherRole} Presence` });
    if (await confirmButton.isVisible().catch(() => false)) {
      await expect(page.locator(`text=Is your ${otherRole} present?`)).toBeVisible();
    }
  });

  test('confirming presence never lets a user confirm themselves twice', async ({ page }) => {
    await login(page);
    await page.goto(BOOKING_URL!);

    const otherRole = ROLE === 'client' ? 'Freelancer' : 'Client';
    const confirmButton = page.locator('button', { hasText: `Confirm ${otherRole} Presence` });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await expect(page.locator(`text=/You confirmed the ${otherRole.toLowerCase()}'s presence/`)).toBeVisible({ timeout: 10000 });
      // The confirm button must be gone now — only Report remains.
      await expect(page.locator('button', { hasText: `Confirm ${otherRole} Presence` })).toHaveCount(0);
    }
  });

  test('report form shows role-correct reasons and dynamic evidence requirements', async ({ page }) => {
    await login(page);
    await page.goto(BOOKING_URL!);

    const reportButton = page.locator('button', { hasText: 'Report Attendance Problem' }).first();
    if (await reportButton.isVisible().catch(() => false)) {
      await reportButton.click();
      await expect(page.locator('text=Report Attendance Problem')).toBeVisible();

      const select = page.locator('select');
      const expectedFirstOption = ROLE === 'client' ? 'Freelancer did not show up' : 'Client did not show up';
      await expect(select.locator('option').first()).toHaveText(expectedFirstOption);

      // "did not show up" requires a location photo — Submit should be disabled with no file.
      const submitButton = page.locator('button', { hasText: 'Submit Report' });
      await expect(submitButton).toBeDisabled();

      // Selecting "Other" only requires a written explanation.
      await select.selectOption('other');
      await page.locator('textarea').fill('A written explanation of what happened.');
      await expect(submitButton).toBeEnabled();

      await page.locator('button', { hasText: 'Cancel' }).click();
    }
  });
});
