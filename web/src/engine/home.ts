import type { ContentBundle, LocalDate, SaveState } from './types';
import type { HomeView } from './api';
import { dayNumber } from './dates';
import { countedDays, finishedDays, scheduleEntry } from './state';
import { gentleLine, streak, daysLearned, isInGrace } from './counting';
import { plural } from './text';
import { shareLines } from './round';
import { todaysLesson } from './lessons';

export function homeView(
  state: SaveState,
  content: ContentBundle,
  today: LocalDate,
): HomeView {
  const day = dayNumber(today);
  const key = 'd:' + day;
  const entry = scheduleEntry(content, day);
  const record = state.rounds[key];
  const hasPlayed = countedDays(state).indexOf(day) !== -1
    || !!record && record.status !== 'playing';
  let phase: HomeView['phase'];
  if (day < 1) phase = 'prelaunch';
  else if (hasPlayed) phase = 'played';
  else if (!entry) phase = 'noWord';
  else if (finishedDays(state).length === 0) phase = 'first';
  else phase = 'notPlayed';

  const currentStreak = streak(state, content, today);
  let reviewDue = 0;
  for (const itemId in state.review) {
    const dueDates = state.review[itemId];
    for (let i = 0; i < dueDates.length; i++) {
      if (dueDates[i] <= today) {
        reviewDue++;
        break;
      }
    }
  }

  const graceDay = day - 1;
  const grace = isInGrace(state, graceDay, today)
    ? { day: graceDay, key: 'd:' + graceDay, started: true }
    : null;
  const gentle = phase === 'played' || phase === 'prelaunch'
    ? null
    : gentleLine(state, content, today);
  const reviewLink = reviewDue === 0
    ? 'Review: nothing due today.'
    : 'Review: ' + plural(reviewDue, 'word', 'words') + ' to practice';

  return {
    phase: phase,
    daysLearned: daysLearned(state),
    streak: currentStreak,
    gentleLine: gentle,
    today: entry
      ? {
        day: day,
        key: key,
        started: !!record,
        finished: !!record && record.status !== 'playing',
      }
      : null,
    grace: grace,
    reviewDue: reviewDue,
    todaysLesson: todaysLesson(state, content, today),
    shareLine: record && record.status !== 'playing'
      ? shareLines(state, content, key, false)
      : null,
    ptpInProgress: !!state.ptpSet && !state.ptpSet.done,
    streakLine: currentStreak >= 2
      ? 'Streak: ' + plural(currentStreak, 'day', 'days') + ' played'
      : null,
    reviewLink: reviewLink,
  };
}
