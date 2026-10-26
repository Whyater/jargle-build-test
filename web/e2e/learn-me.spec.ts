import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PHONE, goToHash, loadBundle, openFresh, openTab, waitForReady } from './helpers';
import type { Bundle } from './helpers';

test.use({ viewport: PHONE });

// The parts of a lesson in content/bundle.json that the tests read.
interface Lesson {
  id: string;
  number: number;
  title: string;
  cards: { text: string }[];
  checks: { prompt: string; answer: string }[];
  takeaway: string;
}

const TYPO_MESSAGE = 'That code has a typo. Check each character and try again.';
const FORMAT_MESSAGE = "That doesn't look like a progress code. It starts with JRG1.";

function lessonList(bundle: Bundle): Lesson[] {
  return bundle.lessons as Lesson[];
}

function lessonById(bundle: Bundle, id: string): Lesson {
  for (const lesson of lessonList(bundle)) {
    if (lesson.id === id) return lesson;
  }
  throw new Error('No lesson called ' + id);
}

/** How the Learn path names a lesson stop, for example "1. Make a strong password". */
function lessonName(lesson: Lesson): string {
  return lesson.number + '. ' + lesson.title;
}

/** The message line on a screen (the toast area also has role status, so stay inside main). */
function announcer(page: Page): Locator {
  return page.getByRole('main').getByRole('status');
}

/**
 * From the Learn tab: opens the lesson marked "Up next", reads every card, answers every
 * question correctly, and ends back on the Learn tab. Returns the lesson that was finished.
 */
