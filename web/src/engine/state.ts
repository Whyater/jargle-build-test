// Fresh save state, copying, and small lookups shared by the other modules.

import { dateOfDay } from './dates';
import type { ContentBundle, LocalDate, RoundRecord, SaveState, ScheduleDay, TermItem } from './types';

export function newState(): SaveState {
  return {
    v: 1,
    rounds: {},
    ptpSet: null,
    ptpTotal: 0,
    ptpBest: 0,
    firstPlayDay: null,
    review: {},
    reviewSeen: {},
    lessons: {},
    badges: {},
    missLineIndex: { floyd: 0, bud: 0 },
    settings: { textSize: 'normal', sound: true, reducedMotion: false },
    flags: { firstRoundDone: false, textSizeAsked: false, inAppNoteHidden: false, persistAsked: false },
    countedDays: [],
    finishedDays: [],
    soloDone: [],
    lastFinished: {},
  };
}

/**
 * Deep copy, so every engine function can return a new state and leave the
 * old one untouched (the UI keeps the old one for "Undo").
 * The state is plain JSON, so a JSON round trip is enough.
 */
export function copyState(state: SaveState): SaveState {
  const copy: SaveState = JSON.parse(JSON.stringify(state));
  // States saved before these fields existed get empty ones.
  if (!copy.countedDays) copy.countedDays = [];
  if (!copy.finishedDays) copy.finishedDays = [];
  if (!copy.soloDone) copy.soloDone = [];
  if (!copy.lastFinished) copy.lastFinished = {};
  return copy;
}

// Readers that treat a missing field as empty.
export function countedDays(state: SaveState): number[] {
  return state.countedDays || [];
}
export function finishedDays(state: SaveState): number[] {
  return state.finishedDays || [];
}
export function soloDone(state: SaveState): string[] {
  return state.soloDone || [];
}
export function lastFinished(state: SaveState): Record<string, LocalDate> {
  return state.lastFinished || {};
}

/** Adds a number to a sorted list if it is not there yet. */
export function addSortedNumber(list: number[], n: number): void {
  if (list.indexOf(n) !== -1) return;
  list.push(n);
  list.sort(function (a, b) {
    return a - b;
  });
}

export function addUnique(list: string[], value: string): void {
  if (list.indexOf(value) === -1) list.push(value);
}

// --- Round keys ---------------------------------------------------------------

export function dailyKey(day: number): string {
  return 'd:' + day;
}

/** Day number from a "d:{day}" key, or null for other keys. */
export function dayFromKey(key: string): number | null {
  if (key.indexOf('d:') !== 0) return null;
  const day = Number(key.slice(2));
  return isNaN(day) ? null : day;
}

export function ptpKey(setId: number, round: number): string {
  return 'ptp:' + setId + ':' + round;
}

export function isEnded(record: RoundRecord | undefined): boolean {
  return !!record && record.status !== 'playing';
}

// --- Content lookups -------------------------------------------------------

/** The schedule entry for a day, only if its item is actually in the bundle. */
export function scheduleEntry(content: ContentBundle, day: number): ScheduleDay | null {
  const date = dateOfDay(day);
  for (let i = 0; i < content.schedule.days.length; i++) {
    const entry = content.schedule.days[i];
    if (entry.date === date && content.items[entry.term]) return entry;
  }
  return null;
}

export function dailyItem(content: ContentBundle, day: number): TermItem | null {
  const entry = scheduleEntry(content, day);
  return entry ? content.items[entry.term] : null;
}

/** Old Tech items that are built, in their fixed order (at most 20). */
export function builtOldTech(content: ContentBundle): TermItem[] {
  const list: TermItem[] = [];
  for (let i = 0; i < content.oldTech.length && list.length < 20; i++) {
    const item = content.items[content.oldTech[i]];
    if (item) list.push(item);
  }
  return list;
}

/** Old Tech opens on Day 1 unless the item has a later release_day. */
export function oldTechReleaseDay(item: TermItem): number {
  return item.release_day && item.release_day > 1 ? item.release_day : 1;
}
