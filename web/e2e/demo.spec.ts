import { expect, test } from '@playwright/test';
import { goToHash, openDemo, openTab, PHONE, setTextSize } from './helpers';

test.use({ viewport: PHONE });

test.describe('demos', () => {
  test('judge demo shows its history, streak, level, and earned badges', async ({ page }) => {
    await openDemo(page, 'judge');
    await expect(page.getByText('Demo: a made-up history with 8 days learned.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Your progress: level \d+, 3 day streak,/ })).toBeVisible();
    await openTab(page, 'Me');
    // The judge save has 8 days learned and 3 badges (first word, week one, first lesson).
    const stats = page.getByLabel('Your stats');
    await expect(stats.getByRole('listitem').filter({ hasText: 'days learned' })).toHaveText(/^\s*8\s*days learned\s*$/);
    await expect(stats.getByRole('listitem').filter({ hasText: 'badges' })).toHaveText(/^\s*3\s*badges\s*$/);
  });

  test('judge Restart demo restores the demo save', async ({ page }) => {
    await openDemo(page, 'judge');
    // Change something first, so a restart that does nothing would be caught. The demo starts at Normal.
    await setTextSize(page, 'Largest');
    await expect(page.locator('html')).toHaveClass(/(^|\s)ts-largest(\s|$)/);
    await page.getByRole('button', { name: 'Restart demo', exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)ts-largest(\s|$)/);
    await goToHash(page, '#/me');
    await expect(page.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await goToHash(page, '#/');
    await expect(page.getByText('Demo: a made-up history with 8 days learned.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Your progress: level \d+, 3 day streak,/ })).toBeVisible();
  });

  test('Leave demo goes to the real app', async ({ page }) => {
    // The real app is new here, so skip its first-run intro to land on Play.
    await page.addInitScript(() => {
      window.localStorage.setItem('jargle:introSeen', '1');
    });
    await openDemo(page, 'judge');
    await page.getByRole('link', { name: 'Leave demo', exact: true }).click();
    await expect(page.getByText('Demo: a made-up history with 8 days learned.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Play Endless', exact: true })).toBeVisible();
  });

  test('new player demo identifies itself', async ({ page }) => {
    await openDemo(page, 'new');
    await expect(page.getByText('Demo: a new player.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart demo', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leave demo', exact: true })).toBeVisible();
  });
});
