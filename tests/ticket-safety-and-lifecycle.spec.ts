// UI-flow coverage for the ticket safety/workflow fix (Phases 1-3):
// private admin notes, booking-dispute routing guidance, and the
// resolved/closed lifecycle rules. Like attendance-verification.spec.ts,
// this needs real accounts and a real ticket, seeded ahead of time — there's
// no signup-through-ticket-creation UI seed flow for Playwright here. Set
// the env vars below before running; specs are skipped (not failed) without
// them.
//
//   TICKET_TEST_EMAIL / TICKET_TEST_PASSWORD   - a non-admin user who owns
//                                                 at least one open ticket
//                                                 and at least one CLOSED
//                                                 ticket (create one of each
//                                                 via My Tickets first, then
//                                                 have an admin close one)
//   TICKET_TEST_OPEN_ID                         - that user's open ticket id
//   TICKET_TEST_CLOSED_ID                       - that user's closed ticket id
//   TICKET_TEST_RESOLVED_ID                     - a ticket of theirs an
//                                                 admin has marked resolved
//   TICKET_ADMIN_EMAIL / TICKET_ADMIN_PASSWORD  - an admin account
//   TICKET_TEST_BOOKING_ID                      - any booking TICKET_TEST_EMAIL
//                                                 is a participant on, for the
//                                                 routing-guidance check

import { test, expect, type Page } from '@playwright/test';

const USER_EMAIL = process.env.TICKET_TEST_EMAIL;
const USER_PASSWORD = process.env.TICKET_TEST_PASSWORD;
const OPEN_TICKET_ID = process.env.TICKET_TEST_OPEN_ID;
const CLOSED_TICKET_ID = process.env.TICKET_TEST_CLOSED_ID;
const RESOLVED_TICKET_ID = process.env.TICKET_TEST_RESOLVED_ID;
const ADMIN_EMAIL = process.env.TICKET_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TICKET_ADMIN_PASSWORD;
const BOOKING_ID = process.env.TICKET_TEST_BOOKING_ID;

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  const loginTrigger = page.locator('text=/log in/i').first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click();
  }
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(1000);
}

test.describe('ticket creation routing guidance', () => {
  const canRun = Boolean(USER_EMAIL && USER_PASSWORD && BOOKING_ID);
  test.skip(!canRun, 'Requires TICKET_TEST_EMAIL/PASSWORD and TICKET_TEST_BOOKING_ID.');

  test('selecting the booking category shows routing guidance, not a block', async ({ page }) => {
    await login(page, USER_EMAIL!, USER_PASSWORD!);
    await page.goto('/tickets');
    await page.locator('button', { hasText: 'Create a Ticket' }).click();

    await page.locator('select').selectOption('booking');
    await expect(page.locator('text=/Reporting a no-show/i')).toBeVisible();

    // Guidance only — the form must still be submittable for a real
    // booking-related ticket (e.g. a payment failure), not just disputes.
    await page.locator('input[placeholder="Paste the booking\'s ID here"]').fill(BOOKING_ID!);
    await page.locator('textarea').fill('My deposit payment failed with a gateway error.');
    await expect(page.locator('button', { hasText: 'Submit' })).toBeEnabled();

    // The link preserves the booking id the user already typed.
    const linkButton = page.locator('button', { hasText: "Go to that booking's tracking page" });
    await expect(linkButton).toBeVisible();
  });
});

test.describe('ticket lifecycle — closed vs resolved', () => {
  const canRun = Boolean(USER_EMAIL && USER_PASSWORD && CLOSED_TICKET_ID);
  test.skip(!canRun, 'Requires TICKET_TEST_EMAIL/PASSWORD and TICKET_TEST_CLOSED_ID (a closed ticket owned by that user).');

  test('a closed ticket shows a read-only notice instead of a reply composer', async ({ page }) => {
    await login(page, USER_EMAIL!, USER_PASSWORD!);
    await page.goto(`/tickets/${CLOSED_TICKET_ID}`);

    await expect(page.locator('text=/this ticket is closed/i')).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);
  });
});

test.describe('ticket lifecycle — resolved ticket reopens on reply', () => {
  const canRun = Boolean(USER_EMAIL && USER_PASSWORD && RESOLVED_TICKET_ID);
  test.skip(!canRun, 'Requires TICKET_TEST_EMAIL/PASSWORD and TICKET_TEST_RESOLVED_ID (a resolved ticket owned by that user).');

  test('replying to a resolved ticket reopens it', async ({ page }) => {
    await login(page, USER_EMAIL!, USER_PASSWORD!);
    await page.goto(`/tickets/${RESOLVED_TICKET_ID}`);

    await expect(page.locator('text=Resolved')).toBeVisible();

    const reply = page.locator('textarea').last();
    await reply.fill('This is still happening, please take another look.');
    await page.locator('button svg.lucide-send').locator('..').click();

    // Status badge updates to reflect the reopened ticket, and the
    // timeline shows the reopened event.
    await expect(page.locator('text=In progress')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/reopened/i')).toBeVisible();
  });
});

test.describe('private admin notes', () => {
  const canRunUser = Boolean(USER_EMAIL && USER_PASSWORD && OPEN_TICKET_ID);
  const canRunAdmin = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && OPEN_TICKET_ID);

  test.skip(!canRunUser, 'Requires TICKET_TEST_EMAIL/PASSWORD and TICKET_TEST_OPEN_ID.');
  test('a ticket owner never sees an "Internal Notes" section', async ({ page }) => {
    await login(page, USER_EMAIL!, USER_PASSWORD!);
    await page.goto(`/tickets/${OPEN_TICKET_ID}`);
    await expect(page.locator('text=/internal notes/i')).toHaveCount(0);
  });

  test.skip(!canRunAdmin, 'Requires TICKET_ADMIN_EMAIL/PASSWORD and TICKET_TEST_OPEN_ID.');
  test('an admin can add and see a private note', async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto(`/admin/tickets/${OPEN_TICKET_ID}`);

    await expect(page.locator('text=Internal Notes (admins only)')).toBeVisible();

    const noteText = `E2E private note ${Date.now()}`;
    await page.locator('textarea[placeholder*="private note"]').fill(noteText);
    await page.locator('button', { hasText: 'Add private note' }).click();

    await expect(page.locator(`text=${noteText}`)).toBeVisible({ timeout: 10000 });
  });
});
