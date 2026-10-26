import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PHONE, goToHash, loadBundle, openFresh, pageToday, waitForReady } from './helpers';
import type { BundleItem } from './helpers';

test.use({ viewport: PHONE });

interface TodaysWord {
  item: BundleItem;
  dayNumber: number;
}

/** Day 1 is Oct 25, 2026 (the launch day), the same count the app uses for "Jargle #n". */
function dayNumberOf(date: string): number {
  const parts = date.split('-').map(Number);
  const launch = Date.UTC(2026, 9, 25);
  const thatDay = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  return Math.round((thatDay - launch) / 86400000) + 1;
}

/** Finds today's word in the real content bundle. The schedule maps a date to an item id. */
async function todaysWord(page: Page): Promise<TodaysWord> {
  const bundle = await loadBundle(page);
  const today = await pageToday(page);
  for (const entry of bundle.schedule.days) {
    if (entry.date === today) {
      return { item: bundle.items[entry.term], dayNumber: dayNumberOf(today) };
    }
  }
  throw new Error('No word is scheduled for ' + today);
}

function wordCard(page: Page): Locator {
  return page.getByRole('region', { name: 'Word of the Day' });
}

/** The round's polite message line (the toast area also has role status, so stay inside main). */
function announcer(page: Page): Locator {
  return page.getByRole('main').getByRole('status');
}

/**
 * The visible, typed copy of a speech bubble line. Each bubble also keeps a visually hidden copy
 * of the whole line for screen readers, so a text match on the line would find that copy at once.
 * Tests that use this helper turn on reduced motion first, so the visible copy is complete.
 */
function bubbleLine(page: Page, line: string): Locator {
  return page.locator('p.bubble > span[aria-hidden="true"]').filter({ hasText: line });
}

const LARGE_CLASS = /(^|\s)ts-large(\s|$)/;

function barsLeft(page: Page, bars: number): Locator {
  return page.getByRole('img', { name: bars + ' of 6 bars left', exact: true });
}

function card(page: Page, term: string): Locator {
  return page.getByRole('button', { name: term, exact: true });
}

function checkButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Check', exact: true });
}

function nextClueButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Next clue costs 1 bar', exact: true });
}

/** Opens today's daily round from the Word of the Day card. */
async function openDaily(page: Page): Promise<void> {
  await goToHash(page, '#/');
  await wordCard(page).getByRole('button', { name: /^(Play|Continue)$/ }).click();
  await checkButton(page).waitFor({ state: 'visible' });
}

/** Picks a card and taps Check. */
async function pickAndCheck(page: Page, term: string): Promise<void> {
  await card(page, term).click();
  await expect(card(page, term)).toHaveAttribute('aria-pressed', 'true');
  await checkButton(page).click();
}

/** Reveal, then Continue to the share step. */
async function continueToShare(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Share', level: 1 })).toBeVisible();
}

/** Share step, then Finish to the "What next?" step. */
async function finishToDone(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What next?' })).toBeVisible();
}

/** Solves today's round with the right card and no extra clues, and stops on the reveal. */
async function solveToReveal(page: Page, item: BundleItem): Promise<void> {
  await openDaily(page);
  await pickAndCheck(page, item.term);
  await expect(page.getByRole('heading', { name: 'What it means', level: 1 })).toBeVisible();
}

