import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import * as api from './api';

describe('api', () => {
  const content = buildContent();
  const today = api.dateOfDay(1);

  it('exports functions and constants', () => {
    const names = Object.keys(api);
    for (let i = 0; i < names.length; i++) {
      const value = (api as Record<string, unknown>)[names[i]];
      expect(value).toBeDefined();
    }
    expect(typeof api.homeView).toBe('function');
    expect(typeof api.shareLines).toBe('function');
    expect(typeof api.todaysLesson).toBe('function');
    expect(typeof api.dealPtpSet).toBe('function');
    expect(api.LAUNCH_DATE).toBe('2026-10-25');
  });

  it('runs on a fresh state without throwing', () => {
    const state = api.newState();
    const key = 'd:1';
    const item = content.schedule.days[0].term;
    const calls: (() => unknown)[] = [
      () => api.todayLocal(new Date(2026, 9, 26)),
      () => api.dayNumber(today),
      () => api.dateOfDay(1),
      () => api.homeView(state, content, today),
      () => api.reviewSession(state, content, today),
      () => api.answerReview(state, item, true, today),
      () => api.lessonStatuses(state, content, today),
      () => api.todaysLesson(state, content, today),
      () => api.practiceList(state, content, today),
      () => api.oldTechList(state, content, today),
      () => api.nextWord(state, content, 'oldtech', today),
      () => api.startPtpSet(state, content, today),
      () => api.advancePtp(state),
      () => api.ptpRoundItem(state, 1),
      () => api.badgeViews(state, content, today),
      () => api.encodeProgressCode(state, content, today),
      () => api.decodeProgressCode('not a code'),
      () => api.demoState('new', content),
      () => api.dealPtpSet(state, content, today),
      () => api.reviewLinkText(2),
      () => api.reviewDoneLine(1),
      () => api.ptpRoundCardLines(1, false),
      () => api.ptpTotalLine(3),
      () => api.ptpBestLine(4),
      () => api.addDays(today, 1),
      () => api.longDate(today),
    ];
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i]).not.toThrow();
    }

    const started = api.startRound(state, content, key, item, 'daily', today);
    expect(() => api.roundView(started, content, key, today)).not.toThrow();
    expect(() => api.applyRound(started, content, key, { type: 'nextClue' }, today)).not.toThrow();
    expect(() => api.shareText(started, content, key, { appUrl: 'https://example.com', demo: false })).not.toThrow();
    expect(() => api.replayRound(started, content, key, today)).not.toThrow();
  });

  it('does not report any function as not implemented', () => {
    const state = api.newState();
    try {
      api.homeView(state, content, today);
      api.badgeViews(state, content, today);
      api.practiceList(state, content, today);
    } catch (error) {
      expect(String(error)).not.toContain('not implemented');
    }
  });
});
