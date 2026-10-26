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

// Every screen a player can reach by hash, checked at every size.
const SCREENS = [
  { name: 'play', hash: '#/' },
  { name: 'learn', hash: '#/learn' },
  { name: 'me', hash: '#/me' },
  { name: 'endless', hash: '#/endless' },
  { name: 'settings', hash: '#/settings' },
  { name: 'how', hash: '#/how' },
  { name: 'about', hash: '#/about' },
  { name: 'review', hash: '#/review' },
  { name: 'practice', hash: '#/practice' },
  { name: 'oldtech', hash: '#/oldtech' },
  { name: 'badges', hash: '#/badges' },
  { name: 'code', hash: '#/code' },
  { name: 'codeUse', hash: '#/code/use' },
  { name: 'get', hash: '#/get' },
  { name: 'lesson', hash: '#/lesson/make-a-strong-password' },
  { name: 'notFound', hash: '#/no-such-page' },
];

/** Opens today's daily round from the Word of the Day card. */
async function openDaily(page: Page): Promise<void> {
  await goToHash(page, '#/');
  await page.getByRole('region', { name: 'Word of the Day' }).getByRole('button', { name: /^(Play|Continue)$/ }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).waitFor({ state: 'visible' });
}

/** Opens Endless and starts a run, then waits for the first question's answer buttons. */
async function startEndless(page: Page): Promise<void> {
  await goToHash(page, '#/endless');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'End run' }).waitFor({ state: 'visible' });
  await page.locator('[data-option]').first().waitFor({ state: 'visible' });
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
        await goToHash(page, screen.hash);
        await checkScreen(page, screen.name);
      }
      await openDaily(page);
      await checkScreen(page, 'daily round');
      await startEndless(page);
      await checkScreen(page, 'endless run');
    });
  }
}

// Largest text must not pile words on top of each other on the main screens.
const OVERLAP_SIZES = [
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
    const keyScreens = ['#/', '#/learn', '#/me', '#/endless', '#/lesson/make-a-strong-password', '#/how'];
    for (const hash of keyScreens) {
      await goToHash(page, hash);
      await waitForAnimations(page);
      for (const problem of await findOverlappingText(page)) problems.push(`${hash}: ${problem}`);
      await saveScreen(page, `largest-${viewport.name}-${hash.replace(/[#/]/g, '') || 'play'}`);
    }
    await openDaily(page);
    await waitForAnimations(page);
    for (const problem of await findOverlappingText(page)) problems.push(`daily round: ${problem}`);
    await saveScreen(page, `largest-${viewport.name}-daily`);
    await startEndless(page);
    await waitForAnimations(page);
    for (const problem of await findOverlappingText(page)) problems.push(`endless run: ${problem}`);
    await saveScreen(page, `largest-${viewport.name}-endless-run`);
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
    await goToHash(page, '#/me');
    const group = page.getByRole('group', { name: 'Reduced motion' });
    await group.getByRole('button', { name: 'On', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    await goToHash(page, '#/');
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
    }
    return problems;
  }

  test('main screens have no serious axe issues', async ({ page }) => {
    test.setTimeout(60000);
    await openFresh(page);
    const problems: string[] = [];
    for (const hash of ['#/', '#/learn', '#/me', '#/endless', '#/lesson/make-a-strong-password', '#/badges', '#/code/use']) {
      await goToHash(page, hash);
      await waitForAnimations(page);
      for (const problem of await axeProblems(page)) problems.push(`${hash} ${problem}`);
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
    for (const hash of ['#/', '#/learn', '#/me', '#/endless']) {
      await goToHash(page, hash);
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
