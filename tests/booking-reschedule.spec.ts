// UI-flow coverage for the propose/accept/decline reschedule handshake
// (src/app/pages/bookingTracking/RescheduleCard.tsx). Like booking-checkin.spec.ts,
// this depends on a pre-seeded 'pending' or 'confirmed' booking between a
// real client and freelancer test account — set the env vars below before
// running this spec. Without them, the spec is skipped rather than failing
// the suite.
//
//   BOOKING_RESCHEDULE_CLIENT_URL       - e.g. http://localhost:5173/booking/<id>
//   BOOKING_RESCHEDULE_FREELANCER_URL   - e.g. http://localhost:5173/freelancer-booking/<id>
//   BOOKING_RESCHEDULE_CLIENT_EMAIL / _PASSWORD
//   BOOKING_RESCHEDULE_FREELANCER_EMAIL / _PASSWORD

import { test, expect, type Page } from '@playwright/test';

const CLIENT_URL = process.env.BOOKING_RESCHEDULE_CLIENT_URL;
const FREELANCER_URL = process.env.BOOKING_RESCHEDULE_FREELANCER_URL;
const CLIENT_EMAIL = process.env.BOOKING_RESCHEDULE_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.BOOKING_RESCHEDULE_CLIENT_PASSWORD;
const FREELANCER_EMAIL = process.env.BOOKING_RESCHEDULE_FREELANCER_EMAIL;
const FREELANCER_PASSWORD = process.env.BOOKING_RESCHEDULE_FREELANCER_PASSWORD;

const canRun = Boolean(CLIENT_URL && FREELANCER_URL && CLIENT_EMAIL && CLIENT_PASSWORD && FREELANCER_EMAIL && FREELANCER_PASSWORD);

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

test.describe('booking reschedule handshake', () => {
  test.skip(!canRun, 'Requires BOOKING_RESCHEDULE_* env vars pointing at a seeded pending/confirmed booking.');

  test('freelancer proposes, client sees and accepts the new time', async ({ browser }) => {
    const freelancerContext = await browser.newContext();
    const clientContext = await browser.newContext();
    const freelancerPage = await freelancerContext.newPage();
    const clientPage = await clientContext.newPage();

    await login(freelancerPage, FREELANCER_EMAIL!, FREELANCER_PASSWORD!);
    await freelancerPage.goto(FREELANCER_URL!);
    await expect(freelancerPage.getByRole('heading', { name: 'Reschedule', exact: true })).toBeVisible();

    await freelancerPage.locator('button', { hasText: 'Propose a new time' }).click();

    const dateInput = freelancerPage.locator('input[type="date"]');
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const dateValue = inSevenDays.toISOString().slice(0, 10);
    await dateInput.fill(dateValue);

    const selects = freelancerPage.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });

    await freelancerPage.locator('textarea').fill('Playwright reschedule test — please move to this new slot.');
    await freelancerPage.locator('button', { hasText: 'Send proposal' }).click();

    await expect(freelancerPage.locator('text=/You proposed moving this to/')).toBeVisible({ timeout: 10000 });
    await expect(freelancerPage.locator('text=Waiting for the client to respond.')).toBeVisible();

    await login(clientPage, CLIENT_EMAIL!, CLIENT_PASSWORD!);
    await clientPage.goto(CLIENT_URL!);

    await expect(clientPage.locator('text=/The freelancer proposed moving this to/')).toBeVisible({ timeout: 10000 });
    await expect(clientPage.locator('text=Playwright reschedule test')).toBeVisible();

    await clientPage.locator('button', { hasText: 'Accept new time' }).click();

    // Proposal card clears on both sides once accepted — the move actually
    // happened via rescheduleBooking(), re-checked against the exclusion
    // constraint.
    await expect(clientPage.locator('text=Propose a new time')).toBeVisible({ timeout: 10000 });
    await freelancerPage.reload();
    await expect(freelancerPage.locator('text=Propose a new time')).toBeVisible({ timeout: 10000 });

    await freelancerContext.close();
    await clientContext.close();
  });

  test('client proposes, freelancer can decline', async ({ browser }) => {
    const freelancerContext = await browser.newContext();
    const clientContext = await browser.newContext();
    const freelancerPage = await freelancerContext.newPage();
    const clientPage = await clientContext.newPage();

    await login(clientPage, CLIENT_EMAIL!, CLIENT_PASSWORD!);
    await clientPage.goto(CLIENT_URL!);
    await expect(clientPage.getByRole('heading', { name: 'Reschedule', exact: true })).toBeVisible();

    const proposeButton = clientPage.locator('button', { hasText: 'Propose a new time' });
    if (await proposeButton.isVisible().catch(() => false)) {
      await proposeButton.click();
      const dateInput = clientPage.locator('input[type="date"]');
      const inFiveDays = new Date();
      inFiveDays.setDate(inFiveDays.getDate() + 5);
      await dateInput.fill(inFiveDays.toISOString().slice(0, 10));
      const selects = clientPage.locator('select');
      await selects.nth(0).selectOption({ index: 1 });
      await selects.nth(1).selectOption({ index: 1 });
      await clientPage.locator('button', { hasText: 'Send proposal' }).click();
      await expect(clientPage.locator('text=/You proposed moving this to/')).toBeVisible({ timeout: 10000 });
    }

    await login(freelancerPage, FREELANCER_EMAIL!, FREELANCER_PASSWORD!);
    await freelancerPage.goto(FREELANCER_URL!);

    await expect(freelancerPage.locator('text=/The client proposed moving this to/')).toBeVisible({ timeout: 10000 });
    await freelancerPage.locator('button', { hasText: 'Decline' }).click();

    await expect(freelancerPage.locator('text=Propose a new time')).toBeVisible({ timeout: 10000 });

    await freelancerContext.close();
    await clientContext.close();
  });
});
