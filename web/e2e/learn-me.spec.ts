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
  words?: string[];
  situations?: { text: string; options: string[]; answer: string }[];
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

function lessonDoneName(lesson: Lesson): RegExp {
  const escaped = lessonName(lesson).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped + '\\. Done');
}

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesBlankSentence(displayed: string, sentence: string): boolean {
  const shown = normalizeSentence(displayed.replace(/\bblank\b/g, ''));
  return shown === normalizeSentence(sentence.replace('___', ''));
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
  // The current node bobs continuously, so navigate using its stable href.
  const nextLink = page.getByRole('link', { name: /\. Up next$/ }).first();
  const nextHref = await nextLink.getAttribute('href');
  if (!nextHref) throw new Error('next lesson link had no href');
  await page.goto(new URL(nextHref, page.url()).toString());
  await expect(page).toHaveURL(/#\/lesson\//);
  const id = decodeURIComponent(new URL(page.url()).hash.replace('#/lesson/', ''));
  const lesson = lessonById(bundle, id);
  await expect(page.getByRole('heading', { name: lesson.title, level: 1 })).toBeVisible();

  const words = (lesson.words || []).map((id) => ({ id, item: (bundle.items as Record<string, any>)[id] })).filter((x) => x.item);
  const itemForTerm = (term: string) => words.find((x) => x.item.term === term)?.item;
  const clickAnswer = async (answer: string) => {
    const button = page.getByRole('button', { name: answer, exact: true }).first();
    await expect(button).toBeVisible();
    await button.click();
  };

  // Sessions can requeue a missed step. Keep reading the current step from its class.
  for (let guard = 0; guard < 60; guard += 1) {
    if (await page.getByText('Lesson complete!', { exact: true }).count()) break;
    const step = page.locator('[class*="ls-step-"]').first();
    await expect(step).toBeVisible();
    const className = (await step.getAttribute('class')) || '';
    if (className.includes('ls-step-learn')) {
      const next = page.getByRole('button', { name: /^(Next|Got it)$/ }).last();
      await next.click();
    } else if (className.includes('ls-step-pairs')) {
      const terms = await step.locator('ul[aria-label="Words"] button').allTextContents();
      for (const term of terms) {
        const item = itemForTerm(term.trim());
        if (!item) throw new Error('No bundle item for pair ' + term);
        await step.locator('ul[aria-label="Words"] button', { hasText: term.trim() }).click();
        await step.locator('ul[aria-label="Meanings"] button', { hasText: item.short || item.meaning }).click();
      }
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    } else if (className.includes('ls-step-blank')) {
      const sentence = await step.locator('.ls-sentence').innerText();
      const item = words.find((x) => {
        const blank = x.item.blank;
        if (!blank) return false;
        return matchesBlankSentence(sentence, blank.sentence);
      })?.item;
      if (!item) throw new Error('Could not match blank sentence: ' + sentence);
      await clickAnswer(item.term);
    } else if (className.includes('ls-step-situation')) {
      const sceneText = (await step.locator('.ls-scene-text').count())
        ? (await step.locator('.ls-scene-text').innerText()).trim()
        : '';
      if (sceneText) {
        // Match the displayed scene exactly. Many situations share answer labels.
        const situation = (lesson.situations || []).find((s) => s.text === sceneText);
        if (!situation) throw new Error('Could not match situation: ' + sceneText);
        await clickAnswer(situation.answer);
      } else {
        const prompt = (await step.locator('.ls-ask').innerText()).trim();
        const check = lesson.checks.find((c) => c.prompt === prompt);
        if (!check) throw new Error('Could not match check: ' + prompt);
        await clickAnswer(check.answer);
      }
    } else if (className.includes('ls-step-build')) {
      const clue = (await step.locator('.ls-card-text').innerText()).trim();
      const item = words.find((x) => x.item.meaning === clue || x.item.short === clue)?.item;
      if (!item) throw new Error('Could not match build clue: ' + clue);
      await page.keyboard.type(item.term);
    } else if (className.includes('ls-step-meaning')) {
      const term = (await step.locator('.ls-word').innerText()).trim();
      const item = itemForTerm(term);
      if (!item) throw new Error('No bundle item for meaning ' + term);
      await clickAnswer(item.meaning);
    } else if (className.includes('ls-step-recap')) {
      await page.getByRole('button', { name: 'Finish lesson', exact: true }).click();
    } else {
      throw new Error('Unknown lesson step: ' + className);
    }
    if (await page.getByRole('button', { name: 'Continue', exact: true }).count()) {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
  }

  await expect(page.getByText('Lesson complete!', { exact: true })).toBeVisible();
  await expect(page.locator('.win-xp .pill')).toHaveText(/^\s*\+30 XP\s*$/);
  // The finished screen shows source links under this heading.
  await expect(page.getByRole('heading', { name: 'Where this comes from', level: 2 })).toBeVisible();
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

    const lesson = await finishNextLesson(page, bundle);

    // Back on Learn the lesson is done, and the count went up.
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
    await expect(page.getByRole('link', { name: lessonDoneName(lesson) })).toBeVisible();
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
    await expect(page.getByText("Guess today's tech word in 6 tries. One new word every day.", { exact: true })).toBeVisible();
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
      await expect(other.getByRole('link', { name: lessonDoneName(lesson) })).toHaveCount(0);

      await goToHash(other, '#/code/use');
      await expect(other.getByRole('heading', { name: 'Use a progress code', level: 1 })).toBeVisible();
      await useCode(other, code);
      await expect(announcer(other)).toHaveText('Code loaded. Your progress is back.');
      await expect(other.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();

      // The lesson from the first browser is done here too.
      await goToHash(other, '#/learn');
      await expect(other.getByText('1 of ' + total + ' done', { exact: true })).toBeVisible();
      await expect(other.getByRole('link', { name: lessonDoneName(lesson) })).toBeVisible();
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
