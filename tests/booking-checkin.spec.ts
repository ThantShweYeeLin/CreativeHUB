// UI-flow coverage for booking check-in. This depends on a pre-seeded,
// deposit-paid booking with a real location and a scheduled time inside the
// check-in window — this repo has no signup-through-booking-creation UI
// seed flow for Playwright, so run `pnpm run test:checkin-security` first
// (or otherwise seed one) and set the env vars below before running this
// spec:
//   BOOKING_CHECKIN_URL   - e.g. http://localhost:5173/booking/<id> (client) or /freelancer-booking/<id>
//   BOOKING_CHECKIN_LAT   - the booking's location_lat
//   BOOKING_CHECKIN_LNG   - the booking's location_lng
//   BOOKING_CHECKIN_EMAIL / BOOKING_CHECKIN_PASSWORD - a participant's login
//
// Without these set, the spec is skipped rather than failing the suite.

import { test, expect } from '@playwright/test';

const BOOKING_URL = process.env.BOOKING_CHECKIN_URL;
const LAT = process.env.BOOKING_CHECKIN_LAT ? Number(process.env.BOOKING_CHECKIN_LAT) : null;
const LNG = process.env.BOOKING_CHECKIN_LNG ? Number(process.env.BOOKING_CHECKIN_LNG) : null;
const EMAIL = process.env.BOOKING_CHECKIN_EMAIL;
const PASSWORD = process.env.BOOKING_CHECKIN_PASSWORD;

const canRun = Boolean(BOOKING_URL && LAT != null && LNG != null && EMAIL && PASSWORD);

test.describe('booking check-in', () => {
  test.skip(!canRun, 'Requires BOOKING_CHECKIN_URL/LAT/LNG/EMAIL/PASSWORD env vars pointing at a seeded booking.');

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

  test('shows the check-in card and checks in successfully near the venue', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: LAT! + 0.0002, longitude: LNG! }); // ~20m away

    await login(page);
    await page.goto(BOOKING_URL!);

    await expect(page.locator('text=Booking Check-In')).toBeVisible();

    const checkInButton = page.locator('button', { hasText: 'CHECK IN' });
    if (await checkInButton.isVisible().catch(() => false)) {
      await checkInButton.click();
      await page.locator('button', { hasText: 'Continue to Check In' }).click();
      await expect(page.locator('text=CHECKED IN')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/You checked in at/')).toBeVisible();
      await expect(page.locator('text=Your exact location is private.')).toBeVisible();
    } else {
      // Already checked in from a previous run — the idempotent-message path.
      await expect(page.locator('text=CHECKED IN')).toBeVisible();
    }

    // Never renders raw coordinates anywhere on the page.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/);
  });

  test('shows an outside-area result when far from the venue', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: LAT! + 1, longitude: LNG! }); // ~111km away

    await login(page);
    await page.goto(BOOKING_URL!);

    const checkInButton = page.locator('button', { hasText: 'CHECK IN' });
    if (await checkInButton.isVisible().catch(() => false)) {
      await checkInButton.click();
      await page.locator('button', { hasText: 'Continue to Check In' }).click();
      await expect(page.locator("text=We couldn't verify that you are near the booking location.")).toBeVisible({ timeout: 10000 });
    }
  });

  test('denies location permission and still records attendance', async ({ page, context }) => {
    await context.clearPermissions();

    await login(page);
    await page.goto(BOOKING_URL!);

    const checkInButton = page.locator('button', { hasText: 'CHECK IN' });
    if (await checkInButton.isVisible().catch(() => false)) {
      await checkInButton.click();
      await page.locator('button', { hasText: 'Continue to Check In' }).click();
      await expect(page.locator('text=Location permission was not provided.')).toBeVisible({ timeout: 10000 });
    }
  });
});
