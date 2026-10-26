// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { SaveState } from '../engine/types';
import { loadState, mergeStates, saveState, watchOtherTabs } from './storage';

function state(): SaveState {
  return {
    v: 1,
    rounds: {},
    ptpSet: null,
    ptpTotal: 0,
    ptpBest: 0,
    firstPlayDay: null,
    review: {},
    reviewSeen: {},
    lessons: {},
    badges: {},
    missLineIndex: { floyd: 0, bud: 0 },
    settings: { textSize: 'normal', sound: true, reducedMotion: false },
    flags: { firstRoundDone: false, textSizeAsked: false, inAppNoteHidden: false, persistAsked: false },
    countedDays: [],
    finishedDays: [],
    soloDone: [],
    lastFinished: {},
    missLineQueue: { floyd: [], bud: [] },
  };
}

function round(status: 'playing' | 'solved' | 'learned', k: number, post_step: number, finished_on?: string) {
  return { item_id: 'one', mode: 'daily' as const, started_on: '2026-01-01', k, spent: [], selected: null, status, post_step, miss_line: null, replay: false, finished_on };
}

describe('storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves and loads a state', () => {
    const value = state();
    expect(saveState('jargle:v1', value)).toBe(true);
    expect(loadState('jargle:v1')).toEqual(value);
  });

  it('returns null for corrupt or wrong-version data', () => {
    window.localStorage.setItem('jargle:v1', '{bad');
    expect(loadState('jargle:v1')).toBeNull();
    window.localStorage.setItem('jargle:v1', JSON.stringify({ v: 2 }));
    expect(loadState('jargle:v1')).toBeNull();
  });

  it('fills missing and wrong-typed fields from defaults while keeping valid fields', () => {
    window.localStorage.setItem('jargle:v1', JSON.stringify({ v: 1, ptpTotal: 7, settings: { textSize: 'large', sound: false, reducedMotion: true }, flags: { firstRoundDone: true } }));
    const loaded = loadState('jargle:v1');
    expect(loaded?.ptpTotal).toBe(7);
    expect(loaded?.settings).toEqual({ textSize: 'large', sound: false, reducedMotion: true });
    expect(loaded?.flags.firstRoundDone).toBe(true);
    expect(loaded?.rounds).toEqual({});
    expect(loaded?.countedDays).toEqual([]);
    expect(loaded?.missLineQueue).toEqual({ floyd: [], bud: [] });
  });

  it('returns false when storage throws', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { setItem: () => { throw new Error('blocked'); }, getItem: () => null, removeItem: () => undefined } });
    expect(saveState('jargle:v1', state())).toBe(false);
    Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
  });

  it('merges rounds, totals, flags, and badges without mutating inputs', () => {
    const mine = state();
    const theirs = state();
    mine.rounds.one = round('playing', 2, 1);
    theirs.rounds.one = round('solved', 1, 0, '2026-01-02');
    mine.badges = { 'week-one': '2026-01-04' };
    theirs.badges = { 'week-one': '2026-01-03' };
    mine.ptpTotal = 2;
    theirs.ptpTotal = 5;
    mine.flags.firstRoundDone = true;
    theirs.flags.persistAsked = true;
    const before = JSON.stringify(mine);
    const merged = mergeStates(mine, theirs);
    expect(merged.rounds.one.status).toBe('solved');
    expect(merged.badges['week-one']).toBe('2026-01-03');
    expect(merged.ptpTotal).toBe(5);
    expect(merged.flags.firstRoundDone).toBe(true);
    expect(merged.flags.persistAsked).toBe(true);
    expect(JSON.stringify(mine)).toBe(before);
  });

  it('lets the more progressed playing round win', () => {
    const mine = state();
    const theirs = state();
    mine.rounds.one = round('playing', 1, 0);
    theirs.rounds.one = { ...round('playing', 2, 0), spent: ['x'] };
    expect(mergeStates(mine, theirs).rounds.one.k).toBe(2);
  });

  it('merges optional progress fields and same-set pass-the-phone progress', () => {
    const mine = state();
    const theirs = state();
    mine.countedDays = [3, 1];
    theirs.countedDays = [2, 3];
    mine.finishedDays = [4];
    theirs.finishedDays = [2];
    mine.soloDone = ['a'];
    theirs.soloDone = ['b'];
    mine.lastFinished = { a: '2026-01-03' };
    theirs.lastFinished = { a: '2026-01-04', b: '2026-01-01' };
    mine.missLineQueue = { floyd: [1], bud: [2] };
    theirs.missLineQueue = { floyd: [3], bud: [4] };
    mine.ptpSet = { id: 2, rounds: ['a', 'b'], r: 1, done: false };
    theirs.ptpSet = { id: 2, rounds: ['c', 'd'], r: 3, done: true };
    const merged = mergeStates(mine, theirs);
    expect(merged.countedDays).toEqual([1, 2, 3]);
    expect(merged.finishedDays).toEqual([2, 4]);
    expect(merged.soloDone).toEqual(['a', 'b']);
    expect(merged.lastFinished).toEqual({ a: '2026-01-04', b: '2026-01-01' });
    expect(merged.missLineQueue).toEqual({ floyd: [1], bud: [2] });
    expect(merged.ptpSet).toEqual({ id: 2, rounds: ['a', 'b'], r: 3, done: true });
  });

  it('keeps local settings until an incoming saved state is newer', () => {
    const mine = state();
    const theirs = state();
    mine.settings.textSize = 'large';
    theirs.settings.textSize = 'largest';
    saveState('jargle:v1', mine);
    const local = loadState('jargle:v1');
    let incoming: SaveState | undefined;
    const stop = watchOtherTabs('jargle:v1', (value) => { incoming = value; });
    window.dispatchEvent(new StorageEvent('storage', { key: 'jargle:v1', newValue: JSON.stringify({ ...theirs, savedAt: Date.now() + 10 }) }));
    stop();
    expect(local).not.toBeNull();
    expect(incoming).toBeDefined();
    expect(mergeStates(local!, incoming!).settings.textSize).toBe('largest');
  });

  it('keeps local settings when the incoming save is older', () => {
    const mine = state();
    const theirs = state();
    mine.settings.textSize = 'large';
    theirs.settings.textSize = 'largest';
    saveState('jargle:v1', mine);
    const local = loadState('jargle:v1');
    let incoming: SaveState | undefined;
    const stop = watchOtherTabs('jargle:v1', (value) => { incoming = value; });
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'jargle:v1',
      newValue: JSON.stringify({ ...theirs, savedAt: Date.now() - 60000 }),
    }));
    stop();
    expect(local).not.toBeNull();
    expect(incoming).toBeDefined();
    expect(mergeStates(local!, incoming!).settings.textSize).toBe('large');
  });

  it('drops invalid entries inside saved maps', () => {
    window.localStorage.setItem('jargle:v1', JSON.stringify({
      v: 1,
      rounds: {
        good: round('playing', 1, 0),
        bad: { status: 'playing', k: 'wrong', spent: [], post_step: 0 },
      },
      review: { good: ['2026-01-01', 3], bad: 'wrong' },
      reviewSeen: { good: '2026-01-02', bad: 3 },
      lessons: {
        good: { card: 1, answers: ['a'], finished_on: null },
        bad: { card: 'wrong', answers: [], finished_on: null },
      },
      badges: { 'week-one': '2026-01-03', 'days-30': 4 },
    }));
    const loaded = loadState('jargle:v1');
    expect(loaded?.rounds).toEqual({ good: expect.any(Object) });
    expect(loaded?.review).toEqual({ good: ['2026-01-01'] });
    expect(loaded?.reviewSeen).toEqual({ good: '2026-01-02' });
    expect(loaded?.lessons).toEqual({ good: { card: 1, answers: ['a'], finished_on: null } });
    expect(loaded?.badges).toEqual({ 'week-one': '2026-01-03' });
    expect(() => mergeStates(loaded!, state())).not.toThrow();
  });
});
