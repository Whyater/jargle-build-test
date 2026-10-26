import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { applyRound, replayRound, startRound } from './round';
import { finishLesson } from './lessons';
import { newState } from './state';
import { addXp, levelFromXp, xpFor } from './xp';

describe('xp', () => {
  it('calculates XP for rounds, lessons, and Endless answers', () => {
    expect(xpFor({ type: 'round', mode: 'daily', status: 'solved', bars: 6 })).toBe(50);
    expect(xpFor({ type: 'round', mode: 'daily', status: 'solved', bars: 3 })).toBe(35);
    expect(xpFor({ type: 'round', mode: 'daily', status: 'solved', bars: 1 })).toBe(25);
    expect(xpFor({ type: 'round', mode: 'daily', status: 'learned', bars: 4 })).toBe(10);
    for (const mode of ['practice', 'oldtech', 'ptp'] as const) {
      expect(xpFor({ type: 'round', mode: mode, status: 'solved', bars: 3 })).toBe(16);
      expect(xpFor({ type: 'round', mode: mode, status: 'learned', bars: 3 })).toBe(5);
    }
    expect(xpFor({ type: 'lesson' })).toBe(30);
    expect(xpFor({ type: 'endless', correct: true, combo: 1 })).toBe(10);
    expect(xpFor({ type: 'endless', correct: true, combo: 2 })).toBe(10);
    expect(xpFor({ type: 'endless', correct: true, combo: 3 })).toBe(15);
    expect(xpFor({ type: 'endless', correct: true, combo: 6 })).toBe(15);
    expect(xpFor({ type: 'endless', correct: false, combo: 3 })).toBe(0);
  });

  it('handles level boundaries and invalid input', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
    expect(levelFromXp(29)).toEqual({ level: 1, intoLevel: 29, needed: 30 });
    expect(levelFromXp(30)).toEqual({ level: 2, intoLevel: 0, needed: 50 });
    expect(levelFromXp(79)).toEqual({ level: 2, intoLevel: 49, needed: 50 });
    expect(levelFromXp(80)).toEqual({ level: 3, intoLevel: 0, needed: 70 });
    expect(levelFromXp(-5)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
    expect(levelFromXp(Number.NaN)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
    expect(levelFromXp(undefined as unknown as number)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
  });

  it('reaches level 2 after three right Endless answers', () => {
    const state = newState();
    let xp = 0;
    for (const combo of [1, 2, 3]) xp += xpFor({ type: 'endless', correct: true, combo: combo });
    const saved = addXp(state, xp);
    expect(saved.xp).toBe(35);
    expect(levelFromXp(saved.xp || 0).level).toBe(2);
  });

  it('adds XP to an old save without changing the input', () => {
    const oldSave = newState();
    delete oldSave.xp;
    const saved = addXp(oldSave, 12);
    expect(saved.xp).toBe(12);
    expect(oldSave.xp).toBeUndefined();
  });

  it('loads an old save through a round and lesson finish', () => {
    const content = buildContent();
    const oldSave = newState();
    delete oldSave.xp;
    const item = content.schedule.days[0].term;
    let state = startRound(oldSave, content, 'd:1', item, 'daily', '2026-10-25');
    state = applyRound(state, content, 'd:1', { type: 'select', term: content.items[item].term }, '2026-10-25').state;
    const round = applyRound(state, content, 'd:1', { type: 'check' }, '2026-10-25');
    expect(round.state.xp).toBeGreaterThan(0);
    const lesson = finishLesson(round.state, content, content.lessons[0].id, '2026-10-25');
    expect(lesson.state.xp).toBe((round.state.xp || 0) + 30);
  });

  it('reports XP for ending rounds and zero for a select tap', () => {
    const content = buildContent();
    const item = content.schedule.days[0].term;
    let state = startRound(newState(), content, 'd:1', item, 'daily', '2026-10-25');
    const selected = applyRound(state, content, 'd:1', { type: 'select', term: content.items[item].term }, '2026-10-25');
    expect(selected.xpGained).toBe(0);
    state = selected.state;
    const solved = applyRound(state, content, 'd:1', { type: 'check' }, '2026-10-25');
    expect(solved.xpGained).toBe(xpFor({ type: 'round', mode: 'daily', status: 'solved', bars: 6 }));
    expect(solved.state.xp).toBe(solved.xpGained);

    state = startRound(newState(), content, 'd:2', item, 'daily', '2026-10-26');
    state = applyRound(state, content, 'd:2', { type: 'nextClue' }, '2026-10-26').state;
    state = applyRound(state, content, 'd:2', { type: 'nextClue' }, '2026-10-26').state;
    const learned = applyRound(state, content, 'd:2', { type: 'showAnswer' }, '2026-10-26');
    expect(learned.xpGained).toBe(xpFor({ type: 'round', mode: 'daily', status: 'learned', bars: 4 }));
  });

  it('gives a replayed daily the practice rate', () => {
    const content = buildContent();
    const item = content.schedule.days[0].term;
    let state = startRound(newState(), content, 'd:1', item, 'daily', '2026-10-25');
    state = applyRound(state, content, 'd:1', { type: 'select', term: content.items[item].term }, '2026-10-25').state;
    state = applyRound(state, content, 'd:1', { type: 'check' }, '2026-10-25').state;
    expect(state.xp).toBe(50);

    state = replayRound(state, content, 'd:1', '2026-10-25');
    state = applyRound(state, content, 'd:1', { type: 'select', term: content.items[item].term }, '2026-10-25').state;
    const again = applyRound(state, content, 'd:1', { type: 'check' }, '2026-10-25');
    expect(again.xpGained).toBe(xpFor({ type: 'round', mode: 'practice', status: 'solved', bars: 6 }));
    expect(again.state.xp).toBe(50 + 22);
  });

  it('awards lesson XP only on the first finish', () => {
    const content = buildContent();
    const id = content.lessons[0].id;
    const first = finishLesson(newState(), content, id, '2026-10-25');
    const second = finishLesson(first.state, content, id, '2026-10-26');
    expect(first.xpGained).toBe(30);
    expect(second.xpGained).toBe(0);
    expect(second.state.xp).toBe(30);
  });
});
