// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNativeShell, loadContent, refreshContent } from './content';
import type { ContentBundle } from '../engine/types';

function bundle(version: number): ContentBundle {
  return {
    version,
    items: {},
    lessons: [],
    oldTech: [],
    ptpExtras: [],
    schedule: { version: 1, days: [] },
    missLines: { either: [], floyd: [] },
    commonWords: [],
  };
}

function reply(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  delete (window as Window & { Capacitor?: unknown }).Capacitor;
});

describe('loadContent', () => {
  it('loads the bundled web copy', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(bundle(5)));
    await expect(loadContent()).resolves.toEqual(bundle(5));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('content/bundle.json');
  });

  it('never asks a remote server at startup, even in a native shell', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(bundle(5)));
    await loadContent();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('content/bundle.json');
  });

  it('starts with a saved download when it is newer than the bundled copy', async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    window.localStorage.setItem('jargle:content', JSON.stringify(bundle(9)));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(bundle(5)));
    await expect(loadContent()).resolves.toEqual(bundle(9));
  });

  it('ignores an older saved download', async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    window.localStorage.setItem('jargle:content', JSON.stringify(bundle(3)));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(bundle(5)));
    await expect(loadContent()).resolves.toEqual(bundle(5));
  });

  it('throws when there is no copy at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(loadContent()).rejects.toThrow('content');
  });

  it('detects native shells', () => {
    expect(isNativeShell()).toBe(false);
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    expect(isNativeShell()).toBe(true);
  });
});

describe('refreshContent', () => {
  it('does nothing on the website', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(refreshContent(bundle(5))).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps and saves the newest remote bundle', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(bundle(7)))
      .mockResolvedValueOnce(reply(bundle(8)));
    await expect(refreshContent(bundle(5))).resolves.toEqual(bundle(8));
    expect(JSON.parse(window.localStorage.getItem('jargle:content') || 'null')).toEqual(bundle(8));
  });

  it('tries the next server when one fails or sends a bad file', async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"version":"bad"}', { status: 200 }))
      .mockResolvedValueOnce(reply(bundle(6)));
    await expect(refreshContent(bundle(5))).resolves.toEqual(bundle(6));
  });

  it('rejects malformed bundles and does not save them', async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply({ ...bundle(7), items: [] }))
      .mockResolvedValueOnce(reply(bundle(6)));
    await expect(refreshContent(bundle(5))).resolves.toEqual(bundle(6));
    expect(JSON.parse(window.localStorage.getItem('jargle:content') || 'null')).toEqual(bundle(6));
  });

  it('returns null when nothing newer is out there', async () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {};
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(bundle(5)));
    await expect(refreshContent(bundle(5))).resolves.toBeNull();
    expect(window.localStorage.getItem('jargle:content')).toBeNull();
  });
});
