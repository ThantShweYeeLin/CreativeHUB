// UI half of scripts/premium-live-check.ts (run by that script, not standalone):
// it creates isolated test accounts + a test Group Request against the live
// Supabase project, then drives the real UI here. Env from the script:
//   PJ_PART=A (freelancer applies) | B (client accepts) | C (post-accept views)
//   PJ_PASSWORD, PJ_FREELANCER_EMAIL, PJ_CLIENT_EMAIL, PJ_OPP_TITLE, PJ_SHOTS
import { test, expect, type Page } from '@playwright/test';

const PART = process.env.PJ_PART;
const PASSWORD = process.env.PJ_PASSWORD!;
const FREELANCER = process.env.PJ_FREELANCER_EMAIL!;
const CLIENT = process.env.PJ_CLIENT_EMAIL!;
const TITLE = process.env.PJ_OPP_TITLE!;
const FREELANCER_NAME = process.env.PJ_FREELANCER_NAME!;
const SHOTS = process.env.PJ_SHOTS || 'test-results/premium-journey';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/explore|onboarding|freelancer-dashboard/, { timeout: 20000 });
}

test.skip(!PART || !PASSWORD, 'Run via scripts/premium-live-check.ts');

test('A: an active Premium freelancer sees their status, finds the request and applies', async ({ page }) => {
  test.skip(PART !== 'A');
  await login(page, FREELANCER);

  await page.goto('/freelancer-dashboard/premium');
  await expect(page.getByText('Premium is active')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-premium-active.png` });

  await page.goto('/freelancer-dashboard/opportunities');
  const oppCard = page.locator('div.rounded-2xl', { has: page.getByRole('heading', { name: TITLE, exact: true }) });
  await expect(oppCard).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/2-opportunities-list.png` });

  await oppCard.getByRole('button', { name: /View & apply/ }).click();
  await expect(page.getByText('Roles', { exact: true })).toBeVisible();
  await page.locator('input[type="number"]').fill('4800');
  await page.locator('textarea').fill('Live test application from the Premium journey check.');
  await page.screenshot({ path: `${SHOTS}/3-apply-form.png` });
  await page.getByRole('button', { name: 'Send application' }).click();

  await expect(page.getByText(/Application sent/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Under review')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/4-my-applications.png` });
});

test('B: the client reviews the application in My Requests and accepts it', async ({ page }) => {
  test.skip(PART !== 'B');
  await login(page, CLIENT);
  await page.goto('/requests');
  const card = page.locator('div', { hasText: TITLE }).filter({ hasText: FREELANCER_NAME }).filter({ has: page.getByRole('button', { name: /^Accept/ }) }).last();
  await expect(card).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/5-client-requests.png` });
  await card.getByRole('button', { name: /^Accept/ }).click();
  await expect(page.getByText('Accept Counter Offer?')).toBeVisible();
  await page.getByRole('button', { name: 'Accept & Continue' }).click();
  // Wait for the whole accept flow (booking creation + status update) to
  // finish: the dialog closes and the card shows the accepted state.
  await expect(page.getByText('Accept Counter Offer?')).toBeHidden({ timeout: 30000 });
  await expect(card.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.bg-red-50').first()).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/6-client-accepted.png` });
});

test('C: after the subscription expires the freelancer keeps the accepted application but cannot discover new ones', async ({ page }) => {
  test.skip(PART !== 'C');
  await login(page, FREELANCER);
  await page.goto('/freelancer-dashboard/premium');
  await expect(page.getByText('Premium has expired')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/7-premium-expired.png` });
  await page.goto('/freelancer-dashboard/opportunities');
  await expect(page.getByText('Your Premium has ended')).toBeVisible();
  await page.getByRole('button', { name: /My applications/ }).click();
  await expect(page.getByText(TITLE)).toBeVisible();
  await expect(page.getByText('Accepted')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/8-expired-still-accepted.png` });
});
