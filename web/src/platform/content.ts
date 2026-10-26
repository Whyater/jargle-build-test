import { contentUrls } from '../config';
import type { ContentBundle } from '../engine/types';

/** A downloaded bundle saved for the next launch (native shells only). */
const SAVED_KEY = 'jargle:content';

function isBundle(value: unknown): value is ContentBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const bundle = value as Record<string, unknown>;
  if (typeof bundle.version !== 'number') return false;
  if (!bundle.items || typeof bundle.items !== 'object' || Array.isArray(bundle.items)) return false;
  if (!Array.isArray(bundle.lessons)) return false;
  if (!Array.isArray(bundle.oldTech)) return false;
  if (!Array.isArray(bundle.ptpExtras)) return false;
  if (!Array.isArray(bundle.commonWords)) return false;
  const schedule = bundle.schedule;
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return false;
  const days = (schedule as { days?: unknown }).days;
  if (!Array.isArray(days)) return false;
  for (const day of days) {
    if (!day || typeof day !== 'object') return false;
    if (typeof (day as { date?: unknown }).date !== 'string') return false;
    if (typeof (day as { term?: unknown }).term !== 'string') return false;
  }
  const missLines = bundle.missLines;
  if (!missLines || typeof missLines !== 'object' || Array.isArray(missLines)) return false;
  const miss = missLines as { either?: unknown; floyd?: unknown };
  return Array.isArray(miss.either) && Array.isArray(miss.floyd);
}

export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as Window & { __TAURI_INTERNALS__?: unknown; Capacitor?: unknown };
  return !!win.__TAURI_INTERNALS__ || !!win.Capacitor;
}

function parseResponse(response: Response): Promise<ContentBundle> {
  if (!response || ('ok' in response && !response.ok)) return Promise.reject(new Error('content'));
  return response.json().then((value: unknown) => {
    if (!isBundle(value)) throw new Error('content');
    return value;
  });
}

function fetchWithTimeout(url: string, useCache: boolean, timeoutMs: number): Promise<ContentBundle> {
  const options: RequestInit = useCache ? { cache: 'no-cache' } : {};
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    options.signal = controller.signal;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, options).then(parseResponse).finally(() => window.clearTimeout(timer));
  }
  const timer = new Promise<never>((_resolve, reject) => {
    window.setTimeout(() => reject(new Error('content')), timeoutMs);
  });
  return Promise.race([fetch(url, options).then(parseResponse), timer]);
}

function loadSaved(): ContentBundle | null {
  try {
    const text = window.localStorage.getItem(SAVED_KEY);
    if (!text) return null;
    const value: unknown = JSON.parse(text);
    return isBundle(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

function saveBundle(bundle: ContentBundle): void {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(bundle));
  } catch (_error) {
    // Storage full or blocked: the app still works with the bundled copy.
  }
}

/**
 * The content to start with. Always the copy that ships with the app (never waits on the
 * internet), unless a native shell saved a newer download last time.
 */
export async function loadContent(): Promise<ContentBundle> {
  const native = isNativeShell();
  let bundled: ContentBundle | null = null;
  try {
    bundled = await fetchWithTimeout('content/bundle.json', !native, 4000);
  } catch (_error) {
    bundled = null;
  }
  const saved = native ? loadSaved() : null;
  if (bundled && saved && saved.version > bundled.version) return saved;
  if (bundled) return bundled;
  if (saved) return saved;
  throw new Error('content');
}

/**
 * Native shells only: ask each server for its bundle (3 seconds each) and keep the newest.
 * Returns it (already saved for next launch) if it is newer than `current`, else null.
 * The website doesn't need this: its own bundled copy is always the latest.
 */
export async function refreshContent(current: ContentBundle): Promise<ContentBundle | null> {
  if (!isNativeShell()) return null;
  let best: ContentBundle | null = null;
  for (let i = 0; i < contentUrls.length; i++) {
    try {
      const remote = await fetchWithTimeout(contentUrls[i], false, 3000);
      if (remote.version > current.version && (!best || remote.version > best.version)) best = remote;
    } catch (_error) {
      // Offline or the server is down: try the next one.
    }
  }
  if (best) saveBundle(best);
  return best;
}
