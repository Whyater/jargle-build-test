import { expect, test } from '@playwright/test';
import { PHONE, loadBundle, openFresh, pageToday, waitForReady } from './helpers';
import type { Bundle, BundleItem } from './helpers';

test.use({ viewport: PHONE });

type PageLike = Parameters<typeof loadBundle>[0];

async function todaysEntry(page: PageLike): Promise<{ id: string; item: BundleItem }> {
  const bundle = await loadBundle(page);
  const today = await pageToday(page);
  const day = bundle.schedule.days.find((entry) => entry.date === today);
  if (!day) throw new Error('No word is scheduled for ' + today);
  const item = bundle.items[day.term];
  if (!item) throw new Error('No item for ' + day.term);
  return { id: day.term, item };
}

function answerOf(item: BundleItem): string {
  return (item.puzzle || item.term.replace(/[^A-Za-z]/g, '')).toUpperCase();
}

async function openJargle(page: PageLike): Promise<void> {
  await openFresh(page);
  await page.getByRole('region', { name: 'Word of the Day' }).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page).toHaveURL(/#\/jargle$/);
  await expect(page.getByRole('heading', { name: 'Daily Jargle', level: 1 })).toBeVisible();
}

async function pressWord(page: PageLike, word: string): Promise<void> {
  const keyboard = page.getByRole('group', { name: 'Keyboard' });
  for (const letter of word) {
    await keyboard.getByRole('button', { name: new RegExp('^' + letter + '(,|$)') }).click();
  }
  await keyboard.getByRole('button', { name: 'Enter', exact: true }).click();
}

function wrongWords(bundle: Bundle, answer: string, count: number): string[] {
  const fallback = ['HOUSE', 'LOGIN', 'WIFI', 'SPAM', 'FAKE', 'CLOUD', 'STREAM', 'CODE', 'DATA', 'BYTE', 'CHIP', 'LINK', 'COMPUTE', 'SYSTEMS', 'DISPLAY', 'PACKETS'];
  const words = (bundle.commonWords || []).concat(fallback);
  const result: string[] = [];
  for (const raw of words) {
    const word = raw.toUpperCase();
    if (word.length !== answer.length || word === answer || result.includes(word)) continue;
    result.push(word);
    if (result.length === count) return result;
  }
  throw new Error('Could not find ' + count + ' known words with length ' + answer.length);
}

test.describe('Daily Jargle full game', () => {
  test('wins and links to the word mini lesson', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openJargle(page);
    const { id, item } = await todaysEntry(page);

    await pressWord(page, answerOf(item));
    const result = page.locator('.jg-result');
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('First try! Wow.');
    await expect(result.getByText(item.term, { exact: true })).toBeVisible();
    await expect(result.getByText(item.meaning, { exact: true })).toBeVisible();
    await expect(result.getByRole('link', { name: 'Learn the lesson', exact: true })).toHaveAttribute('href', '#/lesson/' + encodeURIComponent('word:' + id));

    await result.getByRole('button', { name: 'Back to Play', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('region', { name: 'Word of the Day' })).toContainText('Got it in 1 of 6. Nice!');
    await page.reload();
    await waitForReady(page);
    await expect(page.getByRole('region', { name: 'Word of the Day' })).toContainText('Got it in 1 of 6. Nice!');
  });

  test('loses after six wrong known words and shows the answer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openJargle(page);
    const { item } = await todaysEntry(page);
    const answer = answerOf(item);
    const guesses = wrongWords(await loadBundle(page), answer, 6);

    for (const guess of guesses) await pressWord(page, guess);
    const result = page.locator('.jg-result');
    await expect(result.getByRole('heading', { level: 2 })).toHaveText("Good try! Here's today's word.");
    await expect(result.getByText(item.term, { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clues' })).toContainText('It was ');
  });
});
