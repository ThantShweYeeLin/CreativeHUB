// Run by scripts/premium-demo-e2e.ts (needs its throwaway freelancer + servers).
import { test, expect } from '@playwright/test';

const EMAIL = process.env.PD_EMAIL!;
const PASSWORD = process.env.PD_PASSWORD!;
const SHOTS = process.env.PD_SHOTS || 'docs/premium-demo-screenshots';
test.skip(!EMAIL, 'Run via scripts/premium-demo-e2e.ts');

const year = String((new Date().getFullYear() + 2) % 100);

test('demo checkout looks and behaves like a real one', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/explore|onboarding/, { timeout: 20000 });
  await page.goto('/freelancer-dashboard/premium');
  await expect(page.getByText('You are on the free plan')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-checkout.png`, fullPage: true });

  // validation
  await page.getByRole('button', { name: /^Pay ฿99/ }).click();
  await expect(page.getByText('Enter the name on your card.')).toBeVisible();
  await expect(page.getByText('Use MM/YY.')).toBeVisible();
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424241');
  await page.getByPlaceholder('As shown on your card').fill('Jane Doe');
  await page.getByPlaceholder('MM/YY').fill('1220');
  await page.getByPlaceholder('3 digits').fill('123');
  await page.getByRole('button', { name: /^Pay ฿99/ }).click();
  await expect(page.getByText('That card number doesn’t look right.')).toBeVisible();
  await expect(page.getByText('This card has expired.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/2-validation.png`, fullPage: true });

  // formatting + brand detection
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4000000000009995');
  await expect(page.getByPlaceholder('1234 1234 1234 1234')).toHaveValue('4000 0000 0000 9995');
  await page.getByPlaceholder('MM/YY').fill(`12${year}`);
  await expect(page.getByPlaceholder('MM/YY')).toHaveValue(`12/${year}`);

  // declined (insufficient funds) -> processing overlay, then a bank-style message
  await page.getByRole('button', { name: /^Pay ฿99/ }).click();
  await expect(page.getByText('Securing your payment…')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/3-processing.png` });
  await expect(page.getByText('Your card has insufficient funds.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('You are on the free plan')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/4-declined.png`, fullPage: true });

  // yearly with the success card
  await page.getByRole('button', { name: /Yearly/ }).click();
  await expect(page.getByText('Total today')).toBeVisible();
  await page.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242');
  await page.getByRole('button', { name: /^Pay ฿999/ }).click();
  await expect(page.getByText('Payment successful')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('฿999.00').first()).toBeVisible();
  await expect(page.getByText('Visa •••• 4242')).toBeVisible();
  await expect(page.getByText('Premium valid until')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/5-receipt.png` });
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText('Premium is active')).toBeVisible();
  await expect(page.getByText('Payment history')).toBeVisible();
  await page.getByRole('button', { name: 'Receipt' }).first().click();
  await expect(page.getByText('Payment successful')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.screenshot({ path: `${SHOTS}/6-active-history.png`, fullPage: true });
});
