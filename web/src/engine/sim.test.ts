import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { newState } from './state';
import { dateOfDay } from './dates';
import { startRound, applyRound } from './round';
import { todaysLesson, finishLesson } from './lessons';
import { nextWord } from './lists';
import { startPtpSet, advancePtp, ptpRoundItem } from './ptp';
import { dailyKey, ptpKey } from './state';
import { badgeViews } from './badges';
import { homeView } from './home';

function solve(state: ReturnType<typeof newState>, content: ReturnType<typeof buildContent>, key: string, itemId: string, mode: 'daily' | 'oldtech' | 'ptp', today: string) {
  let s = startRound(state, content, key, itemId, mode, today);
  s = applyRound(s, content, key, { type: 'select', term: content.items[itemId].term }, today).state;
  return applyRound(s, content, key, { type: 'check' }, today).state;
}

describe('badge simulation', () => {
  it('earns badges on the specified days', () => {
    const content = buildContent({ days: 60, oldTechCount: 20, allLessons: true });
    let state = newState();
    const earned: Record<string, string> = {};
    for (let day = 1; day <= 60; day++) {
      const today = dateOfDay(day);
      const dailyId = content.schedule.days[day - 1].term;
      state = solve(state, content, dailyKey(day), dailyId, 'daily', today);
      const lesson = todaysLesson(state, content, today);
      if (lesson) state = finishLesson(state, content, lesson.id, today).state;
      const old = nextWord(state, content, 'oldtech', today);
      if ('entry' in old) state = solve(state, content, old.entry.key, old.entry.itemId, 'oldtech', today);
      if (day === 1) {
        state = startPtpSet(state, content, today);
        for (let r = 1; r <= 4; r++) {
          const itemId = ptpRoundItem(state, r);
          if (!itemId) continue;
          state = solve(state, content, ptpKey(state.ptpSet!.id, r), itemId, 'ptp', today);
          if (r < 4) state = advancePtp(state);
        }
      }
      for (const badge of badgeViews(state, content, today)) {
        if (badge.earned && !earned[badge.id]) earned[badge.id] = badge.earned;
      }
    }
    expect(earned['first-word']).toBe(dateOfDay(1));
    expect(earned['first-lesson']).toBe(dateOfDay(1));
    expect(earned['taught-someone']).toBe(dateOfDay(1));
    expect(earned['floyds-student']).toBe(dateOfDay(5));
    expect(earned['week-one']).toBe(dateOfDay(7));
    expect(earned['days-30']).toBe(dateOfDay(30));
    expect(earned['days-60']).toBe(dateOfDay(60));
    // the Day 1 deal is ptp-1, rotary-phone, ptp-2, cassette-tape, so daily slots are rounds 1 and 3
    const rounds = state.ptpSet ? state.ptpSet.rounds : [];
    expect([rounds[0], rounds[2]]).toEqual(['ptp-1', 'ptp-2']);
  });

  it('starts a new streak after two missed days', () => {
    const content = buildContent({ days: 60, oldTechCount: 20, allLessons: true });
    let state = newState();
    for (let day = 1; day <= 9; day++) {
      const today = dateOfDay(day);
      state = solve(state, content, dailyKey(day), content.schedule.days[day - 1].term, 'daily', today);
    }
    const before = homeView(state, content, dateOfDay(12));
    expect(before.streak).toBe(0);
    expect(before.gentleLine).toBe("New streak starts today. You've learned on 9 days so far.");
    state = solve(state, content, dailyKey(12), content.schedule.days[11].term, 'daily', dateOfDay(12));
    expect(homeView(state, content, dateOfDay(12)).streak).toBe(1);
  });
});
