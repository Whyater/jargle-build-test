import { useEffect, useState } from 'preact/hooks';
import type { ContentBundle, LocalDate, SaveState, Settings } from '../engine/types';
import { demoState, newState, todayLocal } from '../engine/api';
import { loadContent, refreshContent } from '../platform/content';
import {
  loadState,
  mergeStates,
  onWake,
  requestPersist,
  saveState,
  storageWorks,
  watchOtherTabs,
} from '../platform/storage';
import type { StorageKey } from '../platform/storage';
import { setSoundOn } from '../platform/audio';

export interface AppState {
  status: 'loading' | 'ready' | 'error';
  content: ContentBundle | null;
  save: SaveState | null;
  today: LocalDate;
  demo: 'judge' | 'new' | null;
  storageKey: StorageKey;
  canSave: boolean;
}

let app: AppState = {
  status: 'loading',
  content: null,
  save: null,
  today: '',
  demo: null,
  storageKey: 'jargle:v1',
  canSave: false,
};

const listeners = new Set<() => void>();
let stopWake: (() => void) | null = null;
let stopTabs: (() => void) | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function keyForDemo(demo: 'judge' | 'new' | null): StorageKey {
  if (demo === 'judge') return 'jargle:demo:judge';
  if (demo === 'new') return 'jargle:demo:new';
  return 'jargle:v1';
}

export function demoFromSearch(search: string): 'judge' | 'new' | null {
  try {
    const value = new URLSearchParams(search).get('demo');
    return value === 'judge' || value === 'new' ? value : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Test builds only: ?today=2026-10-30 pretends it is that day. The check on
 * VITE_DATE_OVERRIDE is a constant, so normal builds drop this code entirely.
 */
function todayOverride(search: string): LocalDate | null {
  if (import.meta.env.VITE_DATE_OVERRIDE !== '1') return null;
  try {
    const value = new URLSearchParams(search).get('today');
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

export async function initApp(): Promise<void> {
  if (stopWake) stopWake();
  if (stopTabs) stopTabs();
  stopWake = null;
  stopTabs = null;

  const demo = demoFromSearch(window.location.search);
  const storageKey = keyForDemo(demo);
  app = { ...app, status: 'loading', content: null, save: null, demo, storageKey, canSave: false };
  notify();

  try {
    let content = await loadContent();
    let today: LocalDate;
    let seed: SaveState;
    if (demo) {
      const result = demoState(demo, content);
      today = result.today;
      seed = result.state;
      content = result.content;
    } else {
      today = todayOverride(window.location.search) || todayLocal(new Date());
      seed = newState();
    }

    const saved = loadState(storageKey);
    const save = saved || seed;
    let canSave = false;
    try {
      canSave = storageWorks();
    } catch (_error) {
      canSave = false;
    }
    app = { status: 'ready', content, save, today, demo, storageKey, canSave };
    applySettings();

    if (!demo && !todayOverride(window.location.search)) {
      stopWake = onWake(() => {
        try {
          const nextToday = todayLocal(new Date());
          if (nextToday !== app.today) {
            app = { ...app, today: nextToday };
            notify();
          }
        } catch (_error) {
          app = { ...app, status: 'error' };
          notify();
        }
      });
    }
    if (!demo) {
      stopTabs = watchOtherTabs(storageKey, (incoming) => {
        if (!app.save) return;
        app = { ...app, save: mergeStates(app.save, incoming) };
        applySettings();
        notify();
      });
    }
    notify();

    // Native shells look for newer content after the first screen is up. Demos keep their
    // fixed history, so they skip this.
    if (!demo) {
      refreshContent(content)
        .then((newer) => {
          if (!newer || app.demo || app.status !== 'ready') return;
          app = { ...app, content: newer };
          notify();
        })
        .catch(() => undefined);
    }
  } catch (_error) {
    app = { ...app, status: 'error' };
    notify();
  }
}

export function getApp(): AppState {
  return app;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useApp(): AppState {
  const [, rerender] = useState(0);
  const seen = app;
  useEffect(() => {
    const stop = subscribe(() => rerender((value) => value + 1));
    // Effects run after paint, so loading may have finished before we subscribed.
    if (app !== seen) rerender((value) => value + 1);
    return stop;
  }, []);
  return app;
}

function settingsChanged(before: Settings | null, after: Settings): boolean {
  if (!before) return true;
  return before.textSize !== after.textSize || before.sound !== after.sound || before.reducedMotion !== after.reducedMotion;
}

export function commit(next: SaveState): void {
  const previous = app.save;
  const stored: SaveState = { ...next, flags: { ...next.flags } };
  app = { ...app, save: stored };
  let wrote = false;
  // Ask the browser to keep our storage once the first daily is done (asked only once).
  if (!stored.flags.persistAsked && isFirstDailyDone(stored)) {
    requestPersist();
    stored.flags.persistAsked = true;
  }
  try {
    wrote = saveState(app.storageKey, stored);
  } catch (_error) {
    wrote = false;
  }
  app = { ...app, canSave: wrote };
  if (settingsChanged(previous ? previous.settings : null, stored.settings)) applySettings();
  notify();
}

export function applySettings(): void {
  if (!app.save || typeof document === 'undefined') return;
  const settings = app.save.settings;
  const root = document.documentElement;
  root.classList.toggle('ts-large', settings.textSize === 'large');
  root.classList.toggle('ts-largest', settings.textSize === 'largest');
  let prefersReduced = false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  root.classList.toggle('reduce-motion', settings.reducedMotion || prefersReduced);
  setSoundOn(settings.sound);
}

export function restartDemo(): void {
  if (!app.demo || !app.content) return;
  try {
    const result = demoState(app.demo, app.content);
    app = { ...app, today: result.today, content: result.content };
    commit(result.state);
    window.location.hash = '#/';
  } catch (_error) {
    app = { ...app, status: 'error' };
    notify();
  }
}

export function leaveDemoHref(): string {
  return typeof location === 'undefined' ? '' : location.pathname;
}

export function isFirstDailyDone(save: SaveState): boolean {
  for (const key of Object.keys(save.rounds)) {
    const round = save.rounds[key];
    if (round.mode === 'daily' && round.counted_day !== undefined) return true;
  }
  // --- Daily Jargle (v2.1) --- a finished letter grid game counts as the first daily too.
  for (const day of Object.keys(save.jargle || {})) {
    if (save.jargle![day].status !== 'playing') return true;
  }
  return false;
}

/** Dev gallery only: show a screen with hand-made state, without loading content. */
export function setAppForDev(next: Partial<AppState>): void {
  app = { ...app, ...next };
  applySettings();
  notify();
}