async function finishNextLesson(page: Page, bundle: Bundle): Promise<Lesson> {
  await page.getByRole('link', { name: /\. Up next$/ }).click();
  await expect(page).toHaveURL(/#\/lesson\//);
  const id = decodeURIComponent(new URL(page.url()).hash.replace('#/lesson/', ''));
  const lesson = lessonById(bundle, id);
  await expect(page.getByRole('heading', { name: lesson.title, level: 1 })).toBeVisible();

  for (let i = 0; i < lesson.cards.length; i += 1) {
    await expect(page.getByText(lesson.cards[i].text, { exact: true })).toBeVisible();
    const lastCard = i === lesson.cards.length - 1;
    await page.getByRole('button', { name: lastCard ? 'Start the questions' : 'Next', exact: true }).click();
  }

  for (let i = 0; i < lesson.checks.length; i += 1) {
    const check = lesson.checks[i];
    await expect(page.getByText(check.prompt, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: check.answer, exact: true }).click();
    await expect(page.getByText('Right.', { exact: true })).toBeVisible();
    const lastQuestion = i === lesson.checks.length - 1;
    await page.getByRole('button', { name: lastQuestion ? 'Finish' : 'Next question', exact: true }).click();
  }

  // The same words are also in a hidden status line for screen readers, so take the visible one.
  await expect(page.getByText('Lesson done.', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Back to Learn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
  return lesson;
}

/** Opens "Get a progress code" from the Me tab and reads the code off the screen. */
async function readProgressCode(page: Page): Promise<string> {
  await openTab(page, 'Me');
  await page.getByRole('link', { name: /^Get a progress code/ }).click();
  await expect(page.getByRole('heading', { name: 'Get a progress code', level: 1 })).toBeVisible();
  const text = (await page.locator('#progress-code').textContent()) || '';
  return text.replace(/\s/g, '');
}

/** Types a code into "Use a progress code" and taps the button. */
async function useCode(page: Page, code: string): Promise<void> {
  await page.getByLabel('Your progress code').fill(code);
  await page.getByRole('button', { name: 'Use this code', exact: true }).click();
}

test.describe('Learn tab', () => {
  test('shows the lesson path with the next lesson marked and later ones locked', async ({ page }) => {
    await openFresh(page);
    const bundle = await loadBundle(page);
    const lessons = lessonList(bundle);
    await openTab(page, 'Learn');

    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
    await expect(page.getByText('0 of ' + lessons.length + ' done', { exact: true })).toBeVisible();

    // One lesson is marked as the place to start.
    await expect(page.getByText('Start here', { exact: true })).toHaveCount(1);
    const upNext = page.getByRole('link', { name: /\. Up next$/ });
    await expect(upNext).toHaveCount(1);
    await expect(upNext).toBeVisible();

    // Every "lesson 2" waits for lesson 1 of its topic, so a new player sees them locked.
    let laterLessons = 0;
    for (const lesson of lessons) {
      if (lesson.number > 1) laterLessons += 1;
    }
    expect(laterLessons).toBeGreaterThan(0);
    const locked = page.getByRole('button', { name: /\. Locked\. / });
    await expect(locked).toHaveCount(laterLessons);

    // Tapping a locked lesson explains why and stays on Learn.
    await locked.first().click({ force: true });
    await expect(page.getByText('Finish the earlier lesson first.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/learn$/);
  });

  test('has the Review, Practice and Old Tech tiles', async ({ page }) => {
    await openFresh(page);
    await openTab(page, 'Learn');

    // The Review tile reads out how many words are due, which is none for a new player.
    await expect(page.getByRole('link', { name: 'Review: nothing due today.', exact: true })).toHaveAttribute('href', '#/review');
    await expect(page.getByRole('link', { name: 'Practice', exact: true })).toHaveAttribute('href', '#/practice');
    await expect(page.getByRole('link', { name: 'Old Tech', exact: true })).toHaveAttribute('href', '#/oldtech');

    await page.getByRole('link', { name: 'Practice', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Practice', level: 1 })).toBeVisible();
  });

  test('a lesson can be finished, earns XP, and shows as done on Learn', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const bundle = await loadBundle(page);
    const total = lessonList(bundle).length;
    await openTab(page, 'Learn');

    // Walk the first lesson to its finished state.
    await page.getByRole('link', { name: /\. Up next$/ }).click();
    await expect(page).toHaveURL(/#\/lesson\//);
    const lesson = lessonById(bundle, decodeURIComponent(new URL(page.url()).hash.replace('#/lesson/', '')));
    await expect(page.getByRole('heading', { name: lesson.title, level: 1 })).toBeVisible();
    await expect(page.getByText('Lesson ' + lesson.number, { exact: true })).toBeVisible();
    await expect(page.getByText('Card 1 of ' + lesson.cards.length, { exact: true })).toBeVisible();

    for (let i = 0; i < lesson.cards.length; i += 1) {
      await expect(page.getByText(lesson.cards[i].text, { exact: true })).toBeVisible();
      const lastCard = i === lesson.cards.length - 1;
      await page.getByRole('button', { name: lastCard ? 'Start the questions' : 'Next', exact: true }).click();
    }

    for (let i = 0; i < lesson.checks.length; i += 1) {
      const check = lesson.checks[i];
      await expect(page.getByText('Question ' + (i + 1) + ' of ' + lesson.checks.length, { exact: true })).toBeVisible();
      await expect(page.getByText(check.prompt, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: check.answer, exact: true }).click();
      await expect(page.getByText('Right.', { exact: true })).toBeVisible();
      const lastQuestion = i === lesson.checks.length - 1;
      await page.getByRole('button', { name: lastQuestion ? 'Finish' : 'Next question', exact: true }).click();
    }

    // Finished state: the cheer, 30 XP for a lesson, the takeaway and the way back.
    await expect(page.getByText('Lesson done.', { exact: true }).first()).toBeVisible();
    // The pill is the steady one. A floating copy next to it is hidden from screen readers and fades.
    await expect(page.locator('.win-xp .pill')).toHaveText(/^\s*\+30 XP\s*$/);
    await expect(page.getByText('Remember this', { exact: true })).toBeVisible();
    await expect(page.getByText(lesson.takeaway, { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Learn', exact: true }).click();

    // Back on Learn the lesson is done, and the count went up.
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
    await expect(page.getByRole('link', { name: lessonName(lesson) + '. Done', exact: true })).toBeVisible();
    await expect(page.getByText('1 of ' + total + ' done', { exact: true })).toBeVisible();
  });
});

test.describe('Me tab', () => {
  test('starts at level 1 and moves up after a lesson earns XP', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const bundle = await loadBundle(page);

    await openTab(page, 'Me');
    const level = page.getByRole('region', { name: 'Your level' });
    await expect(level.getByText('Level 1', { exact: true })).toBeVisible();
    await expect(level.getByText('30 XP to level 2', { exact: true })).toBeVisible();

    // The four stat tiles.
    const stats = page.getByLabel('Your stats');
    await expect(stats.getByRole('listitem')).toHaveCount(4);
    await expect(stats).toContainText('day streak');
    await expect(stats).toContainText('days learned');
    await expect(stats).toContainText('Endless best');
    await expect(stats).toContainText('badges');

    // A lesson is worth 30 XP, which is exactly level 2.
    await openTab(page, 'Learn');
    await finishNextLesson(page, bundle);
    await openTab(page, 'Me');
    await expect(level.getByText('Level 2', { exact: true })).toBeVisible();
    await expect(level.getByText('50 XP to level 3', { exact: true })).toBeVisible();
    await expect(level.getByText('Level 1', { exact: true })).toHaveCount(0);

    // Play shows the same level.
    await openTab(page, 'Play');
    await expect(page.getByRole('link', { name: /Your progress: level 2(?!\d)/ })).toBeVisible();
  });

  test('text size changes the page, survives a reload, and Normal puts it back', async ({ page }) => {
    await openFresh(page);
    await openTab(page, 'Me');
    const html = page.locator('html');
    const sizes = page.getByRole('group', { name: 'Text size' });
    async function rootFontSize(): Promise<number> {
      return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    }

    const normalSize = await rootFontSize();
    await expect(sizes.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await sizes.getByRole('button', { name: 'Largest', exact: true }).click();
    await expect(sizes.getByRole('button', { name: 'Largest', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(html).toHaveClass(/ts-largest/);
    const largestSize = await rootFontSize();
    expect(largestSize).toBeGreaterThan(normalSize);

    await page.reload();
    await waitForReady(page);
    await expect(sizes.getByRole('button', { name: 'Largest', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(html).toHaveClass(/ts-largest/);
    expect(await rootFontSize()).toBe(largestSize);

    await sizes.getByRole('button', { name: 'Normal', exact: true }).click();
    await expect(sizes.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(html).not.toHaveClass(/ts-large/);
    expect(await rootFontSize()).toBe(normalSize);
  });

  test('How to play and About open from Me and Back returns to Me', async ({ page }) => {
    await openFresh(page);
    await openTab(page, 'Me');

    await page.getByRole('link', { name: /^How to play/ }).click();
    await expect(page.getByRole('heading', { name: 'How to play', level: 1 })).toBeVisible();
    await expect(page.getByText("Guess today's tech word from clues. One new word every day.", { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.getByRole('region', { name: 'Your level' })).toBeVisible();

    await page.getByRole('link', { name: /^About Jargle/ }).click();
    await expect(page.getByRole('heading', { name: 'About this app', level: 1 })).toBeVisible();
    await expect(page.getByText('Made by Abyan.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.getByRole('region', { name: 'Your level' })).toBeVisible();
  });
});

test.describe('progress code', () => {
  test('a code from one browser restores a finished lesson in a new browser', async ({ page, browser }, testInfo) => {
    test.setTimeout(60000);
    await openFresh(page);
    const bundle = await loadBundle(page);
    const total = lessonList(bundle).length;
    await openTab(page, 'Learn');
    const lesson = await finishNextLesson(page, bundle);

    const code = await readProgressCode(page);
    expect(code.startsWith('JRG1')).toBe(true);
    expect(code.length).toBeGreaterThan(10);

    // A second browser with an empty save, like a new phone.
    const baseURL = testInfo.project.use.baseURL || 'http://localhost:4173';
    const context = await browser.newContext({ viewport: PHONE, baseURL });
    try {
      const other = await context.newPage();
      await openFresh(other, { hash: '#/learn' });
      await expect(other.getByText('0 of ' + total + ' done', { exact: true })).toBeVisible();
      await expect(other.getByRole('link', { name: lessonName(lesson) + '. Done', exact: true })).toHaveCount(0);

      await goToHash(other, '#/code/use');
      await expect(other.getByRole('heading', { name: 'Use a progress code', level: 1 })).toBeVisible();
      await useCode(other, code);
      await expect(announcer(other)).toHaveText('Code loaded. Your progress is back.');
      await expect(other.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();

      // The lesson from the first browser is done here too.
      await goToHash(other, '#/learn');
      await expect(other.getByText('1 of ' + total + ' done', { exact: true })).toBeVisible();
      await expect(other.getByRole('link', { name: lessonName(lesson) + '. Done', exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a code with a typo or the wrong start shows an error and changes nothing', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const bundle = await loadBundle(page);
    const code = await readProgressCode(page);
    expect(code.startsWith('JRG1')).toBe(true);

    await goToHash(page, '#/code/use');
    await expect(page.getByRole('heading', { name: 'Use a progress code', level: 1 })).toBeVisible();

    // A real code with one valid character changed. Flipping the last bit of the sixth character
    // keeps the length and the alphabet, so only the check value can catch it.
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const body = code.slice(5).replace(/-/g, '');
    const swapped = alphabet[alphabet.indexOf(body[5]) ^ 1];
    expect(swapped).not.toBe(body[5]);
    await useCode(page, 'JRG1' + body.slice(0, 5) + swapped + body.slice(6));
    await expect(announcer(page)).toHaveText(TYPO_MESSAGE);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);

    // The wrong start shows a different message, which also proves the line is rewritten each time.
    await useCode(page, 'hello');
    await expect(announcer(page)).toHaveText(FORMAT_MESSAGE);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);

    // U is not a character that codes use, so swapping it in is a typo caught before the check value.
    await useCode(page, code.slice(0, -1) + 'U');
    await expect(announcer(page)).toHaveText(TYPO_MESSAGE);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);

    // No progress was added.
    await goToHash(page, '#/learn');
    await expect(page.getByText('0 of ' + lessonList(bundle).length + ' done', { exact: true })).toBeVisible();
  });
});
