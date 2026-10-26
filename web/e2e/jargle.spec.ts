import { expect, test } from '@playwright/test';
import { PHONE, expectNoHorizontalScroll, loadBundle, openFresh, pageToday, waitForReady } from './helpers';
import type { Bundle, BundleItem } from './helpers';

test.use({ viewport: PHONE });

async function todaysItem(page: Parameters<typeof loadBundle>[0]): Promise<BundleItem> {
  const bundle = await loadBundle(page);
  const today = await pageToday(page);
  const day = bundle.schedule.days.find((entry) => entry.date === today);
  if (!day) throw new Error('No word is scheduled for ' + today);
  return bundle.items[day.term];
}

function answerOf(item: BundleItem): string {
  return (item.puzzle || item.term.replace(/[^A-Za-z]/g, '')).toUpperCase();
}

async function pressWord(page: Parameters<typeof loadBundle>[0], word: string): Promise<void> {
  const keyboard = page.getByRole('group', { name: 'Keyboard' });
  for (const letter of word) {
    // A key is named by its letter, then its color once used ("N, not in the word"), so Enter never matches.
    await keyboard.getByRole('button', { name: new RegExp('^' + letter + '(,|$)') }).click();
  }
  await keyboard.getByRole('button', { name: 'Enter', exact: true }).click();
}

async function openJargle(page: Parameters<typeof loadBundle>[0]): Promise<void> {
  await openFresh(page);
  await page.getByRole('region', { name: 'Word of the Day' }).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page).toHaveURL(/#\/jargle$/);
  await expect(page.getByRole('heading', { name: 'Daily Jargle', level: 1 })).toBeVisible();
}

function wrongKnownWord(bundle: Bundle, answer: string): string {
  const candidates = (bundle.commonWords || []).concat([
    'HOUSE',
    'LOGIN',
    'WIFI',
    'SPAM',
    'FAKE',
    'CLOUD',
    'STREAM',
    'CODE',
    'DATA',
    'BYTE',
    'CHIP',
    'LINK',
    'COMPUTE',
    'SYSTEMS',
    'DISPLAY',
    'PACKETS',
  ]);
  const found = candidates.find((word) => word.length === answer.length && word.toUpperCase() !== answer);
  if (!found) throw new Error('No known word with length ' + answer.length);
  return found.toUpperCase();
}

test.describe('Daily Jargle', () => {
  test('a player can use a miss, a junk guess, and then win', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openJargle(page);
    const bundle = await loadBundle(page);
    const item = await todaysItem(page);
    const answer = answerOf(item);
    const wrong = wrongKnownWord(bundle, answer);
    const junk = 'Z'.repeat(answer.length);

    await pressWord(page, wrong);
    await expect(page.locator('.jg-clue .bubble > span[aria-hidden="true"]')).toContainText(item.clues[1]);

    await pressWord(page, junk);
    await expect(page.getByRole('main').getByRole('status')).toContainText('Not in the word list');
    // A rejected guess stays in the row, like Wordle, so clear it before the real answer.
    const deleteKey = page.getByRole('group', { name: 'Keyboard' }).getByRole('button', { name: 'Delete letter', exact: true });
    for (let i = 0; i < junk.length; i++) await deleteKey.click();

    await pressWord(page, answer);
    // The result card is mounted after the final row finishes flipping.
    await expect(page.locator('.jg-result')).toBeVisible();
    // The rejected junk guess never used a try, so the win is on the 2nd guess.
    await expect(page.getByRole('heading', { level: 2 })).toContainText('You got it in 2!');
    await expect(page.getByRole('heading', { name: 'Why it matters', level: 3 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Learn the lesson', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Play', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('region', { name: 'Word of the Day' })).toContainText('Got it in 2 of 6. Nice!');

    await page.reload();
    await waitForReady(page);
    await expect(page.getByRole('region', { name: 'Word of the Day' })).toContainText('Got it in 2 of 6. Nice!');
  });

  test('the board fits a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openJargle(page);
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole('group', { name: 'Keyboard' }).getByRole('button', { name: 'Enter', exact: true })).toBeVisible();
  });
});
