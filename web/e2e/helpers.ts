import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export interface Viewport { name: string; width: number; height: number }

// The spec's phone, landscape and desktop sizes.
export const VIEWPORTS: Viewport[] = [
  { name: '320x480', width: 320, height: 480 },
  { name: '320x568', width: 320, height: 568 },
  { name: '360x560', width: 360, height: 560 },
  { name: '375x548', width: 375, height: 548 },
  { name: '360x640', width: 360, height: 640 },
  { name: '640x360', width: 640, height: 360 },
  { name: '1280x800', width: 1280, height: 800 },
];

// The size most flow tests run at.
export const PHONE = { width: 375, height: 667 };

export type TextSize = 'Normal' | 'Large' | 'Largest';

// localStorage keys the app uses outside the main save.
export const INTRO_KEY = 'jargle:introSeen';
export const LEVEL_KEY = 'jargle:seenLevel';

/** Waits until the app has loaded its content and drawn a screen heading. */
export async function waitForReady(page: Page): Promise<void> {
  await page.locator('#root [aria-busy="true"]').waitFor({ state: 'detached' });
  // Tab roots keep their h1 visually hidden, so only wait for it to exist.
  await page.locator('#root h1').first().waitFor({ state: 'attached' });
}

/**
 * Opens the real app (not a demo). Every test gets a new browser context, so the save starts
 * empty. By default the first-run intro is marked as seen so the test lands straight on Play.
 * Pass intro: true to see the intro.
 */
export async function openFresh(page: Page, options: { intro?: boolean; hash?: string } = {}): Promise<void> {
  if (!options.intro) {
    await page.addInitScript(() => {
      window.localStorage.setItem('jargle:introSeen', '1');
    });
  }
  await page.goto('/' + (options.hash || '#/'));
  await waitForReady(page);
}

/** Opens a demo save ('judge' has 8 days of history, 'new' is a new player). */
export async function openDemo(page: Page, demo: 'judge' | 'new', hash = '#/'): Promise<void> {
  await page.goto(`/?demo=${demo}${hash}`);
  await waitForReady(page);
}

/**
 * Changes the hash in place (no reload) and waits for the new screen. Pass the screen's h1 text
 * to prove the right screen opened: the old screen's h1 would satisfy a plain wait.
 */
export async function goToHash(page: Page, hash: string, heading?: string): Promise<void> {
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash;
  }, hash);
  await waitForReady(page);
  if (heading) {
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeAttached();
  }
}

/** Taps one of the bottom tabs: Play, Learn or Me. */
export async function openTab(page: Page, name: 'Play' | 'Learn' | 'Me'): Promise<void> {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();
  await waitForReady(page);
}

/** Picks a text size in the Me tab's settings, then goes back to Play. */
export async function setTextSize(page: Page, size: TextSize): Promise<void> {
  await goToHash(page, '#/me');
  const group = page.getByRole('group', { name: 'Text size' });
  const button = group.getByRole('button', { name: size, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await goToHash(page, '#/');
}

/** Today's date as the page sees it, like 2026-10-28. */
export async function pageToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  });
}

// Just the parts of content/bundle.json the tests read.
export interface BundleItem {
  term: string;
  meaning: string;
  old_tech?: boolean;
  clues: string[];
  decoys: { term: string; meaning: string }[];
}

export interface Bundle {
  items: Record<string, BundleItem>;
  schedule: { days: { date: string; term: string }[] };
  lessons: unknown[];
}

/** Downloads the same content bundle the app plays with, so tests can know the right answers. */
export async function loadBundle(page: Page): Promise<Bundle> {
  const response = await page.request.get('/content/bundle.json');
  expect(response.ok()).toBe(true);
  return (await response.json()) as Bundle;
}

/** Finds a content item by its term (the word players guess). */
export function itemByTerm(bundle: Bundle, term: string): BundleItem | null {
  for (const id of Object.keys(bundle.items)) {
    if (bundle.items[id].term === term) return bundle.items[id];
  }
  return null;
}

