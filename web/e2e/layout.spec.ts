import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  PHONE,
  VIEWPORTS,
  expectNoHorizontalScroll,
  findOverlappingText,
  goToHash,
  openFresh,
  saveScreen,
  setTextSize,
  waitForAnimations,
} from './helpers';
import type { TextSize } from './helpers';

// Every screen a player can reach by hash, with the h1 that proves it opened.
const SCREENS = [
  { name: 'play', hash: '#/', heading: 'Jargle' },
  { name: 'learn', hash: '#/learn', heading: 'Learn' },
  { name: 'me', hash: '#/me', heading: 'Me' },
  { name: 'endless', hash: '#/endless', heading: 'Endless' },
  { name: 'settings', hash: '#/settings', heading: 'Settings' },
  { name: 'how', hash: '#/how', heading: 'How to play' },
  { name: 'about', hash: '#/about', heading: 'About this app' },
  { name: 'review', hash: '#/review', heading: 'Review' },
  { name: 'practice', hash: '#/practice', heading: 'Practice' },
  { name: 'oldtech', hash: '#/oldtech', heading: "Floyd's Old Tech" },
  { name: 'ptp', hash: '#/ptp', heading: 'Pass the Phone' },
  { name: 'badges', hash: '#/badges', heading: 'Badges' },
  { name: 'code', hash: '#/code', heading: 'Get a progress code' },
  { name: 'codeUse', hash: '#/code/use', heading: 'Use a progress code' },
  { name: 'get', hash: '#/get', heading: 'Get Jargle' },
  { name: 'lesson', hash: '#/lesson/make-a-strong-password', heading: 'Make a strong password' },
  { name: 'notFound', hash: '#/no-such-page', heading: 'Page not found' },
];

// The screens with the most text, checked for overlap at Largest.
const KEY_SCREENS = ['play', 'learn', 'me', 'endless', 'lesson', 'how', 'badges'];

/** Opens today's Daily Jargle (the letter grid game) from the Word of the Day card. */
async function openDaily(page: Page): Promise<void> {
  await goToHash(page, '#/', 'Jargle');
  await page.getByRole('region', { name: 'Word of the Day' }).getByRole('button', { name: /^(Play|Continue)$/ }).click();
  await page.getByRole('group', { name: 'Keyboard' }).waitFor({ state: 'visible' });
}

/** Opens Endless and starts a run, then waits for either question control. */
async function startEndless(page: Page): Promise<void> {
  await goToHash(page, '#/endless', 'Endless');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'End run' }).waitFor({ state: 'visible' });
  await expect.poll(async () => {
    return (await page.locator('[data-option]').count()) > 0 || (await page.locator('.lt .lt-tile').count()) > 0;
  }).toBe(true);
}

async function checkScreen(page: Page, label: string): Promise<void> {
  await waitForAnimations(page);
  try {
    await expectNoHorizontalScroll(page);
  } catch (error) {
    throw new Error(`${label}: ${(error as Error).message}`);
  }
}

// No sideways scroll anywhere: 7 sizes x 2 text sizes, all screens plus a live round and a live Endless run.
const SIZES: TextSize[] = ['Normal', 'Largest'];
for (const viewport of VIEWPORTS) {
  for (const size of SIZES) {
    test(`no horizontal scroll at ${viewport.name}, ${size} text`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFresh(page);
      await setTextSize(page, size);
      for (const screen of SCREENS) {
        await goToHash(page, screen.hash, screen.heading);
        await checkScreen(page, screen.name);
      }
      await openDaily(page);
      await checkScreen(page, 'daily round');
      await startEndless(page);
      await checkScreen(page, 'endless run');
    });
  }
}

// The two checks above and below would pass forever if they were broken, so plant a problem
// and make sure each one catches it.
test('the layout checks catch a planted problem', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openFresh(page);
  await waitForAnimations(page);
  expect(await findOverlappingText(page)).toEqual([]);
  await page.evaluate(() => {
    // Two lines of text drawn at the same spot.
    for (const text of ['Planted words one', 'Planted words two']) {
      const line = document.createElement('p');
      line.textContent = text;
      line.style.position = 'absolute';
      line.style.top = '120px';
      line.style.left = '20px';
      line.style.margin = '0';
      document.body.append(line);
    }
  });
  const overlaps = await findOverlappingText(page);
  expect(overlaps.join(' ')).toContain('Planted words');
});

