import { expect, test } from '@playwright/test';
import { goToHash, loadBundle, openFresh, pageToday } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

async function answerToday(page: import('@playwright/test').Page): Promise<void> {
  const bundle = await loadBundle(page);
  const today = await pageToday(page);
  const day = bundle.schedule.days.find((entry) => entry.date === today);
  if (!day) throw new Error('No word is scheduled for ' + today);
  const item = bundle.items[day.term];
  const answer = (item.puzzle || item.term.replace(/[^A-Za-z]/g, '')).toUpperCase();
  const keyboard = page.getByRole('group', { name: 'Keyboard', exact: true });
  for (const letter of answer) {
    await keyboard.getByRole('button', { name: new RegExp('^' + letter + '(,|$)') }).click();
  }
  await keyboard.getByRole('button', { name: 'Enter', exact: true }).click();
  // The result card shows once the last row has flipped.
  await expect(page.locator('.jg-result')).toBeVisible();
}

test('desktop Play has side navigation and Your day, and Daily Jargle is done after a win', async ({ page }) => {
  await openFresh(page);
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Your day', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Word of the Day' }).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page).toHaveURL(/#\/jargle$/);
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeHidden();
  await answerToday(page);
  await goToHash(page, '#/');
  const rail = page.getByRole('complementary', { name: 'Your day', exact: true });
  await expect(rail.getByRole('link', { name: /^Daily Jargle\s*, done$/ })).toBeVisible();
});
