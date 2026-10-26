import { describe, expect, it } from 'vitest';
import { buildLessonSession, buildWordSession, answerStep, finishLessonSession } from './session';
import { newState } from './state';
import type { ContentBundle, Lesson, TermItem } from './types';

function item(id: string, n: number): TermItem {
  return {
    id, kind: 'term', topic: 'internet-talk', term: 'word' + String.fromCharCode(96 + n), meaning: 'meaning ' + n,
    clues: ['a', 'b', 'c', 'd', 'e'], assumes: [], decoys: [
      { term: 'x' + n, meaning: 'x meaning', source_urls: [] },
      { term: 'y' + n, meaning: 'y meaning', source_urls: [] },
      { term: 'z' + n, meaning: 'z meaning', source_urls: [] },
    ], exchange: [], old_tech: false, sources: [], checked_on: null, difficulty: 1, decisive_clue: 1,
    blank: { sentence: 'Use ___ here.', wrong: ['wrong', 'other'] }, why: 'why ' + n, short: 'short ' + n,
    situations: [{ text: 'A moment', options: ['Scam', 'Safe'], answer: 'Safe', why: 'It is safe.' }],
  };
}

const items: Record<string, TermItem> = { a: item('a', 1), b: item('b', 2), c: item('c', 3), d: item('d', 4) };
const lesson: Lesson = {
  id: 'lesson-1', topic: 'internet-talk', number: 1, title: 'A lesson', cards: [{ text: 'Card', mascot: 'bud', line: 'Hi' }],
  checks: [{ prompt: 'Pick one', options: ['A', 'B'], answer: 'A', why: 'Because' }], takeaway: 'Takeaway', sources: [], checked_on: null,
  words: ['a', 'b', 'c', 'd'], situations: [items.a.situations![0], { text: 'Second', options: ['Yes', 'No'], answer: 'Yes', why: 'Why' }],
};
const content: ContentBundle = { version: 1, items, lessons: [lesson], oldTech: [], ptpExtras: [], schedule: { version: 1, days: [] }, missLines: { either: [], floyd: [] }, commonWords: [] };

describe('lesson sessions', () => {
  it('builds the eight main steps in order', () => {
    expect(buildLessonSession(lesson, content, 'seed').steps.map(s => s.kind)).toEqual(['learn', 'learn', 'pairs', 'blank', 'situation', 'build', 'meaning', 'recap']);
  });
  it('is seeded and requeues one wrong answer', () => {
    const one = buildLessonSession(lesson, content, 'seed');
    expect(buildLessonSession(lesson, content, 'seed')).toEqual(one);
    expect(buildLessonSession(lesson, content, 'other').steps[2]).not.toEqual(one.steps[2]);
    const wrong = answerStep({ ...one, index: 3 }, false);
    expect(wrong.misses).toBe(1);
    // The missed step comes back just before the recap, which stays last.
    expect(wrong.steps[wrong.steps.length - 2].id).toBe('blank:a:again');
    expect(wrong.steps[wrong.steps.length - 1].kind).toBe('recap');
    expect(answerStep({ ...wrong, index: wrong.steps.length - 2 }, false).steps).toHaveLength(wrong.steps.length);
  });
  it('falls back to checks and builds word sessions', () => {
    const fallback = buildLessonSession({ ...lesson, words: [] }, content, 'x');
    expect(fallback.steps.map(s => s.kind)).toEqual(['learn', 'situation', 'situation', 'situation', 'recap']);
    expect(buildWordSession('a', content, 'x')!.steps.map(s => s.kind)).toEqual(['learn', 'blank', 'situation', 'meaning']);
    expect(buildWordSession('missing', content, 'x')).toBeNull();
  });
  it('finishes lesson and word sessions without mutating input', () => {
    const state = newState();
    const session = { ...buildLessonSession(lesson, content, 'x'), misses: 1, missedItems: ['a'] };
    const done = finishLessonSession(state, content, session, '2026-10-26');
    expect(done.xpGained).toBe(30);
    expect(done.state.lessons['lesson-1'].finished_on).toBe('2026-10-26');
    expect(done.state.review.a).toEqual(['2026-10-27', '2026-10-29', '2026-11-02']);
    expect(state.lessons).toEqual({});
    const again = finishLessonSession(done.state, content, session, '2026-10-26');
    expect(again.xpGained).toBe(0);
    const word = buildWordSession('a', content, 'x')!;
    expect(finishLessonSession(state, content, { ...word, missedItems: ['a'] }, '2026-10-26').xpGained).toBe(10);
  });
  it('sends mixed-up pair words to Review', () => {
    const one = buildLessonSession(lesson, content, 'seed');
    const wrong = answerStep({ ...one, index: 2 }, false, ['b', 'c']);
    expect(wrong.missedItems).toEqual(['b', 'c']);
    expect(wrong.steps[wrong.steps.length - 2].id).toBe('pairs:again');
  });
  it('falls back when two words share a short meaning', () => {
    const same: Record<string, TermItem> = { ...items, b: { ...items.b, short: 'short 1' } };
    const session = buildLessonSession(lesson, { ...content, items: same }, 'seed');
    expect(session.steps.map(s => s.kind)).not.toContain('pairs');
  });
});
