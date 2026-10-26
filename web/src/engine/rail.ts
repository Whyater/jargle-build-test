import type { ContentBundle, Lesson, LocalDate, SaveState } from './types';
import { addDays, dayNumber } from './dates';
import { lessonStatuses } from './lessons';

export interface RailDay {
  date: LocalDate;
  letter: string;
  played: boolean;
  isToday: boolean;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A day counts as played when its daily word was finished, the same days the streak uses.
function dailyPlayed(state: SaveState, date: LocalDate): boolean {
  const day = dayNumber(date);
  if (day < 1) return false;
  return (state.finishedDays || []).indexOf(day) !== -1
    || (state.countedDays || []).indexOf(day) !== -1;
}

// Day 1 (Oct 25, 2026) was a Sunday, so the day number tells the weekday without local time.
function weekdayLetter(date: LocalDate): string {
  const day = dayNumber(date);
  const index = ((day - 1) % 7 + 7) % 7;
  return WEEKDAY_LETTERS[index];
}

export function lastSevenDays(state: SaveState, today: LocalDate): RailDay[] {
  const result: RailDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    result.push({
      date: date,
      letter: weekdayLetter(date),
      played: dailyPlayed(state, date),
      isToday: date === today,
    });
  }
  return result;
}

export interface RailGoals {
  daily: boolean;
  lesson: boolean;
  endless: boolean;
  done: number;
  total: number;
}

export function todayGoals(state: SaveState, today: LocalDate): RailGoals {
  const daily = dailyPlayed(state, today);
  let lesson = false;
  for (const id in state.lessons) {
    if (state.lessons[id].finished_on === today) lesson = true;
  }
  const endless = state.endlessLastDay === today;
  const done = (daily ? 1 : 0) + (lesson ? 1 : 0) + (endless ? 1 : 0);
  return { daily: daily, lesson: lesson, endless: endless, done: done, total: 3 };
}

export function nextLesson(state: SaveState, content: ContentBundle, today: LocalDate): Lesson | null {
  const statuses = lessonStatuses(state, content, today);
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].open && !statuses[i].done) return statuses[i].lesson;
  }
  return null;
}
