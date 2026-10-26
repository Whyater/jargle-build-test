import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INTRO_KEY,
  countdownText,
  fallbackLevel,
  greetingFor,
  shouldCelebrateLevel,
  introSeen,
  judgeLineVisible,
  markIntroSeen,
  msUntilTomorrow,
  readEndlessBest,
  readXp,
  todayItemId,
  wotdState,
} from './homeLogic';
import type { ContentBundle, SaveState } from '../../engine/types';
import type { HomeView } from '../../engine/api';

const content = {
  schedule: { days: [{ date: '2026-10-26', term: 'first', rerun: false }] },
} as ContentBundle;
describe('home helpers', () => {
  it('finds the scheduled item', () => {
    expect(todayItemId(content, '2026-10-26')).toBe('first');
    expect(todayItemId(content, '2026-10-27')).toBe(null);
  });
  it('hides the judge link in judge demo', () => {
    expect(judgeLineVisible(true, null)).toBe(true);
    expect(judgeLineVisible(true, 'judge')).toBe(false);
  });

  it('counts down to the next local midnight', () => {
    const now = new Date(2026, 9, 25, 23, 59, 30);
    expect(msUntilTomorrow(now)).toBe(30 * 1000);
  });

  it('formats countdown minutes and hours', () => {
    expect(countdownText(0)).toBe('1m');
    expect(countdownText(59 * 1000)).toBe('1m');
    expect(countdownText(61 * 60 * 1000)).toBe('1h 1m');
    expect(countdownText(-10)).toBe('1m');
  });

  it('reads optional progress fields defensively', () => {
    const base = {} as SaveState;
    expect(readXp({ ...base, xp: 12.9 } as SaveState)).toBe(12);
    expect(readXp({ ...base, xp: -1 } as SaveState)).toBe(0);
    expect(readXp({ ...base, xp: Number.NaN } as SaveState)).toBe(0);
    expect(readEndlessBest({ ...base, endlessBest: 8.8 } as SaveState)).toBe(8);
    expect(readEndlessBest(base)).toBe(0);
  });

  it('uses the fallback level curve at boundaries', () => {
    expect(fallbackLevel(0)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
    expect(fallbackLevel(29)).toEqual({ level: 1, intoLevel: 29, needed: 30 });
    expect(fallbackLevel(30)).toEqual({ level: 2, intoLevel: 0, needed: 50 });
    expect(fallbackLevel(79)).toEqual({ level: 2, intoLevel: 49, needed: 50 });
    expect(fallbackLevel(80)).toEqual({ level: 3, intoLevel: 0, needed: 70 });
  });

  it('describes the word of the day state', () => {
    const save = { rounds: {} } as SaveState;
    const view = (today: HomeView['today']) => ({ today }) as HomeView;
    expect(wotdState(view(null), save)).toEqual({ kind: 'none' });
    expect(wotdState(view({ day: 1, key: 'd:1', started: false, finished: false }), save)).toEqual({ kind: 'play' });
    expect(wotdState(view({ day: 1, key: 'd:1', started: true, finished: false }), save)).toEqual({ kind: 'continue' });
    save.rounds['d:1'] = { status: 'solved', end_bars: 2 } as SaveState['rounds'][string];
    expect(wotdState(view({ day: 1, key: 'd:1', started: true, finished: true }), save)).toEqual({
      kind: 'solved',
      bars: 2,
    });
    save.rounds['d:1'] = { status: 'learned' } as SaveState['rounds'][string];
    expect(wotdState(view({ day: 1, key: 'd:1', started: true, finished: true }), save)).toEqual({ kind: 'missed' });
  });
});

describe('intro flag', () => {
  const originalStorage = globalThis.localStorage;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  });

  it('reads and marks the flag', () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    expect(introSeen()).toBe(false);
    markIntroSeen();
    expect(values.get(INTRO_KEY)).toBe('1');
    expect(introSeen()).toBe(true);
  });

  it('fails open when storage throws or is unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(introSeen()).toBe(true);
    expect(() => markIntroSeen()).not.toThrow();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    expect(introSeen()).toBe(true);
  });
});

describe('greetings and level-ups', () => {
  it('cheers a solved word with Bud', () => {
    const line = greetingFor('solved', 0, 9);
    expect(line.who).toBe('bud');
    expect(line.text).toContain('Endless');
  });

  it('mentions the streak when it is 2 or more', () => {
    expect(greetingFor('play', 4, 9).text).toBe('4 days in a row! Keep it going.');
  });

  it('says good morning, afternoon or evening by the hour', () => {
    expect(greetingFor('play', 0, 8).text).toContain('Good morning!');
    expect(greetingFor('play', 0, 13).text).toContain('Good afternoon!');
    expect(greetingFor('play', 0, 21).text).toContain('Good evening!');
    expect(greetingFor('play', 0, 2).text).toContain('Good evening!');
  });

  it('never uses an em dash', () => {
    const kinds = ['play', 'continue', 'solved', 'missed', 'none'] as const;
    for (const kind of kinds) {
      expect(greetingFor(kind, 0, 10).text.indexOf('\u2014')).toBe(-1);
    }
  });

  it('celebrates only a real level climb', () => {
    expect(shouldCelebrateLevel(0, 3)).toBe(false);
    expect(shouldCelebrateLevel(2, 2)).toBe(false);
    expect(shouldCelebrateLevel(2, 3)).toBe(true);
    expect(shouldCelebrateLevel(3, 2)).toBe(false);
  });
});