test('the overlap check also sees decorative text and the fixed bars', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openFresh(page);
  await page.evaluate(() => {
    // Decorative (aria-hidden) text is still drawn, so it must not cover other words.
    const hidden = document.createElement('p');
    hidden.setAttribute('aria-hidden', 'true');
    hidden.textContent = 'Hidden planted';
    const plain = document.createElement('p');
    plain.textContent = 'Plain planted';
    for (const line of [hidden, plain]) {
      line.style.position = 'absolute';
      line.style.top = '140px';
      line.style.left = '20px';
      line.style.margin = '0';
      document.body.append(line);
    }
    // A word dropped on top of the tab bar's labels.
    const bar = document.querySelector('nav[aria-label="Main"]') as HTMLElement;
    const label = bar.querySelector('a') as HTMLElement;
    const box = label.getBoundingClientRect();
    const extra = document.createElement('span');
    extra.textContent = 'Bar planted';
    extra.style.position = 'fixed';
    extra.style.left = box.left + 'px';
    extra.style.top = box.bottom - 18 + 'px';
    extra.style.fontSize = '16px';
    document.body.append(extra);
  });
  const overlaps = (await findOverlappingText(page)).join(' ');
  expect(overlaps).toContain('Hidden planted');
  expect(overlaps).toContain('Bar planted');
});

test('the sideways check catches wide content, cut-off text and text past a fixed bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openFresh(page);
  await expectNoHorizontalScroll(page);

  // 1. A box wider than the screen makes the page scroll.
  await page.evaluate(() => {
    const wide = document.createElement('div');
    wide.id = 'planted-wide';
    wide.textContent = 'Too wide';
    wide.style.width = '500px';
    (document.querySelector('main') as HTMLElement).append(wide);
  });
  await expect(expectNoHorizontalScroll(page)).rejects.toThrow('horizontal scroll');
  await page.evaluate(() => document.getElementById('planted-wide')?.remove());
  await expectNoHorizontalScroll(page);

  // 2. Text cut off by an overflow:hidden box never widens the page, but is still lost.
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = 'planted-clip';
    box.style.overflow = 'hidden';
    const inner = document.createElement('p');
    inner.textContent = 'Cut off planted words';
    inner.style.whiteSpace = 'nowrap';
    inner.style.marginLeft = '300px';
    box.append(inner);
    (document.querySelector('main') as HTMLElement).append(box);
  });
  await expect(expectNoHorizontalScroll(page)).rejects.toThrow('Cut off planted');
  await page.evaluate(() => document.getElementById('planted-clip')?.remove());

  // 3. Text in a fixed bar that runs past the edge.
  await page.evaluate(() => {
    const extra = document.createElement('span');
    extra.textContent = 'Fixed bar planted words';
    extra.style.position = 'fixed';
    extra.style.left = '280px';
    extra.style.bottom = '10px';
    extra.style.whiteSpace = 'nowrap';
    document.body.append(extra);
  });
  await expect(expectNoHorizontalScroll(page)).rejects.toThrow('Fixed bar planted');
});

