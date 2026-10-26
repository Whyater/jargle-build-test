import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { demoState } from './demo';
import { dateOfDay } from './dates';
import { daysLearned } from './counting';
import { homeView } from './home';
import { badgeViews } from './badges';
import { dailyItem } from './state';
import { dealPtpSet, startPtpSet } from './ptp';
import { decodeProgressCode, encodeProgressCode } from './code';

describe('judge demo', () => {
  const content = buildContent();

  it('has the requested judge history and views', () => {
    const demo = demoState('judge', content);
    const home = homeView(demo.state, demo.content, demo.today);
    expect(daysLearned(demo.state)).toBe(8);
    expect(home.streak).toBe(3);
    expect(home.gentleLine).toBeNull();
    expect(home.phase).toBe('notPlayed');
    expect(home.today && home.today.key).toBe('d:12');
    const word = dailyItem(demo.content, 12);
    expect(word && word.id).toBe('claude');
    expect(home.todaysLesson && home.todaysLesson.id).toBe('turn-on-two-factor-login');
    const earned = badgeViews(demo.state, demo.content, demo.today).filter((b) => b.earned).map((b) => b.id);
    expect(earned).toEqual(['first-word', 'week-one', 'first-lesson']);
    const floyd = badgeViews(demo.state, demo.content, demo.today).find((b) => b.id === 'floyds-student');
    expect(floyd && floyd.progress).toEqual({ have: 4, need: 5 });
    expect(home.reviewLink).toBe('Review: 3 words to practice');
  });

  it('deals the specified Pass the Phone rounds', () => {
    const demo = demoState('judge', content);
    const state = startPtpSet(demo.state, demo.content, demo.today);
    expect(dealPtpSet(state, demo.content, demo.today)).toEqual(['deepfake', 'phone-book', 'the-cloud', 'fax-machine']);
  });

  it('starts a new demo with no progress', () => {
    const demo = demoState('new', content);
    const home = homeView(demo.state, demo.content, demo.today);
    expect(home.phase).toBe('first');
    expect(daysLearned(demo.state)).toBe(0);
  });

  it('loads a judge demo progress code into a fresh state', () => {
    const demo = demoState('judge', content);
    const code = encodeProgressCode(demo.state, demo.content, demo.today);
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const loaded = decoded.apply(demoState('new', content).state, content, dateOfDay(12));
    expect(daysLearned(loaded)).toBe(8);
  });
});
