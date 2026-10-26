// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const serviceWorkerCode = readFileSync(`${process.cwd()}/public/sw.js`, 'utf8');

type Handler = (event: any) => void;

function makeWorker(fetchMock: ReturnType<typeof vi.fn>, rejectPut = false) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        put: async (request: string | Request, response: Response) => {
          if (rejectPut) throw new Error('cache write failed');
          const key = typeof request === 'string' ? request : request.url;
          store.set(key, response);
        },
        match: async (request: string | Request) => {
          const key = typeof request === 'string' ? request : request.url;
          return store.get(key);
        },
      };
    }),
    match: async (request: string | Request) => {
      const key = typeof request === 'string' ? request : request.url;
      for (const store of stores.values()) {
        const response = store.get(key);
        if (response) return response;
      }
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { search: '?v=test', href: 'https://example.test/sw.js?v=test', origin: 'https://example.test' },
    addEventListener: (name: string, handler: Handler) => { handlers[name] = handler; },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };

  new Function('self', 'caches', 'fetch', serviceWorkerCode)(self, caches, fetchMock);
  return { handlers, caches };
}

function response(text: string, status = 200): Response {
  const result = new Response(text, { status, headers: { 'content-type': 'text/html' } });
  Object.defineProperty(result, 'type', { value: 'basic' });
  return result;
}

describe('service worker', () => {
  it('fetches index.html once during install', async () => {
    const fetchMock = vi.fn(async (url: string) => response(url === './index.html' ? '<html></html>' : ''));
    const { handlers } = makeWorker(fetchMock);
    let installPromise: Promise<unknown> | undefined;
    handlers.install({ waitUntil: (promise: Promise<unknown>) => { installPromise = promise; } });

    await installPromise;

    expect(fetchMock.mock.calls.filter(([url]) => url === './index.html')).toHaveLength(1);
  });

  it('updates the index cache after a successful navigation', async () => {
    const fetchMock = vi.fn(async () => response('<html>new</html>'));
    const { handlers, caches } = makeWorker(fetchMock);
    let navigationResponse: Promise<Response> | undefined;
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://example.test/play' },
      respondWith: (promise: Promise<Response>) => { navigationResponse = promise; },
    });

    await navigationResponse;
    const cache = await caches.open('jargle-test');
    const cached = await cache.match('./index.html');
    expect(cached).toBeDefined();
    expect(await cached!.text()).toBe('<html>new</html>');
  });

  it('returns the fresh navigation response when cache writes fail', async () => {
    const fetchMock = vi.fn(async () => response('<html>fresh</html>'));
    const { handlers } = makeWorker(fetchMock, true);
    let navigationResponse: Promise<Response> | undefined;
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://example.test/play' },
      respondWith: (promise: Promise<Response>) => { navigationResponse = promise; },
    });

    expect(await (await navigationResponse)!.text()).toBe('<html>fresh</html>');
  });

  it('serves the cached index when navigation is offline', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    const { handlers, caches } = makeWorker(fetchMock);
    const cache = await caches.open('jargle-test');
    await cache.put('./index.html', response('<html>cached</html>'));
    let navigationResponse: Promise<Response> | undefined;
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: 'https://example.test/play' },
      respondWith: (promise: Promise<Response>) => { navigationResponse = promise; },
    });

    expect(await (await navigationResponse)!.text()).toBe('<html>cached</html>');
  });
});