test.describe('first run', () => {
  test('the intro has two steps, ends on Play with the tab bar, and does not come back', async ({ page }) => {
    // Reduced motion shows the speech bubbles in full right away, so the visible text can be checked.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFresh(page, { intro: true });
    const tabBar = page.getByRole('navigation', { name: 'Main' });
    const main = page.getByRole('main');

    // Step 1: welcome. The tab bar is hidden so the only thing to tap is Next.
    await expect(page.getByRole('heading', { name: 'Welcome to Jargle', level: 1 })).toHaveCount(1);
    await expect(bubbleLine(page, "Hi! I'm Floyd, a floppy disk. I know all the old tech.")).toHaveText("Hi! I'm Floyd, a floppy disk. I know all the old tech.");
    await expect(bubbleLine(page, "And I'm Bud, a phone. We'll teach you one tech word a day!")).toHaveText("And I'm Bud, a phone. We'll teach you one tech word a day!");
    await expect(tabBar).toBeHidden();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Step 2: how it works and the text size.
    await expect(page.getByRole('heading', { name: 'How Jargle works', level: 1 })).toHaveCount(1);
    await expect(main).toContainText('Word of the Day.');
    await expect(main).toContainText('Endless.');
    await expect(main).toContainText('Streaks and XP.');
    await expect(tabBar).toBeHidden();
    const sizes = page.getByRole('group', { name: 'Text size' });
    await expect(sizes.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sizes.getByRole('button', { name: 'Large', exact: true }).click();
    await expect(sizes.getByRole('button', { name: 'Large', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveClass(LARGE_CLASS);
    await page.getByRole('button', { name: "Let's play!", exact: true }).click();

    // Done: Play with the tab bar.
    await expect(wordCard(page)).toBeVisible();
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link')).toHaveCount(3);

    // The intro is remembered, and so is the text size choice.
    await page.reload();
    await waitForReady(page);
    await expect(wordCard(page)).toBeVisible();
    await expect(page.getByRole('button', { name: "Let's play!", exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Welcome to Jargle' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(LARGE_CLASS);
  });
});

test.describe('Play home', () => {
  test('a new player sees the daily card, Endless, More games and three tabs', async ({ page }) => {
    await openFresh(page);
    const { dayNumber } = await todaysWord(page);

    const word = wordCard(page);
    await expect(word.getByRole('heading', { name: 'Word of the Day' })).toBeVisible();
    // The number must end there: No. 2 must not pass for No. 20.
    await expect(word).toContainText(new RegExp('No\\. ' + dayNumber + '(?!\\d)'));
    await expect(word).toContainText("Guess today's tech word from a few clues.");
    await expect(word.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    const endless = page.getByRole('region', { name: 'Endless' });
    await expect(endless).toContainText('Quick questions, 3 hearts. How far can you go?');
    await expect(endless.getByRole('link', { name: 'Play Endless', exact: true })).toBeVisible();

    const more = page.getByRole('region', { name: 'More games' });
    await expect(more.getByRole('link', { name: /^Pass the Phone/ })).toBeVisible();
    await expect(more.getByRole('link', { name: /^Old Tech/ })).toBeVisible();
    // Practice and Review wait until the player has finished a first day.
    await expect(more.getByRole('link', { name: /^Practice/ })).toHaveCount(0);
    await expect(more.getByRole('link', { name: /^Review/ })).toHaveCount(0);

    const tabBar = page.getByRole('navigation', { name: 'Main' });
    await expect(tabBar.getByRole('link')).toHaveCount(3);
    await expect(tabBar.getByRole('link', { name: 'Play', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(tabBar.getByRole('link', { name: 'Learn', exact: true })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Me', exact: true })).toBeVisible();
  });

  test('tapping Play opens the daily round', async ({ page }) => {
    await openFresh(page);
    const { item } = await todaysWord(page);
    await wordCard(page).getByRole('button', { name: 'Play', exact: true }).click();

    await expect(page).toHaveURL(/#\/play\/d(%3A|:)\d+$/);
    await expect(checkButton(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's word", level: 1 })).toBeVisible();
    await expect(barsLeft(page, 6)).toBeVisible();
    // One clue to start, and the four answer cards (the answer is one of them).
    await expect(page.getByText('1 of ' + item.clues.length, { exact: true })).toBeVisible();
    await expect(page.getByText(item.clues[0], { exact: true })).toBeVisible();
    await expect(card(page, item.term)).toBeVisible();
    for (const decoy of item.decoys) {
      await expect(card(page, decoy.term)).toBeVisible();
    }
  });
});

test.describe('daily round', () => {
  test('solving shows the win, walks the after steps, and Play shows it solved', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const { item, dayNumber } = await todaysWord(page);

    // A new player starts at level 1, 30 XP from level 2.
    await goToHash(page, '#/me');
    await expect(page.getByText('Level 1', { exact: true })).toBeVisible();
    await expect(page.getByText('30 XP to level 2', { exact: true })).toBeVisible();
    await openDaily(page);

    // Check with nothing picked asks for a word first.
    await checkButton(page).click();
    await expect(announcer(page)).toHaveText('Tap a word first.');

    await card(page, item.term).click();
    await expect(card(page, item.term)).toHaveAttribute('aria-pressed', 'true');
    await expect(announcer(page)).toHaveText('Selected. Now tap Check.');
    await checkButton(page).click();

    // The win state.
    await expect(page.getByRole('heading', { name: 'What it means', level: 1 })).toBeVisible();
    await expect(page.getByText('You got it!', { exact: true })).toBeVisible();
    await expect(page.getByText('You learned ' + item.term + '. Solved with 6 bars left.', { exact: true })).toBeVisible();
    await expect(barsLeft(page, 6)).toBeVisible();
    // A solved daily with 6 bars is worth 20 + 5 * 6 XP.
    // The pill is the steady one. A floating copy next to it is hidden from screen readers and fades.
    await expect(page.locator('.win-xp .pill')).toHaveText(/^\s*\+50 XP\s*$/);

    // Share step, then the done step.
    await continueToShare(page);
    await expect(page.getByText('Jargle #' + dayNumber + ': 6 bars left')).toBeVisible();
    await finishToDone(page);
    // Floyd and Bud's goal line is typed out; its full copy for screen readers is there at once.
    const goalLine = 'No. ' + dayNumber + ' done! Come back tomorrow for No. ' + (dayNumber + 1) + ', or keep going in Endless.';
    await expect(page.getByText(goalLine, { exact: true }).first()).toBeAttached();
    // The counter's label holds the number for screen readers; the big digits beside it are decorative.
    await expect(page.getByText('Days learned: 1', { exact: true })).toBeAttached();
    await expect(page.getByRole('main')).toContainText('Play Endless');

    // Back on Play the card shows the solved state.
    await goToHash(page, '#/');
    const word = wordCard(page);
    await expect(word).toContainText('Solved with 6 bars left. Nice!');
    await expect(word).not.toContainText('Your result');
    await expect(word).toContainText('Next word in');
    await expect(word.getByRole('button', { name: /^(Play|Continue)$/ })).toHaveCount(0);
    await expect(word.getByRole('button', { name: "See today's word", exact: true })).toBeVisible();

    // Play's progress bar shows the new level, and it must survive a full reload (the save used to drop XP).
    const progress = page.getByRole('link', { name: /^Your progress: level 2, \d+ day streak, 20 of 50 XP$/ });
    await expect(progress).toBeVisible();
    await expect(page.getByText('20 / 50 XP', { exact: true })).toBeVisible();
    await page.reload();
    await waitForReady(page);
    await expect(progress).toBeVisible();
    await expect(page.getByText('20 / 50 XP', { exact: true })).toBeVisible();

    // The 50 XP shows on Me: level 1 needs 30, so the player is now 20 XP into level 2 (50 XP needed there).
    await goToHash(page, '#/me');
    await expect(page.getByText('Level 2', { exact: true })).toBeVisible();
    await expect(page.getByText('30 XP to level 3', { exact: true })).toBeVisible();
    await expect(page.getByText('Level 1', { exact: true })).toHaveCount(0);
  });

  test('a miss costs bars, the round goes on, and solving still works', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const { item } = await todaysWord(page);
    const wrong = item.decoys[0];
    await openDaily(page);

    // Buy one clue (6 bars become 5).
    await nextClueButton(page).click();
    await expect(page.getByText(item.clues[1], { exact: true })).toBeVisible();
    await expect(page.getByText('2 of ' + item.clues.length, { exact: true })).toBeVisible();
    await expect(barsLeft(page, 5)).toBeVisible();

    // A wrong card, checked with Enter (a wrong guess costs 3 bars).
    await card(page, wrong.term).click();
    await expect(card(page, wrong.term)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Not this one', { exact: true })).toHaveCount(1);
    await expect(page.getByText(wrong.meaning, { exact: true })).toBeVisible();
    await expect(barsLeft(page, 2)).toBeVisible();
    await expect(announcer(page)).not.toHaveText('');

    // The round is still going: Check is there and the clue stays.
    await expect(checkButton(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What it means' })).toHaveCount(0);
    await expect(page.getByText('2 of ' + item.clues.length, { exact: true })).toBeVisible();

    // Solving after the miss ends the round with the bars that are left.
    await pickAndCheck(page, item.term);
    await expect(page.getByRole('heading', { name: 'What it means', level: 1 })).toBeVisible();
    await expect(page.getByText('You learned ' + item.term + '. Solved with 2 bars left.', { exact: true })).toBeVisible();
    await expect(barsLeft(page, 2)).toBeVisible();

    await goToHash(page, '#/');
    await expect(wordCard(page)).toContainText('Solved with 2 bars left. Nice!');
  });

  test('running out of bars shows the answer and counts as learned', async ({ page }) => {
    test.setTimeout(60000);
    // Reduced motion shows Bud's speech bubble in full right away.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFresh(page);
    const { item, dayNumber } = await todaysWord(page);
    await openDaily(page);

    // First wrong guess: 6 bars become 3 and the round goes on.
    await pickAndCheck(page, item.decoys[0].term);
    await expect(barsLeft(page, 3)).toBeVisible();
    await expect(page.getByText('Not this one', { exact: true })).toHaveCount(1);
    await expect(checkButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show me the answer', exact: true })).toBeVisible();

    // Second wrong guess: no bars left, so the round ends and the answer is shown.
    await pickAndCheck(page, item.decoys[1].term);
    await expect(barsLeft(page, 0)).toBeVisible();
    // Bud says this in a speech bubble. Check the visible copy, not the one kept for screen readers.
    await expect(bubbleLine(page, "Here's the answer. A miss still teaches you a word.")).toHaveText("Here's the answer. A miss still teaches you a word.");
    await expect(page.getByText('Not this one', { exact: true })).toHaveCount(2);
    const answerCard = page.getByRole('button').filter({ hasText: 'Right answer:' });
    await expect(answerCard).toHaveCount(1);
    await expect(answerCard).toContainText(item.term);
    await expect(answerCard).toContainText(item.meaning);
    await expect(checkButton(page)).toHaveCount(0);

    // After flow: reveal, share, done.
    await page.getByRole('button', { name: 'See what it means', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What it means', level: 1 })).toBeVisible();
    await expect(page.getByText('Good try!', { exact: true })).toBeVisible();
    await expect(page.getByText('Learned it: ' + item.term + '.', { exact: true })).toBeVisible();
    await expect(page.getByText("That's a hard one. Here's what it means.", { exact: true })).toBeVisible();
    await continueToShare(page);
    await expect(page.getByText('Jargle #' + dayNumber + ': learned it (1 clue)')).toBeVisible();
    await finishToDone(page);
    const goalLine = 'No. ' + dayNumber + ' done! Come back tomorrow for No. ' + (dayNumber + 1) + ', or keep going in Endless.';
    await expect(page.getByText(goalLine, { exact: true }).first()).toBeAttached();

    // Play says the word was learned, not solved.
    await goToHash(page, '#/');
    await expect(wordCard(page)).toContainText("Done! You learned today's word.");
    await expect(wordCard(page)).toContainText('Next word in');
    await expect(wordCard(page).getByRole('button', { name: /^(Play|Continue)$/ })).toHaveCount(0);
  });

  test('two quick taps on Next clue count once', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const { item } = await todaysWord(page);
    await openDaily(page);

    await nextClueButton(page).dblclick();
    await expect(page.getByText('2 of ' + item.clues.length, { exact: true })).toBeVisible();
    await expect(barsLeft(page, 5)).toBeVisible();

    // A tap after the short pause is a real second clue.
    await page.waitForTimeout(750);
    await nextClueButton(page).click();
    await expect(page.getByText('3 of ' + item.clues.length, { exact: true })).toBeVisible();
    await expect(barsLeft(page, 4)).toBeVisible();
  });

  test('a round in progress survives a reload', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const { item } = await todaysWord(page);
    await openDaily(page);

    await nextClueButton(page).click();
    await expect(page.getByText('2 of ' + item.clues.length, { exact: true })).toBeVisible();
    await card(page, item.decoys[2].term).click();
    await expect(card(page, item.decoys[2].term)).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await waitForReady(page);
    await expect(checkButton(page)).toBeVisible();
    await expect(page.getByText('2 of ' + item.clues.length, { exact: true })).toBeVisible();
    await expect(page.getByText(item.clues[0], { exact: true })).toBeVisible();
    await expect(page.getByText(item.clues[1], { exact: true })).toBeVisible();
    await expect(barsLeft(page, 5)).toBeVisible();
    await expect(card(page, item.decoys[2].term)).toHaveAttribute('aria-pressed', 'true');

    // Play offers to pick up where the player left off.
    await goToHash(page, '#/');
    await expect(wordCard(page).getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  });
});

test.describe('sharing', () => {
  test('the share text names the day, never gives away the word, and goes to the share sheet', async ({ page }) => {
    test.setTimeout(60000);
    // Stand in for the phone's share sheet, so the test can read what would be sent.
    await page.addInitScript(() => {
      const sent: string[] = [];
      (window as unknown as { sharedTexts: string[] }).sharedTexts = sent;
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: { text?: string }) => {
          sent.push(data.text || '');
          return Promise.resolve();
        },
      });
    });
    await openFresh(page);
    const { item, dayNumber } = await todaysWord(page);
    await solveToReveal(page, item);
    await continueToShare(page);

    const preview = page.getByText('Jargle #' + dayNumber + ': 6 bars left');
    await expect(preview).toBeVisible();
    const previewText = (await preview.textContent()) || '';
    expect(previewText).toContain('Jargle #' + dayNumber + ': 6 bars left');
    expect(previewText).toContain('1 clue, no misses');
    expect(previewText.toLowerCase()).not.toContain(item.term.toLowerCase());

    await page.getByRole('button', { name: 'Send to someone', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { sharedTexts: string[] }).sharedTexts.length))
      .toBe(1);
    const sent = await page.evaluate(() => (window as unknown as { sharedTexts: string[] }).sharedTexts[0]);
    expect(sent).toBe(previewText);
    expect(sent.toLowerCase()).not.toContain(item.term.toLowerCase());
  });

  test('without a share sheet the text is copied instead', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      const copied: string[] = [];
      (window as unknown as { copiedTexts: string[] }).copiedTexts = copied;
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            copied.push(text);
            return Promise.resolve();
          },
        },
      });
    });
    await openFresh(page);
    const { item, dayNumber } = await todaysWord(page);
    await solveToReveal(page, item);
    await continueToShare(page);

    await page.getByRole('button', { name: 'Send to someone', exact: true }).click();
    await expect(announcer(page)).toHaveText('Copied. Paste it into a text or email.');
    const copied = await page.evaluate(() => (window as unknown as { copiedTexts: string[] }).copiedTexts);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('Jargle #' + dayNumber + ': 6 bars left');
    expect(copied[0].toLowerCase()).not.toContain(item.term.toLowerCase());
  });
});
