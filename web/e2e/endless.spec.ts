import { expect, test, type Page } from '@playwright/test';
import { loadBundle, openFresh, openTab, PHONE, type BundleItem } from './helpers';

test.use({ viewport: PHONE });
// Runs answer many questions, so they get more time than the default.
test.describe.configure({ timeout: 90000 });

type RuntimeBundle = {
  items?: Record<string, BundleItem>;
  bank?: Record<string, BundleItem> | Array<BundleItem | string>;
  bankItems?: Record<string, BundleItem> | Array<BundleItem | string>;
  endless?: Record<string, BundleItem> | Array<BundleItem | string>;
};

// Reads every content item from the runtime bundle on the page.
function allItems(bundle: RuntimeBundle): BundleItem[] {
  const result: BundleItem[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && bundle.items?.[item]) result.push(bundle.items[item]);
        else if (item && typeof item === 'object') result.push(item as BundleItem);
      }
    }
    else if (value && typeof value === 'object') result.push(...Object.values(value as Record<string, BundleItem>));
  };
  add(bundle.items);
  add(bundle.bank);
  add(bundle.bankItems);
  add(bundle.endless);
  return result;
}

async function clickOption(page: Page, option: string): Promise<void> {
  const options = page.locator('[data-option]');
  for (let i = 0; i < await options.count(); i += 1) {
    if (await options.nth(i).getAttribute('data-option') === option) {
      await options.nth(i).click();
      return;
    }
  }
  throw new Error(`answer option was not rendered: ${option}`);
}

// The visible kind labels that start every question card.
const KIND_LABELS = ['Meaning Match', 'Name It', 'True or False', 'Old or New', 'Clue Climb', 'Spell it'];

// Reads the question kind from the visible text at the top of the prompt card.
async function readKind(page: Page): Promise<string> {
  const text = (await page.locator('#en-prompt').innerText()).trim();
  for (const label of KIND_LABELS) {
    if (text.startsWith(label)) {
      return label;
    }
  }
  throw new Error(`prompt card does not start with a known kind: ${text.slice(0, 40)}`);
}

// A short fingerprint of the current question: its kind plus its answer options.
// The next question never has the same kind as the last one, so the fingerprint always changes.
async function questionSignature(page: Page): Promise<string> {
  try {
    const kind = await readKind(page);
    const options = await page.locator('[data-option]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-option')));
    const prompt = kind === 'Spell it' ? await page.locator('#en-prompt .lt-prompt-text').innerText() : '';
    return kind + ' | ' + options.join(' / ') + ' | ' + prompt;
  } catch {
    // The card can be missing for a moment while the next question is drawn.
    return '';
  }
}

// Reads the current question and matches it to an item in the page bundle.
async function currentItem(page: Page, items: BundleItem[]): Promise<BundleItem> {
  const card = page.locator('#en-prompt');
  const kind = await readKind(page);
  const termLocator = card.locator('.q-term, .q-term-inline').first();
  if (kind === 'Spell it') {
    const clue = await card.locator('.lt-prompt-text').innerText();
    const found = items.find((item) => item.meaning === clue || item.term === clue);
    if (found) return found;
  }
  if (await termLocator.count() > 0) {
    const term = await termLocator.innerText();
    const found = items.find((item) => item.term === term);
    if (found) return found;
  }
  if (kind === 'Name It') {
    const meaning = await card.locator('.q-meaning-text').innerText();
    const found = items.find((item) => item.meaning === meaning);
    if (found) return found;
  }
  if (kind === 'Clue Climb') {
    const clue = await card.locator('.q-clue.open .q-clue-text').first().innerText();
    const options = await page.locator('[data-option]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-option')));
    const found = items.find((item) => item.clues[0] === clue && options.includes(item.term));
    if (found) return found;
  }
  throw new Error(`could not match ${kind} question to the runtime content bundle`);
}

// Reads the current question and returns its correct answer.
async function rightAnswer(page: Page, items: BundleItem[]): Promise<string> {
  const kind = await readKind(page);
  const item = await currentItem(page, items);
  if (kind === 'Meaning Match') return item.meaning;
  if (kind === 'Name It' || kind === 'Clue Climb' || kind === 'Spell it') return item.term;
  if (kind === 'Old or New') return item.old_tech ? 'Old tech' : "Today's tech";
  if (kind === 'True or False') {
    const statement = await page.locator('#en-prompt .q-statement').innerText();
    return statement.split(' means: ')[1] === item.meaning ? 'True' : 'False';
  }
  throw new Error(`unknown Endless question kind: ${kind}`);
}

