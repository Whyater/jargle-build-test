import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { addDays } from './dates';
import { newState } from './state';
import { lastSevenDays, nextLesson, todayGoals } from './rail';

describe('desktop rail', () => {
  it('returns seven days in oldest-first order with today last', () => {
    const days = lastSevenDays(newState(), '2026-10-26');
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-10-20');
    expect(days[6].date).toBe('2026-10-26');
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days[6].isToday).toBe(true);
  });

  it('uses weekday letters from the calendar date', () => {
    const days = lastSevenDays(newState(), '2026-10-26');
    expect(days.map((day) => day.letter)).toEqual(['T', 'W', 'T', 'F', 'S', 'S', 'M']);
  });

  it('marks finished and counted daily days as played', () => {
    const state = newState();
    state.finishedDays = [1];
    state.countedDays = [2];
    const days = lastSevenDays(state, '2026-10-31');
    expect(days[0].played).toBe(true);
    expect(days[1].played).toBe(true);
    expect(days[2].played).toBe(false);
  });

  it('does not mark pre-launch days as played', () => {
    const state = newState();
    state.finishedDays = [0, 1];
    const days = lastSevenDays(state, '2026-10-26');
    expect(days[0].date).toBe('2026-10-20');
    expect(days[0].played).toBe(false);
  });

  it('reports none, some, and all goals', () => {
    const content = buildContent();
    const state = newState();
    expect(todayGoals(state, '2026-10-26')).toEqual({ daily: false, lesson: false, endless: false, done: 0, total: 3 });
    state.finishedDays = [2];
    state.lessons[content.lessons[0].id] = { card: 0, answers: [], finished_on: '2026-10-26' };
    expect(todayGoals(state, '2026-10-26').done).toBe(2);
    state.endlessLastDay = '2026-10-26';
    expect(todayGoals(state, '2026-10-26')).toEqual({ daily: true, lesson: true, endless: true, done: 3, total: 3 });
  });

  it('does not count yesterday as the endless goal', () => {
    const state = newState();
    state.endlessLastDay = addDays('2026-10-26', -1);
    expect(todayGoals(state, '2026-10-26').endless).toBe(false);
  });

  it('returns the first open unfinished lesson', () => {
    const content = buildContent();
    const lesson = nextLesson(newState(), content, '2026-10-26');
    expect(lesson?.id).toBe(content.lessons[0].id);
  });

  it('can return a lesson finished earlier today as already done', () => {
    const content = buildContent();
    const state = newState();
    state.lessons[content.lessons[0].id] = { card: 0, answers: [], finished_on: '2026-10-25' };
    expect(nextLesson(state, content, '2026-10-26')?.id).toBe(content.lessons[1].id);
  });
});
