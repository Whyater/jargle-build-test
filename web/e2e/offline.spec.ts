import { expect, test } from '@playwright/test';
import { openDemo, startTodaysRound, waitForReady } from './helpers';

type OfflinePage = Parameters<typeof openDemo>[0];

function collectOfflineDiagnostics(page: OfflinePage): string[] {
  const diagnostics: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`[console error] ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    diagnostics.push(`[pageerror] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    diagnostics.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || 'unknown failure'}`);
  });
  page.on('response', (response) => {
    if (response.url().includes('/assets/')) {
      diagnostics.push(`[asset response] ${response.status()} ${response.url()} fromServiceWorker=${response.fromServiceWorker()}`);
    }
  });
  return diagnostics;
}

async function expectModuleScriptCached(page: OfflinePage): Promise<void> {
  const result = await page.evaluate(async () => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
    const scriptUrl = script?.src || '(no module script found)';
    if (!script) return { scriptUrl, cached: false };
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      if (await cache.match(script.src)) return { scriptUrl, cached: true };
    }
    return { scriptUrl, cached: false };
  });
  expect(result.cached, `module script ${result.scriptUrl} is not present in Cache Storage`).toBe(true);
}

function diagnosticText(diagnostics: string[]): string {
  if (diagnostics.length === 0) return '(no diagnostics captured)';
  return diagnostics
    .slice(0, 15)
    .map((line) => line.replace(/\s+/g, ' ').trim().slice(0, 240))
    .join('\n');
}

async function prepareServiceWorker(page: Parameters<typeof openDemo>[0]): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return false;
    const keys = await caches.keys();
    const cacheName = keys.find((key) => key.indexOf('jargle-') === 0);
    if (!cacheName) return false;
    const cache = await caches.open(cacheName);
    const shell = await cache.match('./index.html');
    const bundle = await cache.match('./content/bundle.json');
    return Boolean(shell && bundle);
  });
}

// Waits for a real screen; if none shows, the error includes what the page did show.
async function waitForOfflineScreen(page: OfflinePage, diagnostics: string[]): Promise<void> {
  try {
    await waitForReady(page);
  } catch (error) {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '(no page)');
    throw new Error(`no screen loaded offline. Page text: ${text}\nDiagnostics:\n${diagnosticText(diagnostics)}`);
  }
}

test.describe('offline app shell', () => {
  test('judge demo loads and plays offline', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openDemo(page, 'judge');
    await prepareServiceWorker(page);
    const diagnostics = collectOfflineDiagnostics(page);
    await expectModuleScriptCached(page);

    await context.setOffline(true);
    try {
      await page.reload();
      await waitForOfflineScreen(page, diagnostics);
      await expect(page.getByText(/^Days learned:/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: "Play today's word", exact: true })).toBeVisible();
      await startTodaysRound(page);
      await page.getByRole('button', { name: /Claude/ }).click();
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      await expect(page.getByText(/^You learned Claude\. Solved with \d+ bars? left\.$/)).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('new demo home and round open offline', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openDemo(page, 'new');
    await prepareServiceWorker(page);
    const diagnostics = collectOfflineDiagnostics(page);
    await expectModuleScriptCached(page);

    await context.setOffline(true);
    try {
      await page.reload();
      await waitForOfflineScreen(page, diagnostics);
      await startTodaysRound(page);
    } finally {
      await context.setOffline(false);
    }
  });
});

