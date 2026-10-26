// The seven badges: when each is earned, and how the Badges screen shows them.

import type { BadgeView } from './api';
import { countedDays, soloDone } from './state';
import type { BadgeId, ContentBundle, LocalDate, SaveState } from './types';

export const BADGE_ORDER: BadgeId[] = [
  'first-word',
  'week-one',
  'days-30',
  'days-60',
  'first-lesson',
  'floyds-student',
  'taught-someone',
];

export const BADGE_NAMES: Record<BadgeId, string> = {
  'first-word': 'First Word',
  'week-one': 'Week One',
  'days-30': '30 Days Learned',
  'days-60': '60 Days Learned',
  'first-lesson': 'First Lesson',
  'floyds-student': "Floyd's Student",
  'taught-someone': 'Taught Someone',
};

const CONDITIONS: Record<BadgeId, string> = {
  'first-word': 'Learn the daily word on 1 day.',
  'week-one': 'Learn the daily word on 7 days.',
  'days-30': 'Learn the daily word on 30 days.',
  'days-60': 'Learn the daily word on 60 days.',
  'first-lesson': 'Finish a lesson.',
  'floyds-student': "Finish 5 different words in Floyd's Old Tech on your own.",
  'taught-someone': 'Play all 4 rounds of a Pass the Phone set.',
};

/** Shown on the Week One card. */
export const WEEK_ONE_NOTE = 'Get a progress code in Settings so you never lose your Days learned.';

/** Old Tech items finished solo (Pass the Phone rounds don't count here). */
export function oldTechSoloCount(state: SaveState, content: ContentBundle): number {
  const done = soloDone(state);
  let count = 0;
  for (let i = 0; i < content.oldTech.length; i++) {
    if (done.indexOf(content.oldTech[i]) !== -1) count++;
  }
  return count;
}

function lessonsFinished(state: SaveState): number {
  let count = 0;
  for (const id in state.lessons) {
    if (state.lessons[id].finished_on) count++;
  }
  return count;
}

/** Progress toward a badge, or null for badges that are just done or not done. */
function progressFor(id: BadgeId, state: SaveState, content: ContentBundle): { have: number; need: number } | null {
  const days = countedDays(state).length;
  if (id === 'first-word') return { have: Math.min(days, 1), need: 1 };
  if (id === 'week-one') return { have: Math.min(days, 7), need: 7 };
  if (id === 'days-30') return { have: Math.min(days, 30), need: 30 };
  if (id === 'days-60') return { have: Math.min(days, 60), need: 60 };
  if (id === 'floyds-student') return { have: Math.min(oldTechSoloCount(state, content), 5), need: 5 };
  return null;
}

function isEarnedNow(id: BadgeId, state: SaveState, content: ContentBundle): boolean {
  if (id === 'first-lesson') return lessonsFinished(state) > 0;
  if (id === 'taught-someone') return !!(state.ptpSet && state.ptpSet.done);
  const progress = progressFor(id, state, content);
  return progress !== null && progress.have >= progress.need;
}

/**
 * Gives every badge whose condition now holds and that isn't earned yet.
 * Changes `state` in place (callers pass their own copy) and returns the new ones.
 */
export function awardBadges(state: SaveState, content: ContentBundle, today: LocalDate): BadgeId[] {
  const newOnes: BadgeId[] = [];
  for (let i = 0; i < BADGE_ORDER.length; i++) {
    const id = BADGE_ORDER[i];
    if (state.badges[id]) continue;
    if (isEarnedNow(id, state, content)) {
      state.badges[id] = today;
      newOnes.push(id);
    }
  }
  return newOnes;
}

export function badgeViews(state: SaveState, content: ContentBundle, _today: LocalDate): BadgeView[] {
  const views: BadgeView[] = [];
  for (let i = 0; i < BADGE_ORDER.length; i++) {
    const id = BADGE_ORDER[i];
    views.push({
      id: id,
      name: BADGE_NAMES[id],
      earned: state.badges[id] || null,
      condition: CONDITIONS[id],
      progress: progressFor(id, state, content),
      note: id === 'week-one' ? WEEK_ONE_NOTE : null,
    });
  }
  return views;
}
