import { describe, expect, it } from 'vitest';
import { buildContent, DEMO_LIST } from './__fixtures__/content';
import { dateOfDay } from './dates';
import { newState } from './state';
import {
  advancePtp,
  dealPtpSet,
  ptpBestLine,
  ptpRoundCardLines,
  ptpRoundItem,
  ptpSummary,
  ptpTotalLine,
  startPtpSet,
} from './ptp';

describe('pass the phone', function () {
  it('deals extras and old tech on day one', function () {
    const content = buildContent();
    expect(dealPtpSet(newState(), content, dateOfDay(1))).toEqual([
      'ptp-1',
      'rotary-phone',
      'ptp-2',
      'cassette-tape',
    ]);
  });

  it('uses day one on day two when it was not played', function () {
    const content = buildContent();
    const rounds = dealPtpSet(newState(), content, dateOfDay(2));
    expect(rounds[0]).toBe('two-factor-login');
    expect(rounds[2]).toBe('ptp-1');
    expect(rounds).not.toContain('wi-fi');
  });

  it('skips a daily in grace and takes the first unused extra', function () {
    const content = buildContent();
    const state = newState();
    state.rounds['d:1'] = {
      item_id: 'two-factor-login',
      mode: 'daily',
      started_on: dateOfDay(1),
      k: 1,
      spent: [],
      selected: null,
      status: 'playing',
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    expect(dealPtpSet(state, content, dateOfDay(2))).toEqual([
      'ptp-1',
      'rotary-phone',
      'ptp-2',
      'cassette-tape',
    ]);
  });

  it('uses the demo deal in the required order', function () {
    const content = buildContent({ schedule: DEMO_LIST });
    const state = newState();
    const finished = [
      'two-factor-login', 'wi-fi', 'screenshot', 'emoji',
      'phishing', 'zelle', 'hashtag', 'spam',
    ];
    for (let i = 0; i < finished.length; i++) {
      state.lastFinished![finished[i]] = dateOfDay(i + 1);
    }
    const oldFinished = [
      'rotary-phone', 'cassette-tape', 'dewey-decimal-system', 'floppy-disk',
    ];
    for (let i = 0; i < oldFinished.length; i++) {
      state.lastFinished![oldFinished[i]] = dateOfDay(i + 1);
    }
    expect(dealPtpSet(state, content, dateOfDay(12))).toEqual([
      'deepfake',
      'phone-book',
      'the-cloud',
      'fax-machine',
    ]);
  });

  it('falls back to the candidate finished longest ago', function () {
    const content = buildContent();
    const state = newState();
    state.lastFinished!['two-factor-login'] = dateOfDay(5);
    for (let i = 0; i < content.oldTech.length; i++) {
      state.lastFinished![content.oldTech[i]] = dateOfDay(4);
    }
    state.lastFinished!['rotary-phone'] = dateOfDay(3);
    expect(dealPtpSet(state, content, dateOfDay(2))[0]).toBe('two-factor-login');
    expect(dealPtpSet(state, content, dateOfDay(2))[1]).toBe('rotary-phone');
  });

  it('adds ended rounds when starting a new set', function () {
    const content = buildContent();
    const state = startPtpSet(newState(), content, dateOfDay(1));
    state.rounds['ptp:1:1'] = {
      item_id: 'ptp-1',
      mode: 'ptp',
      started_on: dateOfDay(1),
      k: 1,
      spent: [],
      selected: null,
      status: 'solved',
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    state.rounds['ptp:1:2'] = {
      item_id: 'rotary-phone',
      mode: 'ptp',
      started_on: dateOfDay(1),
      k: 1,
      spent: [],
      selected: null,
      status: 'learned',
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    const next = startPtpSet(state, content, dateOfDay(2));
    expect(next.ptpTotal).toBe(2);
    expect(next.ptpSet!.id).toBe(2);
  });

  it('advances and summarizes rounds', function () {
    const content = buildContent();
    let state = startPtpSet(newState(), content, dateOfDay(1));
    state.rounds['ptp:1:1'] = {
      item_id: 'ptp-1',
      mode: 'ptp',
      started_on: dateOfDay(1),
      k: 1,
      spent: [],
      selected: null,
      status: 'solved',
      post_step: 0,
      miss_line: null,
      replay: false,
      end_bars: 3,
    };
    state = advancePtp(state);
    expect(state.ptpSet!.r).toBe(2);
    expect(ptpRoundItem(state, 1)).toBe('ptp-1');
    expect(ptpSummary(state, content).rounds[0]).toEqual({
      itemId: 'ptp-1',
      term: 'ptp 1',
      solved: true,
      bars: 3,
    });
  });

  it('has exact card strings', function () {
    expect(ptpRoundCardLines(2, false)).toEqual([
      'Pass the Phone: two people, one phone.',
      "The reader reads each clue and word out loud and taps the other person's pick.",
      'Round 2 of 4.',
      "Just for fun: this doesn't change your streak or Days learned.",
      'Modern word round: the person who uses newer tech reads.',
      'Not sure? Take turns.',
    ]);
    expect(ptpRoundCardLines(2, true)[4]).toBe(
      'Old tech round: the person who remembers older tech reads.',
    );
    expect(ptpTotalLine(1)).toBe("Words you've played together on this phone: 1");
    expect(ptpBestLine(2)).toBe('Best set so far: 2 of 4 solved with 3 or more bars left');
  });
});