/**
 * Fails when the page scrolls sideways, or when any visible text is drawn past the left or right
 * edge. The second check catches text that a fixed bar or an overflow:hidden box cuts off, which
 * never makes the page wider.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const details = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const width = document.documentElement.scrollWidth;
    const outside: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && outside.length < 5) {
      const text = (node.textContent || '').trim();
      const owner = node.parentElement;
      if (text && owner && !owner.closest('.visually-hidden, script, style')) {
        let hidden = false;
        let current: Element | null = owner;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) hidden = true;
          current = current.parentElement;
        }
        if (!hidden) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width < 1 || rect.height < 1) continue;
            if (rect.right > viewport + 1 || rect.left < -1) {
              const className = typeof owner.className === 'string' ? owner.className : '';
              outside.push(`<${owner.tagName.toLowerCase()}> class="${className}" '${text.slice(0, 40)}' left=${Math.round(rect.left)} right=${Math.round(rect.right)}`);
              break;
            }
          }
        }
      }
      node = walker.nextNode();
    }
    return { viewport, width, outside };
  });
  if (details.width > details.viewport || details.outside.length > 0) {
    const causes = details.outside.length > 0 ? details.outside.join('; ') : 'no visible text identified';
    throw new Error(`horizontal scroll or cut-off text (page ${details.width} wide, screen ${details.viewport}): ${causes}`);
  }
}

/**
 * Lists pairs of visible text runs that sit on top of each other. Each text node is measured
 * with a Range, so long blocks are judged by their real lines and not their full box.
 * Text in fixed or sticky bars is compared only with other bar text, because the page content
 * scrolls under those bars on purpose. If almost no text was measured, that is reported too,
 * so a broken check cannot pass by measuring nothing.
 */
export async function findOverlappingText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    interface Run { text: string; rects: DOMRect[]; pinned: boolean }
    const runs: Run[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = (node.textContent || '').trim();
      const owner = node.parentElement;
      if (text && owner && !owner.closest('.visually-hidden, script, style, svg')) {
        let hidden = false;
        let pinned = false;
        let current: Element | null = owner;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (style.position === 'fixed' || style.position === 'sticky') pinned = true;
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) hidden = true;
          current = current.parentElement;
        }
        if (!hidden) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1);
          if (rects.length > 0) runs.push({ text: text.slice(0, 30), rects, pinned });
        }
      }
      node = walker.nextNode();
    }
    const problems: string[] = [];
    if (runs.length < 3) problems.push(`only ${runs.length} text runs were measured`);
    for (let i = 0; i < runs.length; i += 1) {
      for (let j = i + 1; j < runs.length; j += 1) {
        if (runs[i].pinned !== runs[j].pinned) continue;
        let hit = false;
        for (const a of runs[i].rects) {
          for (const b of runs[j].rects) {
            // A text box runs from the font's top to its bottom, which is taller than the letters
            // (very tall for big score numbers). Trim it to roughly where the letters are drawn.
            const aTop = a.top + a.height * 0.2;
            const aBottom = a.bottom - a.height * 0.15;
            const bTop = b.top + b.height * 0.2;
            const bBottom = b.bottom - b.height * 0.15;
            const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const down = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
            if (across > 3 && down > 2) hit = true;
          }
        }
        if (hit) problems.push(`'${runs[i].text}' overlaps '${runs[j].text}'`);
        if (problems.length >= 8) return problems;
      }
    }
    return problems;
  });
}

/** Waits for running CSS animations to finish (up to 3 s) so a layout check is not mid-flip. */
export async function waitForAnimations(page: Page): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const animations = document.getAnimations ? document.getAnimations() : [];
      return animations.every((animation) => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity);
    }, undefined, { timeout: 3000 });
  } catch (_error) {
    // Measure anyway, but leave a note in the report so a mid-animation result can be spotted.
    console.log(`animations still running after 3 s on ${page.url()}`);
  }
}

/** Saves a full-page screenshot into the CI artifact folder. */
export async function saveScreen(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `e2e/.output/screens/${name}.png`, fullPage: true });
}