// Reads the answer buttons and returns one answer that is not correct.
async function wrongAnswer(page: Page, right: string): Promise<string> {
  const options = page.locator('[data-option]');
  for (let i = 0; i < await options.count(); i += 1) {
    const option = await options.nth(i).getAttribute('data-option');
    if (option && option !== right) return option;
  }
  throw new Error('question did not have a wrong answer option');
}

async function startEndless(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Play Endless', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Endless', exact: true })).toBeVisible();
  await expect(page.getByLabel(/^(Best score|No best score yet)/)).toBeVisible();
  await expect(page.getByText('3 hearts', { exact: true })).toBeVisible();
  await expect(page.getByText('Combos up to x3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Score 0', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '3 hearts left', exact: true })).toBeVisible();
}

/**
 * Answers the current question correctly, then waits for the next question to show up.
 * The auto-advance takes about 900 ms, but a slow runner can take longer, so this waits for a
 * different question (up to 5 s) and does not depend on any timing between the click and the check.
 */
async function answerRightAndWait(page: Page, items: BundleItem[]): Promise<void> {
  const before = await questionSignature(page);
  if (before === '') {
    throw new Error('no question was on screen to answer');
  }
  const answer = await rightAnswer(page, items);
  if (await readKind(page) === 'Spell it') {
    for (const letter of answer.replace(/[^A-Za-z]/g, '').toUpperCase()) {
      await page.getByRole('button', { name: 'Letter ' + letter, exact: true }).first().click();
    }
    await expect(page.getByText('You got it!', { exact: true })).toBeVisible();
  } else {
    await clickOption(page, answer);
  }
  await waitForNewQuestion(page, before);
}

/** Waits (up to 5 s) until a different question is fully on screen. */
async function waitForNewQuestion(page: Page, before: string): Promise<void> {
  await expect.poll(async () => {
    const now = await questionSignature(page);
    // An empty signature means the card is between questions, which is not "new" yet.
    return now !== '' && now !== before;
  }, { timeout: 5000 }).toBe(true);
}

