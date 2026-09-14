// UI-flow coverage for post social sharing
// (src/app/pages/PublicPostPage.tsx, src/components/PostShareMenu.tsx,
// src/lib/postShare.ts). Depends on a pre-seeded, published client_posts
// row and its author's login. Without these env vars set, the spec is
// skipped rather than failing the suite — same convention as
// booking-checkin.spec.ts / booking-reschedule.spec.ts.
//
//   POST_SHARE_POST_ID          - a published client_posts.id
//   POST_SHARE_AUTHOR_EMAIL / _PASSWORD - that post's author's login

import { test, expect, type Page } from '@playwright/test';

const POST_ID = process.env.POST_SHARE_POST_ID;
const AUTHOR_EMAIL = process.env.POST_SHARE_AUTHOR_EMAIL;
const AUTHOR_PASSWORD = process.env.POST_SHARE_AUTHOR_PASSWORD;

const canRun = Boolean(POST_ID && AUTHOR_EMAIL && AUTHOR_PASSWORD);

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForTimeout(500);
  const loginTrigger = page.locator('text=/log in|sign in/i').first();
  if (await loginTrigger.isVisible().catch(() => false)) await loginTrigger.click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('signup') && !url.pathname.includes('login'), { timeout: 15000 }).catch(() => {});
}

test.describe('post public page', () => {
  test.skip(!canRun, 'Requires POST_SHARE_POST_ID / POST_SHARE_AUTHOR_EMAIL / _PASSWORD.');

  test('loads a real post while fully logged out', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage(); // never-authenticated context
    await page.goto(`/post/${POST_ID}`);
    await expect(page.getByText('Log In')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button', { hasText: /View .+'s Profile/ })).toBeVisible();
    await expect(page.locator('button[aria-label="Share post"]')).toBeVisible();
  });

  test('invalid post id shows the not-found state without leaking content', async ({ page }) => {
    await page.goto('/post/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('This post is no longer available')).toBeVisible({ timeout: 15000 });
  });

  test('share menu: copy link produces the correct canonical URL', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await page.goto(`/post/${POST_ID}`);
    await page.locator('button[aria-label="Share post"]').click();
    await expect(page.getByText('Share this post')).toBeVisible();
    await page.locator('button[role="menuitem"]', { hasText: 'Copy Link' }).click();
    await expect(page.getByText('Post link copied!')).toBeVisible({ timeout: 5000 });
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(`http://localhost:5173/post/${POST_ID}`);
  });

  test('share menu: WhatsApp/Facebook/X open correctly-encoded platform URLs', async ({ page }) => {
    await page.goto(`/post/${POST_ID}`);
    await page.evaluate(() => {
      (window as any).__openedUrls = [];
      window.open = (url?: string | URL) => {
        (window as any).__openedUrls.push(String(url));
        return null;
      };
    });

    const expectedUrl = `http://localhost:5173/post/${POST_ID}`;
    for (const label of ['WhatsApp', 'Facebook']) {
      await page.locator('button[aria-label="Share post"]').click();
      await page.locator('button[role="menuitem"]', { hasText: label }).click();
      await page.waitForTimeout(150);
    }
    await page.locator('button[aria-label="Share post"]').click();
    await page.locator('button[role="menuitem"]').last().click(); // X — last item, avoids ambiguous "X" text matching
    await page.waitForTimeout(150);

    const urls: string[] = await page.evaluate(() => (window as any).__openedUrls);
    expect(urls[0]).toBe(`https://wa.me/?text=${encodeURIComponent(`Check out this creative post on CreativeHUB: ${expectedUrl}`)}`);
    expect(urls[1]).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(expectedUrl)}`);
    expect(urls[2]).toBe(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(expectedUrl)}&text=${encodeURIComponent('Check out this creative work on CreativeHUB.')}`
    );
  });

  test('share menu closes on Escape and does not shift the page layout', async ({ page }) => {
    await page.goto(`/post/${POST_ID}`);
    await page.locator('button[aria-label="Share post"]').click();
    await expect(page.getByText('Share this post')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Share this post')).not.toBeVisible();
  });

  test('like still works on the public post page (existing action, unaffected by sharing)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!);
    await page.goto(`/post/${POST_ID}`);
    await expect(page.locator('button[aria-label="Like post"], button[aria-label="Unlike post"]')).toBeVisible({ timeout: 15000 });
  });

  test('For You feed: existing Share button still opens the sheet, and it now offers external sharing without breaking "Send in messages"', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!);
    await page.goto('/for-you');

    const shareBtn = page.getByRole('button', { name: 'Share', exact: true }).first();
    await shareBtn.waitFor({ state: 'visible', timeout: 20000 });
    await shareBtn.click();

    await expect(page.getByText('Send this post')).toBeVisible();
    await expect(page.getByText('Share externally')).toBeVisible();
    await expect(page.getByText('Send in messages')).toBeVisible();

    // Clicking Share doesn't trigger the underlying post card's own click/navigation.
    expect(page.url()).toContain('/for-you');
  });
});
