import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PHONE, openFresh, waitForReady } from './helpers';

test.use({ viewport: PHONE });

/** Collects errors and failed requests, so an offline failure says what went wrong. */
function collectDiagnostics(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      lines.push(`[console error] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    lines.push(`[pageerror] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    lines.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  });
  return lines;
}

function diagnosticText(lines: string[]): string {
  if (lines.length === 0) return '(no diagnostics captured)';
  return lines.slice(0, 15).join('\n');
}

/** Waits until the service worker controls the page and has cached the app shell and the words. */
async function prepareServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is not controlled yet; after a reload it is.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const cacheName = keys.find((key) => key.indexOf('jargle-') === 0);
    if (!cacheName) return false;
    const cache = await caches.open(cacheName);
    const shell = await cache.match('./index.html');
    const bundle = await cache.match('./content/bundle.json');
    return Boolean(shell && bundle);
  });
}

/** The app's own script must be cached too, or an offline reload shows a blank page. */
async function expectModuleScriptCached(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
    if (!script) return { url: '(missing module script)', cached: false };
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      if (await cache.match(script.src)) return { url: script.src, cached: true };
    }
    return { url: script.src, cached: false };
  });
  expect(result.cached, `module script ${result.url} is not cached`).toBe(true);
}

async function waitForOfflineScreen(page: Page, lines: string[]): Promise<void> {
  try {
    await waitForReady(page);
  } catch (error) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '(no page)');
    throw new Error(`offline screen did not load: ${body}\n${error}\nDiagnostics:\n${diagnosticText(lines)}`);
  }
}

test.describe('offline', () => {
  // The service worker can take up to 15 s to take control, so allow more than the default.
  test.describe.configure({ timeout: 60000 });

  test('a cached app reloads Play offline and Endless still works', async ({ page, context }) => {
    await openFresh(page);
    await prepareServiceWorker(page);
    const lines = collectDiagnostics(page);
    await expectModuleScriptCached(page);

    await context.setOffline(true);
    try {
      const response = await page.reload();
      // Offline, only the service worker can answer the reload.
      expect(response?.fromServiceWorker()).toBe(true);
      await waitForOfflineScreen(page, lines);
      const endlessLink = page.getByRole('link', { name: 'Play Endless', exact: true });
      await expect(endlessLink).toBeVisible();
      await endlessLink.click();
      await expect(page.getByRole('heading', { name: 'Endless', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      const options = page.locator('[data-option]');
      if (await options.count() > 0) {
        await expect(options.first()).toBeVisible();
        await options.first().click();
      } else {
        const tiles = page.locator('.lt-tray .lt-tile');
        await expect(tiles.first()).toBeVisible();
        const tileCount = await tiles.count();
        for (let i = 0; i < tileCount; i += 1) {
          if (await tiles.count() === 0) break;
          await tiles.first().click();
        }
      }
      // Any answer locks the controls, which shows the run took the answer while offline.
      // (A right answer moves on after about 900 ms, so check right away.)
      await expect(page.locator('[data-option][aria-disabled="true"], .lt-tile[aria-disabled="true"]').first()).toBeAttached();
    } catch (error) {
      throw new Error(`${error}\nDiagnostics:\n${diagnosticText(lines)}`);
    } finally {
      await context.setOffline(false);
    }
  });

  test('the daily game page reloads offline', async ({ page, context }) => {
    await openFresh(page);
    await prepareServiceWorker(page);
    const lines = collectDiagnostics(page);
    await expectModuleScriptCached(page);

    const wordCard = page.getByRole('region', { name: 'Word of the Day' });
    await wordCard.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Keyboard' })).toBeVisible();
    const dailyUrl = page.url();

    await context.setOffline(true);
    try {
      await page.goto(dailyUrl);
      // Going to the same URL only changes the hash, so reload to load the page again from the cache.
      const response = await page.reload();
      expect(response?.fromServiceWorker()).toBe(true);
      await waitForOfflineScreen(page, lines);
      await expect(page.getByRole('group', { name: 'Keyboard' })).toBeVisible();
    } catch (error) {
      throw new Error(`${error}\nDiagnostics:\n${diagnosticText(lines)}`);
    } finally {
      await context.setOffline(false);
    }
  });
});
