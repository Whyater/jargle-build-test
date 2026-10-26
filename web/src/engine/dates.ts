// Day math on local calendar dates ("YYYY-MM-DD").
// We never add hours to a timestamp: on Nov 1 the clocks fall back and a
// "day" is 25 hours long. Instead we treat each Y-M-D as a UTC midnight,
// where every day is exactly 24 hours.

import type { LocalDate } from './types';

/** Day 1 is Sun Oct 25, 2026. */
export const LAUNCH_DATE: LocalDate = '2026-10-25';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toUtcMs(date: LocalDate): number {
  const parts = date.split('-');
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

/** The phone's local date right now. */
export function todayLocal(now: Date): LocalDate {
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Whole days from a to b (b minus a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** Day 1 is launch day. Days before launch are 0 or negative. */
export function dayNumber(date: LocalDate): number {
  return daysBetween(LAUNCH_DATE, date) + 1;
}

export function dateOfDay(day: number): LocalDate {
  return addDays(LAUNCH_DATE, day - 1);
}

/** "Monday, October 26" */
export function longDate(date: LocalDate): string {
  const d = new Date(toUtcMs(date));
  return WEEKDAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
}
