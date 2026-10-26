import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { dateOfDay } from './dates';
import { newState } from './state';
import { applyRound, roundView, shareLines, shareText, startRound } from './round';
import { encodeProgressCode, decodeProgressCode } from './code';
import { pickMissLine } from './missLines';
import { isInGrace } from './counting';
import { dealPtpSet } from './ptp';

const C = buildContent();
const D1 = dateOfDay(1);
const ITEM = 'two-factor-login';
const ANSWER = 'two factor login';
const WRONG = 'two factor login decoy a';
type Action = Parameters<typeof applyRound>[3];
function tap(state: ReturnType<typeof newState>, action: Action, key = 'd:1', today = D1) {
  return applyRound(state, C, key, action, today);
}
function begin(key = 'd:1', item = ITEM, mode: 'daily' | 'practice' | 'oldtech' = 'daily', today = D1) {
  return startRound(newState(), C, key, item, mode, today);
}

describe('reviewer repairs', () => {
  it('uses a warning when a non-ending miss has no miss line', () => {
    const noLines = buildContent();
    noLines.missLines.either = [];
    noLines.missLines.floyd = [];
    let state = begin();
    state = applyRound(state, noLines, 'd:1', { type: 'nextClue' }, D1).state;
    state = applyRound(state, noLines, 'd:1', { type: 'nextClue' }, D1).state;
    state = applyRound(state, noLines, 'd:1', { type: 'select', term: WRONG }, D1).state;
    const result = applyRound(state, noLines, 'd:1', { type: 'check' }, D1);
    expect(result.outcome).toBe('wrong');
    expect(result.message).toBe('Careful: a wrong guess now ends the round. It still counts.');
  });

  it('skips a starred first Floyd line when the next clue is off', () => {
    let state = begin();
    state = tap(state, { type: 'nextClue' }).state;
    state = tap(state, { type: 'nextClue' }).state;
    state = tap(state, { type: 'select', term: WRONG }).state;
    const result = tap(state, { type: 'check' });
    expect(result.message).toBe("That one's tricky.");
    expect(result.state.missLineQueue?.floyd[0]).toBe(0);
  });

  it('shares only a counted daily round', () => {
    let state = begin();
    state = tap(state, { type: 'select', term: ANSWER }).state;
    state = tap(state, { type: 'check' }).state;
    expect(shareLines(state, C, 'd:1', false)).toContain('Jargle #1');
    expect(shareText(state, C, 'd:1', { appUrl: 'https://x.test', demo: false })).toContain('Jargle #1');

    let old = begin('old', 'rotary-phone', 'oldtech');
    old = tap(old, { type: 'select', term: 'rotary phone' }, 'old').state;
    old = tap(old, { type: 'check' }, 'old').state;
    expect(shareLines(old, C, 'old', false)).toBe('');
    expect(shareText(old, C, 'old', { appUrl: 'https://x.test', demo: false })).toBe('');

    let practice = begin('d:1', ITEM, 'practice', dateOfDay(2));
    practice = tap(practice, { type: 'select', term: ANSWER }, 'd:1', dateOfDay(2)).state;
    practice = tap(practice, { type: 'check' }, 'd:1', dateOfDay(2)).state;
    expect(shareLines(practice, C, 'd:1', false)).toBe('');
  });

  it('keeps missed cards at the end in spent order', () => {
    const state = begin();
    state.rounds['d:1'].spent = ['two factor login decoy b', 'two factor login decoy a'];
    const cards = roundView(state, C, 'd:1', D1).cards;
    expect(cards[cards.length - 2].term).toBe('two factor login decoy b');
    expect(cards[cards.length - 1].term).toBe('two factor login decoy a');
  });
});

describe('code and miss line repairs', () => {
  it('decodes codes with mixed case, whitespace, and hyphen variants', () => {
    const content = buildContent({ days: 30 });
    const code = encodeProgressCode(newState(), content, dateOfDay(1));
    const altered = code.toLowerCase().replace(/-/g, '\u2013').replace(/(.{3})/g, '$1\t\u00a0\n');
    expect(decodeProgressCode(altered).ok).toBe(true);
  });

  it('drops stale miss line indexes after content shrinks', () => {
    const content = buildContent();
    content.missLines.floyd = [];
    const state = newState();
    state.missLineQueue = { floyd: [9], bud: [] };
    const picked = pickMissLine(state, content, 'two-factor-login', true);
    expect(picked).not.toBeNull();
    expect(picked && picked.text).toBe(content.missLines.either[0].text);
  });

  it('decodes codes pasted with soft hyphens and zero-width spaces', () => {
    const content = buildContent();
    const code = encodeProgressCode(newState(), content, dateOfDay(1));
    const altered = code.replace(/-/g, '\u00ad\u200b');
    expect(decodeProgressCode(altered).ok).toBe(true);
  });

  it('survives a corrupted miss line queue', () => {
    const content = buildContent();
    const state = newState();
    state.missLineQueue = { floyd: [1.5, NaN, -1], bud: [] };
    const picked = pickMissLine(state, content, 'two-factor-login', true);
    expect(picked).not.toBeNull();
  });
});

describe('counting and pass the phone repairs', () => {
  it('does not treat an already counted yesterday as grace', () => {
    const state = newState();
    state.countedDays = [1];
    state.rounds['d:1'] = {
      item_id: ITEM, mode: 'daily', started_on: dateOfDay(1), k: 1,
      spent: [], selected: null, status: 'playing', post_step: 0,
      miss_line: null, replay: false,
    };
    expect(isInGrace(state, 1, dateOfDay(2))).toBe(false);
  });

  it('does not skip a counted yesterday when dealing pass the phone', () => {
    const content = buildContent({ days: 3, oldTechCount: 6 });
    const state = newState();
    state.countedDays = [1];
    state.rounds['d:1'] = {
      item_id: ITEM, mode: 'daily', started_on: dateOfDay(1), k: 1,
      spent: [], selected: null, status: 'playing', post_step: 0,
      miss_line: null, replay: false,
    };
    const rounds = dealPtpSet(state, content, dateOfDay(2));
    expect(rounds[0]).toBe('two-factor-login');
  });
});
