import type { ContentBundle, LocalDate, SaveState } from './types';
import type { ListEntry } from './api';
import { dateOfDay, dayNumber, longDate } from './dates';
import {
  builtOldTech,
  dailyItem,
  dailyKey,
  finishedDays,
  oldTechReleaseDay,
  scheduleEntry,
  soloDone,
} from './state';

export const PRACTICE_EMPTY = "No words yet. Each day's word appears here the next day.";
export const OLD_TECH_INTRO = "Guess the old tech from clues. You might know these better than Bud.";

export function practiceList(state: SaveState, content: ContentBundle, today: LocalDate): ListEntry[] {
  if (state.firstPlayDay === null) return [];
  const todayDay = dayNumber(today);
  const done = finishedDays(state);
  const result: ListEntry[] = [];
  for (let day = todayDay - 1; day >= state.firstPlayDay; day--) {
    const schedule = scheduleEntry(content, day);
    const item = dailyItem(content, day);
    if (!schedule || !item) continue;
    const finished = done.indexOf(day) !== -1;
    result.push({
      itemId: item.id,
      key: dailyKey(day),
      label: finished ? item.term : 'Not finished yet',
      date: dateOfDay(day),
      finished,
      open: true,
      lockLine: null,
      day,
      topic: item.topic,
    });
  }
  return result;
}

export function oldTechList(state: SaveState, content: ContentBundle, today: LocalDate): ListEntry[] {
  const todayDay = dayNumber(today);
  const done = soloDone(state);
  const result: ListEntry[] = [];
  const items = builtOldTech(content);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const release = oldTechReleaseDay(item);
    const open = release <= todayDay;
    const finished = done.indexOf(item.id) !== -1;
    result.push({
      itemId: item.id,
      key: item.id,
      label: finished ? item.term : 'Not finished yet',
      finished,
      open,
      lockLine: open ? null : 'Opens ' + longDate(dateOfDay(release)) + '.',
      topic: 'old-tech',
    });
  }
  return result;
}

export function nextWord(
  state: SaveState,
  content: ContentBundle,
  mode: 'practice' | 'oldtech',
  today: LocalDate,
): { entry: ListEntry } | { message: string } {
  let list: ListEntry[];
  if (mode === 'practice') {
    list = practiceList(state, content, today);
  } else {
    list = oldTechList(state, content, today);
  }
  if (mode === 'practice') {
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].finished) return { entry: list[i] };
    }
    return { message: "You've done them all." };
  }
  for (let i = 0; i < list.length; i++) {
    if (list[i].open && !list[i].finished) return { entry: list[i] };
  }
  for (let i = 0; i < list.length; i++) {
    if (!list[i].open && !list[i].finished) {
      return { message: 'New old tech opens ' + list[i].lockLine!.slice('Opens '.length) };
    }
  }
  return { message: "You've done them all." };
}
