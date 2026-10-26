import { expect, test } from '@playwright/test';
import { loadBundle, openFresh, openTab, PHONE } from './helpers';

test.use({ viewport: PHONE });

type AnyItem = {
  id?: string;
  term: string;
  meaning: string;
  short?: string;
  blank?: { sentence: string };
  situations?: { prompt?: string; text?: string; answer: string; options: string[] }[];
};
type AnyLesson = {
  id: string;
  words: string[];
  checks?: { prompt: string; answer: string }[];
  situations?: { prompt?: string; text?: string; answer: string; options: string[] }[];
};

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesBlankSentence(displayed: string, sentence: string): boolean {
  // The blank marker may appear in innerText, so remove it before comparing.
  const shown = normalizeSentence(displayed.replace(/\bblank\b/g, ''));
  return shown === normalizeSentence(sentence.replace('___', ''));
}

async function finishStep(page: import('@playwright/test').Page, items: AnyItem[], lesson: AnyLesson): Promise<void> {
  const step = page.locator('.ls-step');
  if (await step.locator('.ls-learn').count()) {
    await page.getByRole('button', { name: /^(Next|Got it)$/ }).click();
    return;
  }
  if (await step.locator('.ls-pairs').count()) {
    const terms = step.getByRole('list', { name: 'Words' }).getByRole('button');
    const meanings = step.getByRole('list', { name: 'Meanings' }).getByRole('button');
    const count = await terms.count();
    for (let i = 0; i < count; i += 1) {
      const term = (await terms.nth(i).innerText()).trim();
      const item = items.find((entry) => entry.term === term);
      if (!item) throw new Error('pair term was not in the bundle: ' + term);
      const meaning = item.short || item.meaning;
      await terms.nth(i).click();
      await meanings.filter({ hasText: meaning }).click();
    }
  } else if (await step.locator('.ls-blank').count()) {
    const sentence = await step.locator('.ls-sentence').innerText();
    const item = items.find((entry) => entry.blank && matchesBlankSentence(sentence, entry.blank.sentence));
    if (!item) throw new Error('blank step did not match a bundle item: ' + sentence);
    await step.getByRole('button', { name: item.term, exact: true }).click();
  } else if (await step.locator('.ls-situation').count()) {
    const text = (await step.locator('.ls-scene-text').innerText().catch(() => '')).trim();
    if (text) {
      const situation = (lesson.situations || []).find((entry) => entry.text === text);
      if (!situation) throw new Error('situation was not found in the lesson bundle: ' + text);
      await step.getByRole('button', { name: situation.answer, exact: true }).click();
    } else {
      const prompt = (await step.locator('.ls-ask').innerText()).trim();
      const check = (lesson.checks || []).find((entry) => entry.prompt === prompt);
      if (!check) throw new Error('check was not found in the lesson bundle: ' + prompt);
      await step.getByRole('button', { name: check.answer, exact: true }).click();
    }
  } else if (await step.locator('.ls-build').count()) {
    const clue = (await step.locator('.ls-card-text').innerText()).trim();
    const item = items.find((entry) => entry.meaning === clue || entry.short === clue);
    if (!item) throw new Error('build clue was not matched to an item: ' + clue);
    const answerLetters = item.term.replace(/[^A-Za-z]/g, '');
    await expect(step.getByRole('group', { name: 'Letter tiles', exact: true }).getByRole('button')).toHaveCount(answerLetters.length + 1);
    for (const letter of answerLetters.toUpperCase()) {
      const key = letter;
      const buttons = step.getByRole('button', { name: 'Letter ' + key, exact: true });
      if ((await buttons.count()) === 0) throw new Error('missing tile for ' + key);
      await buttons.first().click();
    }
    await expect(step.getByText('You got it!', { exact: true })).toBeVisible();
  } else if (await step.locator('.ls-meaning').count()) {
    const term = (await step.locator('.ls-word').innerText()).trim();
    const item = items.find((entry) => entry.term === term);
    if (!item) throw new Error('meaning step term was not in the bundle: ' + term);
    await step.getByRole('button', { name: item.meaning, exact: true }).click();
  } else if (await step.locator('.ls-recap').count()) {
    await step.getByRole('button', { name: 'Finish lesson', exact: true }).click();
    return;
  } else {
    throw new Error('unknown lesson step on screen');
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('the Build it step uses tappable letter tiles and the lesson finishes', async ({ page }) => {
  await openFresh(page);
  await openTab(page, 'Learn');
  const first = page.locator('a.path-node.is-current').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute('href');
  if (!href) throw new Error('current lesson link had no href');
  const lessonId = href.replace('#/lesson/', '');
  const bundle = await loadBundle(page);
  const lessons = bundle.lessons as AnyLesson[];
  const lesson = lessons.find((entry) => entry.id === lessonId);
  if (!lesson) throw new Error('lesson was not in the bundle: ' + lessonId);
  const items = Object.entries(bundle.items).map(([id, item]) => ({ ...(item as AnyItem), id }));
  // The current node has a gentle bob animation, so use its stable href.
  await page.goto(new URL(href, page.url()).toString());
  let sawBuild = false;
  for (let i = 0; i < 30 && (await page.getByText('Lesson complete!', { exact: true }).count()) === 0; i += 1) {
    if (await page.getByText('Build it', { exact: true }).count()) {
      sawBuild = true;
      await expect(page.locator('.ls-build input')).toHaveCount(0);
      await expect(page.getByRole('group', { name: 'Letter tiles', exact: true })).toBeVisible();
    }
    await finishStep(page, items, lesson);
  }
  expect(sawBuild).toBe(true);
  await expect(page.getByText('Lesson complete!', { exact: true })).toBeVisible();
  await expect(page.getByText(/XP/).first()).toBeVisible();
});
