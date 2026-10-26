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

function jargleRecord(status: 'playing' | 'won' | 'lost', guesses: string[], finished_on?: string) {
  return {
    guesses,
    status,
    started_on: '2026-01-02',
    ...(finished_on === undefined ? {} : { finished_on }),
  } as const;
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

  it('keeps XP and Endless scores through a save and load', () => {
    const value = { ...state(), xp: 45, endlessBest: 120, endlessGames: 3 };
    saveState('jargle:v1', value);
    const loaded = loadState('jargle:v1');
    expect(loaded?.xp).toBe(45);
    expect(loaded?.endlessBest).toBe(120);
    expect(loaded?.endlessGames).toBe(3);
  });

  it('keeps the Endless finish date through a save and reload', () => {
    const value = { ...state(), endlessLastDay: '2026-10-26' };
    saveState('jargle:v1', value);
    expect(loadState('jargle:v1')?.endlessLastDay).toBe('2026-10-26');
  });

  it('drops an invalid Endless finish date', () => {
    window.localStorage.setItem('jargle:v1', JSON.stringify({ ...state(), endlessLastDay: 'yesterday' }));
    expect(loadState('jargle:v1')?.endlessLastDay).toBeUndefined();
  });

  it('keeps valid Jargle records through a save and load', () => {
    const value = { ...state(), jargle: { '2': jargleRecord('won', ['WORD'], '2026-01-02') } };
    saveState('jargle:v1', value);
    expect(loadState('jargle:v1')?.jargle).toEqual(value.jargle);
  });

  it('keeps the XP a Jargle game paid through a reload, and drops a bad value', () => {
    const value = {
      ...state(),
      jargle: {
        '2': { ...jargleRecord('won', ['WORD'], '2026-01-02'), xp_paid: 0 },
        '3': { ...jargleRecord('lost', ['WORD'], '2026-01-03'), xp_paid: -5 },
      },
    };
    window.localStorage.setItem('jargle:v1', JSON.stringify(value));
    const loaded = loadState('jargle:v1');
    expect(loaded?.jargle?.['2'].xp_paid).toBe(0);
    expect(loaded?.jargle?.['3'].xp_paid).toBeUndefined();
  });

  it('drops malformed Jargle records', () => {
    window.localStorage.setItem('jargle:v1', JSON.stringify({
      v: 1,
      jargle: {
        good: jargleRecord('playing', ['WORD']),
        badGuesses: { ...jargleRecord('playing', ['WORD']), guesses: [3] },
        badStatus: { ...jargleRecord('playing', ['WORD']), status: 'done' },
        badDate: { ...jargleRecord('playing', ['WORD']), started_on: 3 },
      },
    }));
    expect(loadState('jargle:v1')?.jargle).toEqual({ good: jargleRecord('playing', ['WORD']) });
  });

  it('keeps the bigger XP and Endless scores when two tabs merge', () => {
    const mine = { ...state(), xp: 45, endlessBest: 30, endlessGames: 1 };
    const theirs = { ...state(), xp: 20, endlessBest: 90, endlessGames: 4 };
    const merged = mergeStates(mine, theirs);
    expect(merged.xp).toBe(45);
    expect(merged.endlessBest).toBe(90);
    expect(merged.endlessGames).toBe(4);
  });

  it('keeps the later Endless finish date when two tabs merge', () => {
    const mine = { ...state(), endlessLastDay: '2026-10-27' };
    const theirs = { ...state(), endlessLastDay: '2026-10-29' };
    expect(mergeStates(mine, theirs).endlessLastDay).toBe('2026-10-29');
  });

  it('prefers a finished Jargle record when two tabs merge', () => {
    const mine = { ...state(), jargle: { '2': jargleRecord('playing', ['WORD']) } };
    const theirs = { ...state(), jargle: { '2': jargleRecord('won', ['WORD', 'TERM'], '2026-01-02') } };
    expect(mergeStates(mine, theirs).jargle?.['2']).toEqual(theirs.jargle['2']);
  });

  it('keeps a Jargle win over a loss in either merge order', () => {
    const win = { ...state(), jargle: { '2': jargleRecord('won', ['WORD', 'TERM', 'TEAM'], '2026-01-02') } };
    const loss = { ...state(), jargle: { '2': jargleRecord('lost', ['A', 'B', 'C', 'D', 'E', 'F'], '2026-01-02') } };
    expect(mergeStates(win, loss).jargle?.['2'].status).toBe('won');
    expect(mergeStates(loss, win).jargle?.['2'].status).toBe('won');
  });

  it('keeps the Jargle win with fewer guesses', () => {
    const quick = { ...state(), jargle: { '2': jargleRecord('won', ['WORD'], '2026-01-02') } };
    const slow = { ...state(), jargle: { '2': jargleRecord('won', ['TERM', 'WORD'], '2026-01-02') } };
    expect(mergeStates(slow, quick).jargle?.['2'].guesses.length).toBe(1);
    expect(mergeStates(quick, slow).jargle?.['2'].guesses.length).toBe(1);
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

  it('reload keeps lesson stars and word lesson dates', () => {
    const value = {
      ...state(),
      lessons: { lesson: { card: 1, answers: [], finished_on: '2026-01-01', stars: 2 } },
      wordLessons: { alpha: '2026-01-02' },
    };
    expect(saveState('jargle:v1', value)).toBe(true);
    const loaded = loadState('jargle:v1');
    expect(loaded?.lessons.lesson.stars).toBe(2);
    expect(loaded?.wordLessons).toEqual({ alpha: '2026-01-02' });
  });

  it('merges higher lesson stars and the union of word lessons', () => {
    const mine = {
      ...state(),
      lessons: { lesson: { card: 1, answers: [], finished_on: '2026-01-02', stars: 2 } },
      wordLessons: { alpha: '2026-01-02' },
    };
    const theirs = {
      ...state(),
      lessons: { lesson: { card: 1, answers: [], finished_on: '2026-01-02', stars: 3 } },
      wordLessons: { alpha: '2026-01-03', beta: '2026-01-01' },
    };
    const merged = mergeStates(mine, theirs);
    expect(merged.lessons.lesson.stars).toBe(3);
    expect(merged.wordLessons).toEqual({ alpha: '2026-01-03', beta: '2026-01-01' });
  });
});
