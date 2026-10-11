// Run by scripts/booking-deposit-omise-check.ts (needs its throwaway client +
// booking + the server actually running in real Omise test mode).
import { test, expect } from '@playwright/test';

const EMAIL = process.env.BD_EMAIL!;
const PASSWORD = process.env.BD_PASSWORD!;
const BOOKING_ID = process.env.BD_BOOKING_ID!;
const CARD_NUMBER = process.env.BD_CARD_NUMBER || '4242424242424242';
const SHOTS = process.env.BD_SHOTS || 'docs/booking-deposit-omise-screenshots';
test.skip(!EMAIL, 'Run via scripts/booking-deposit-omise-check.ts');

test('a real Omise test-mode charge pays a booking deposit end to end', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/explore|onboarding/, { timeout: 20000 });

  await page.goto(`/booking/${BOOKING_ID}`);
  await expect(page.getByText('Deposit Transfer Required')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/1-deposit-section.png`, fullPage: true });

  // This project is now in real 'omise' mode (OMISE_SECRET_KEY is set), so
  // the deposit section should show the fresh-card form, not the saved-
  // payment-method picker.
  await expect(page.getByText('Pay with card')).toBeVisible();
  const year = String((new Date().getFullYear() + 2) % 100);

  // Real Omise decline test card first (payment_rejected) - confirms a real
  // failure is surfaced to the user and leaves the booking untouched,
  // before the success attempt below.
  await page.getByPlaceholder('As shown on your card').fill('Playwright Tester');
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4111111111110014');
  await page.getByPlaceholder('MM/YY').fill(`12${year}`);
  await page.getByPlaceholder(/digits/).fill('123');
  await page.getByRole('button', { name: /Transfer .* Deposit Now/ }).click();
  await expect(page.getByText(/payment rejected/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Deposit Transfer Required')).toBeVisible();
  await expect(page.getByText('Not yet paid')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/2-declined.png`, fullPage: true });

  await page.getByPlaceholder('1234 1234 1234 1234').fill(CARD_NUMBER);
  await page.screenshot({ path: `${SHOTS}/3-card-filled.png`, fullPage: true });

  await page.getByRole('button', { name: /Transfer .* Deposit Now/ }).click();
  await expect(page.getByText(/Deposit Secured/)).toBeVisible({ timeout: 25000 });
  await page.screenshot({ path: `${SHOTS}/4-deposit-secured.png`, fullPage: true });
});