// Largest text must not pile words on top of each other on the main screens.
const OVERLAP_SIZES = [
  { name: '320x480', width: 320, height: 480 },
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: PHONE.width, height: PHONE.height },
];
for (const viewport of OVERLAP_SIZES) {
  test(`Largest text has no overlapping words at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFresh(page);
    await setTextSize(page, 'Largest');
    const problems: string[] = [];
    for (const screen of SCREENS) {
      if (KEY_SCREENS.indexOf(screen.name) === -1) continue;
      await goToHash(page, screen.hash, screen.heading);
      await waitForAnimations(page);
      for (const problem of await findOverlappingText(page)) problems.push(`${screen.name}: ${problem}`);
      await saveScreen(page, `largest-${viewport.name}-${screen.name}`);
    }
    await openDaily(page);
    await waitForAnimations(page);
    for (const problem of await findOverlappingText(page)) problems.push(`daily round: ${problem}`);
    await saveScreen(page, `largest-${viewport.name}-daily`);
    await startEndless(page);
    await waitForAnimations(page);
    for (const problem of await findOverlappingText(page)) problems.push(`endless run: ${problem}`);
    await saveScreen(page, `largest-${viewport.name}-endless-run`);
    // Answer once when this is a choice question. Tile questions need one completed
    // answer before End run can save the run and show Game over.
    const options = page.locator('[data-option]');
    if (await options.count() > 0) await options.first().click();
    else {
      const slots = page.getByRole('group', { name: /Your word, \d+ letters/ });
      const slotLabel = await slots.getAttribute('aria-label');
      const slotCount = Number(slotLabel?.match(/(\d+) letters/)?.[1] || 0);
      const fillTiles = async () => {
        for (let i = 0; i < slotCount; i += 1) {
          await page.locator('.lt-tray button').first().click();
        }
      };
      await fillTiles();
      await expect(page.getByText(/You got it!|Not quite\. One more try!/).first()).toBeVisible();
      if (await page.getByText('Not quite. One more try!', { exact: true }).count() > 0) {
        await fillTiles();
        await expect(page.getByText(/You got it!|Here is the word/).first()).toBeVisible();
      }
    }
    await page.getByRole('button', { name: 'End run' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Game over', exact: true })).toBeAttached();
    await waitForAnimations(page);
    for (const problem of await findOverlappingText(page)) problems.push(`game over: ${problem}`);
    await saveScreen(page, `largest-${viewport.name}-game-over`);
    expect(problems).toEqual([]);
  });
}

/** Lists animations that still run longer than the reduced-motion limit. */
async function longAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const animation of document.getAnimations()) {
      const timing = animation.effect ? animation.effect.getComputedTiming() : null;
      const duration = timing && typeof timing.duration === 'number' ? timing.duration : 0;
      if (duration > 10) {
        const name = (animation as CSSAnimation).animationName || (animation as CSSTransition).transitionProperty || 'animation';
        found.push(`${name} ${Math.round(duration)}ms`);
      }
    }
    return found;
  });
}

test.describe('reduced motion', () => {
  test.use({ viewport: PHONE });

  test('the system setting turns animations off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFresh(page);
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    expect(await longAnimations(page)).toEqual([]);
    await startEndless(page);
    expect(await longAnimations(page)).toEqual([]);
  });

  test('the Me tab switch turns animations off without the system setting', async ({ page }) => {
    await openFresh(page);
    await expect(page.locator('html')).not.toHaveClass(/reduce-motion/);
    // Without the setting Play has moving parts (the mascots bob), so the check below means something.
    expect((await longAnimations(page)).length).toBeGreaterThan(0);
    await goToHash(page, '#/me', 'Me');
    const group = page.getByRole('group', { name: 'Reduced motion' });
    await group.getByRole('button', { name: 'On', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    await goToHash(page, '#/', 'Jargle');
    expect(await longAnimations(page)).toEqual([]);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  });
});

// Serious and critical axe issues on the main screens at phone size.
test.describe('accessibility', () => {
  test.use({ viewport: PHONE });

  async function axeProblems(page: Page): Promise<string[]> {
    const results = await new AxeBuilder({ page }).analyze();
    const problems: string[] = [];
    for (const violation of results.violations) {
      if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
      const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ');
      problems.push(`${violation.id}: ${targets}`);
      // Print the markup too, so a failure in CI says exactly what to fix.
      for (const node of violation.nodes.slice(0, 2)) {
        console.log(`axe ${violation.id}: ${node.html.slice(0, 300)}`);
      }
    }
    return problems;
  }

  test('main screens have no serious axe issues', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const problems: string[] = [];
    const axeScreens = ['play', 'learn', 'me', 'endless', 'lesson', 'badges', 'codeUse'];
    for (const screen of SCREENS) {
      if (axeScreens.indexOf(screen.name) === -1) continue;
      await goToHash(page, screen.hash, screen.heading);
      await waitForAnimations(page);
      for (const problem of await axeProblems(page)) problems.push(`${screen.name} ${problem}`);
    }
    await openDaily(page);
    await waitForAnimations(page);
    for (const problem of await axeProblems(page)) problems.push(`daily round ${problem}`);
    await startEndless(page);
    await waitForAnimations(page);
    for (const problem of await axeProblems(page)) problems.push(`endless run ${problem}`);
    expect(problems).toEqual([]);
  });

  test('the page has a language, a viewport meta tag and one h1 per screen', async ({ page }) => {
    await openFresh(page);
    await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    for (const screen of SCREENS) {
      await goToHash(page, screen.hash, screen.heading);
      await expect(page.locator('#root h1')).toHaveCount(1);
    }
  });

  test('tap targets in the tab bar are at least 44 px tall', async ({ page }) => {
    await openFresh(page);
    const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(tabs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }
  });
});
