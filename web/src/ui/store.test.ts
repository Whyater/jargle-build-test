import { describe, expect, it } from 'vitest';
import { demoFromSearch, isFirstDailyDone } from './store';
import type { SaveState } from '../engine/types';

function blankState(): SaveState {
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
  };
}

describe('demoFromSearch', () => {
  it('reads judge and new', () => {
    expect(demoFromSearch('?demo=judge')).toBe('judge');
    expect(demoFromSearch('?demo=new')).toBe('new');
  });
  it('returns null for other searches', () => {
    expect(demoFromSearch('')).toBeNull();
    expect(demoFromSearch('?demo=old')).toBeNull();
    expect(demoFromSearch('?x=1')).toBeNull();
    expect(demoFromSearch('?demo=judge&demo=new')).toBe('judge');
  });
});

describe('isFirstDailyDone', () => {
  it('requires a daily round with counted_day', () => {
    const state = blankState();
    expect(isFirstDailyDone(state)).toBe(false);
    state.rounds.a = {
      item_id: 'a', mode: 'practice', started_on: '2026-10-26', k: 1, spent: [], selected: null,
      status: 'solved', post_step: 2, miss_line: null, replay: false, counted_day: 1,
    };
    expect(isFirstDailyDone(state)).toBe(false);
    state.rounds.b = {
      item_id: 'b', mode: 'daily', started_on: '2026-10-26', k: 1, spent: [], selected: null,
      status: 'solved', post_step: 2, miss_line: null, replay: false,
    };
    expect(isFirstDailyDone(state)).toBe(false);
    state.rounds.b.counted_day = 1;
    expect(isFirstDailyDone(state)).toBe(true);
  });
});
