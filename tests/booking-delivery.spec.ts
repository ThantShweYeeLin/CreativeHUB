// UI-flow coverage for estimated result delivery
// (src/app/pages/bookingTracking/DeliveryCard.tsx). Depends on two
// pre-seeded, deposit-paid bookings between real client/freelancer test
// accounts — one used for the "has deliverables" path (set → update →
// in-progress → delivered), one for the "no deliverables" path. Without
// these env vars set, the spec is skipped rather than failing the suite.
//
//   BOOKING_DELIVERY_CLIENT_URL / FREELANCER_URL                  - deliverables booking
//   BOOKING_DELIVERY_NO_DELIVERABLES_CLIENT_URL / FREELANCER_URL  - no-deliverables booking
//   BOOKING_DELIVERY_CLIENT_EMAIL / _PASSWORD
//   BOOKING_DELIVERY_FREELANCER_EMAIL / _PASSWORD

import { test, expect, type Page } from '@playwright/test';

const CLIENT_URL = process.env.BOOKING_DELIVERY_CLIENT_URL;
const FREELANCER_URL = process.env.BOOKING_DELIVERY_FREELANCER_URL;
const NO_DELIVERABLES_CLIENT_URL = process.env.BOOKING_DELIVERY_NO_DELIVERABLES_CLIENT_URL;
const NO_DELIVERABLES_FREELANCER_URL = process.env.BOOKING_DELIVERY_NO_DELIVERABLES_FREELANCER_URL;
const CLIENT_EMAIL = process.env.BOOKING_DELIVERY_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.BOOKING_DELIVERY_CLIENT_PASSWORD;
const FREELANCER_EMAIL = process.env.BOOKING_DELIVERY_FREELANCER_EMAIL;
const FREELANCER_PASSWORD = process.env.BOOKING_DELIVERY_FREELANCER_PASSWORD;

const canRun = Boolean(CLIENT_URL && FREELANCER_URL && CLIENT_EMAIL && CLIENT_PASSWORD && FREELANCER_EMAIL && FREELANCER_PASSWORD);

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  const loginTrigger = page.locator('text=/log in|sign in/i').first();
  if (await loginTrigger.isVisible().catch(() => false)) await loginTrigger.click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(1000);
}

function isoDateInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe('booking result delivery', () => {
  test.skip(!canRun, 'Requires BOOKING_DELIVERY_* env vars pointing at seeded deposit-paid bookings.');

  test('full deliverables lifecycle: set, client visibility, update, in progress, delivered', async ({ browser }) => {
    const freelancerContext = await browser.newContext();
    const clientContext = await browser.newContext();
    const freelancerPage = await freelancerContext.newPage();
    const clientPage = await clientContext.newPage();

    await login(freelancerPage, FREELANCER_EMAIL!, FREELANCER_PASSWORD!);
    await freelancerPage.goto(FREELANCER_URL!);
    await expect(freelancerPage.getByText('Does this booking include deliverables')).toBeVisible({ timeout: 10000 });

    // Before any decision, the client sees nothing at all — no presumed delivery story.
    await login(clientPage, CLIENT_EMAIL!, CLIENT_PASSWORD!);
    await clientPage.goto(CLIENT_URL!);
    await expect(clientPage.getByText('Result Delivery')).not.toBeVisible();

    await freelancerPage.locator('button', { hasText: 'Yes, deliverables included' }).click();
    await freelancerPage.locator('input[type="date"]').fill(isoDateInDays(10));
    // The "Mark this booking complete" card (a separate, pre-existing
    // feature) legitimately has its own textarea visible at the same time
    // — scope to the delivery notes one specifically by placeholder.
    await freelancerPage.locator('textarea[placeholder^="Delivery notes"]').fill('Edited photos delivered via download link.');
    await freelancerPage.locator('button', { hasText: 'Save estimate' }).click();
    await expect(freelancerPage.getByText('Pending', { exact: true })).toBeVisible({ timeout: 10000 });

    await clientPage.reload();
    await expect(clientPage.getByText('Results pending')).toBeVisible({ timeout: 10000 });
    await expect(clientPage.getByText('Edited photos delivered via download link.')).toBeVisible();

    // Update the estimate with a reason — should not silently overwrite, just change the date and log why.
    await freelancerPage.locator('button', { hasText: 'Update estimate' }).click();
    await freelancerPage.locator('input[type="date"]').fill(isoDateInDays(14));
    await freelancerPage.locator('input[placeholder="Reason for the change (optional)"]').fill('Post-production delay.');
    await freelancerPage.locator('button', { hasText: 'Save' }).click();
    await expect(freelancerPage.getByText('Pending', { exact: true })).toBeVisible({ timeout: 10000 });

    await clientPage.reload();
    const expectedUpdatedLabel = new Date(isoDateInDays(14)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    await expect(clientPage.getByText(new RegExp(expectedUpdatedLabel.split(',')[0]))).toBeVisible({ timeout: 10000 });

    await freelancerPage.locator('button', { hasText: 'Mark in progress' }).click();
    await expect(freelancerPage.getByText('In progress')).toBeVisible({ timeout: 10000 });

    await clientPage.reload();
    await expect(clientPage.getByText('Results being prepared')).toBeVisible({ timeout: 10000 });

    await freelancerPage.locator('button', { hasText: 'Mark delivered' }).click();
    await expect(freelancerPage.getByText('Delivered').first()).toBeVisible({ timeout: 10000 });
    await expect(freelancerPage.locator('button', { hasText: 'Update estimate' })).not.toBeVisible();

    await clientPage.reload();
    await expect(clientPage.getByText('Results Delivered')).toBeVisible({ timeout: 10000 });

    await freelancerContext.close();
    await clientContext.close();
  });

  test('freelancer can decline deliverables entirely, and the client sees nothing', async ({ browser }) => {
    test.skip(!NO_DELIVERABLES_CLIENT_URL || !NO_DELIVERABLES_FREELANCER_URL, 'Requires a second seeded booking.');
    const freelancerPage = await browser.newPage();
    await login(freelancerPage, FREELANCER_EMAIL!, FREELANCER_PASSWORD!);
    await freelancerPage.goto(NO_DELIVERABLES_FREELANCER_URL!);
    await expect(freelancerPage.getByText('Does this booking include deliverables')).toBeVisible({ timeout: 10000 });
    await freelancerPage.locator('button', { hasText: 'No further items' }).click();
    await expect(freelancerPage.getByText('No deliverables after this booking.')).toBeVisible({ timeout: 10000 });

    const clientPage = await browser.newPage();
    await login(clientPage, CLIENT_EMAIL!, CLIENT_PASSWORD!);
    await clientPage.goto(NO_DELIVERABLES_CLIENT_URL!);
    await expect(clientPage.getByText('Result Delivery')).not.toBeVisible();
  });
});
