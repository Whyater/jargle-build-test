import type { ContentBundle, LocalDate, SaveState } from './types';
import { dateOfDay, dayNumber } from './dates';
import { countedDays, dayFromKey, scheduleEntry } from './state';
import { plural } from './text';

export function isInGrace(state: SaveState, day: number, today: LocalDate): boolean {
  if (day !== dayNumber(today) - 1) return false;
  if (countedDays(state).indexOf(day) !== -1) return false;
  const record = state.rounds['d:' + day];
  return !!record && record.started_on === dateOfDay(day) && record.status === 'playing';
}

export function roundCounts(state: SaveState, key: string, today: LocalDate): boolean {
  const day = dayFromKey(key);
  if (day === null) return false;
  const record = state.rounds[key];
  if (!record || record.status === 'playing') return false;
  const todayNumber = dayNumber(today);
  if (day === todayNumber) return true;
  return day === todayNumber - 1 && record.started_on === dateOfDay(day);
}

export function dayStatus(
  state: SaveState,
  content: ContentBundle,
  day: number,
  today: LocalDate,
): 'played' | 'pending' | 'none' | 'missed' {
  if (countedDays(state).indexOf(day) !== -1) return 'played';
  if (!scheduleEntry(content, day)) return 'none';
  if (day === dayNumber(today) || isInGrace(state, day, today)) return 'pending';

  const counted = countedDays(state);
  let firstCounted: number | null = null;
  for (let i = 0; i < counted.length; i++) {
    if (firstCounted === null || counted[i] < firstCounted) firstCounted = counted[i];
  }
  if (firstCounted === null || day < firstCounted) return 'none';
  return 'missed';
}

export function streak(state: SaveState, content: ContentBundle, today: LocalDate): number {
  const counted = countedDays(state);
  if (counted.length === 0) return 0;

  let firstCounted = counted[0];
  for (let i = 1; i < counted.length; i++) {
    if (counted[i] < firstCounted) firstCounted = counted[i];
  }

  const statuses: string[] = [];
  for (let day = firstCounted; day <= dayNumber(today); day++) {
    const status = dayStatus(state, content, day, today);
    if (status !== 'none') statuses.push(status);
  }

  let lastMissPair = -1;
  for (let i = 1; i < statuses.length; i++) {
    if (statuses[i - 1] === 'missed' && statuses[i] === 'missed') {
      lastMissPair = i;
    }
  }

  let result = 0;
  for (let i = lastMissPair + 1; i < statuses.length; i++) {
    if (statuses[i] === 'played') result++;
  }
  return result;
}

export function daysLearned(state: SaveState): number {
  return countedDays(state).length;
}

export function gentleLine(state: SaveState, content: ContentBundle, today: LocalDate): string | null {
  const todayNumber = dayNumber(today);
  if (countedDays(state).indexOf(todayNumber) !== -1) return null;
  if (countedDays(state).length === 0) return null;
  if (dayStatus(state, content, todayNumber - 1, today) !== 'missed') return null;

  const twoDaysAgoMissed = dayStatus(state, content, todayNumber - 2, today) === 'missed';
  if (twoDaysAgoMissed) {
    return 'New streak starts today. You\'ve learned on '
      + plural(daysLearned(state), 'day', 'days') + ' so far.';
  }
  if (streak(state, content, today) >= 2) {
    return "Yesterday's word is in Practice. Play today's word to keep your streak.";
  }
  return "Yesterday's word is in Practice. Play today's word to keep learning.";
}