async function answerWrong(page: Page, items: BundleItem[]): Promise<void> {
  const kind = await readKind(page);
  if (kind !== 'Spell it') {
    await clickOption(page, await wrongAnswer(page, await rightAnswer(page, items)));
    return;
  }
  const answer = (await rightAnswer(page, items)).replace(/[^A-Za-z]/g, '').toUpperCase();
  const letters = answer.split('');
  if (letters.length > 1) {
    const first = letters.shift() as string;
    letters.push(first);
  }
  for (const letter of letters) {
    await page.getByRole('button', { name: 'Letter ' + letter, exact: true }).first().click();
  }
  await expect(page.getByText('Not quite. One more try!', { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  for (const letter of letters) {
    await page.getByRole('button', { name: 'Letter ' + letter, exact: true }).first().click();
  }
  await expect(page.getByRole('button', { name: /^(Next|See my score)$/ })).toBeVisible();
}

test.describe('Endless', () => {
  test('starts from Play with rules and three hearts', async ({ page }) => {
    await openFresh(page);
    await startEndless(page);
  });

  test('eventually shows every question kind', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    const seen = new Set<string>();
    for (let i = 0; i < 60 && seen.size < 6; i += 1) {
      seen.add(await readKind(page));
      await answerRightAndWait(page, items);
    }
    expect([...seen].sort(), `kinds seen: ${[...seen].join(', ')}`).toEqual(['Clue Climb', 'Meaning Match', 'Name It', 'Old or New', 'Spell it', 'True or False']);
  });

  test('combo reaches x2, then a wrong answer resets it and costs a heart', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    for (let i = 0; i < 3; i += 1) {
      await answerRightAndWait(page, items);
    }
    await expect(page.getByLabel('Combo 3, points times 2', { exact: true })).toBeVisible();
    const item = await currentItem(page, items);
    const questionBefore = await questionSignature(page);
    await answerWrong(page, items);
    await expect(page.getByLabel('Combo 0, points times 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: '2 hearts left', exact: true })).toBeVisible();
    // The why line under the answers names the word and its meaning.
    await expect(page.getByText(item.term + ': ' + item.meaning, { exact: true })).toBeVisible();
    await expect(page.getByText('Next', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    // Next is gone and a different question is on screen.
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    await waitForNewQuestion(page, questionBefore);
    await expect(page.getByLabel(/^Score \d+$/)).toBeVisible();
  });

  test('six right answers in a row reach combo x3', async ({ page }) => {
    test.setTimeout(90000);
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    for (let i = 0; i < 6; i += 1) {
      await answerRightAndWait(page, items);
    }
    await expect(page.getByLabel('Combo 6, points times 3', { exact: true })).toBeVisible();
  });

  test('three misses show game over summary', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    await answerRightAndWait(page, items);
    for (let i = 0; i < 3; i += 1) {
      await answerWrong(page, items);
      if (i === 0) {
        await expect(page.getByRole('img', { name: '2 hearts left', exact: true })).toBeVisible();
      }
      if (i === 1) {
        await expect(page.getByRole('img', { name: '1 heart left', exact: true })).toBeVisible();
      }
      const button = i === 2 ? 'See my score' : 'Next';
      await page.getByRole('button', { name: button, exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Game over', exact: true })).toBeVisible();
    await expect(page.getByText('Your score', { exact: true })).toBeVisible();
    // The test answered exactly one question right, so the count is 1 (and the label is singular).
    const rightTile = page.getByRole('listitem').filter({ hasText: 'right answer' });
    await expect(rightTile).toHaveText(/^\s*1\s*right answer\s*$/);
    await expect(page.getByText('XP', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play again', exact: true })).toBeVisible();
  });

  test('best score appears in game over, Play, Me, and after reload', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    await answerRightAndWait(page, items);
    for (let i = 0; i < 3; i += 1) {
      await answerWrong(page, items);
      const button = i === 2 ? 'See my score' : 'Next';
      await page.getByRole('button', { name: button, exact: true }).click();
    }
    const score = Number(await page.locator('.en-final').innerText());
    expect(score).toBeGreaterThan(0);
    await expect(page.getByText('Old best: 0', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    // Play's Endless card now reads "Best N. Beat it?".
    const endlessCard = page.getByRole('region', { name: 'Endless' });
    await expect(endlessCard).toContainText(new RegExp('Best ' + score + '\\.\\s*Beat it\\?'));
    await openTab(page, 'Me');
    // The tile must show exactly the score, so 10 does not pass for 100.
    const bestTile = page.getByLabel('Your stats').getByRole('listitem').filter({ hasText: 'Endless best' });
    const exactTile = new RegExp('^\\s*' + score + '\\s*Endless best\\s*$');
    await expect(bestTile).toHaveText(exactTile);
    await page.reload();
    await expect(bestTile).toHaveText(exactTile);
  });

  test('Play again starts a fresh run and End run shows the score', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    await answerRightAndWait(page, items);
    await page.getByRole('button', { name: 'End run', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Game over', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(page.getByLabel('Score 0', { exact: true })).toBeVisible();
  });

  test('number keys answer a meaning or name question', async ({ page }) => {
    await openFresh(page);
    const items = allItems(await loadBundle(page) as RuntimeBundle);
    await startEndless(page);
    for (let i = 0; i < 30; i += 1) {
      const kind = await readKind(page);
      if (kind === 'Meaning Match' || kind === 'Name It') {
        const answer = await rightAnswer(page, items);
        const options = page.locator('[data-option]');
        for (let j = 0; j < await options.count(); j += 1) {
          if (await options.nth(j).getAttribute('data-option') === answer) {
            await page.keyboard.press(String(j + 1));
            // The button that was pressed is the right one: it is named as the user's correct answer.
            await expect(page.getByRole('button', { name: answer + ', your answer, correct', exact: true })).toBeVisible();
            await expect(options.nth(j)).toHaveAttribute('aria-disabled', 'true');
            return;
          }
        }
        throw new Error('right answer button missing');
      }
      await answerRightAndWait(page, items);
    }
    throw new Error('no meaning or name question appeared in 30 questions');
  });
});

