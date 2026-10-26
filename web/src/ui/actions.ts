// Small helpers several screens share.

import type { RoundMode } from '../engine/types';
import { engine } from './engine';
import { commit, getApp } from './store';
import { navigate } from './router';

/** Opening a round starts it (the engine keeps the existing record if it already started). */
export function openRound(key: string, itemId: string, mode: RoundMode): void {
  const app = getApp();
  if (!app.save || !app.content) return;
  commit(engine.startRound(app.save, app.content, key, itemId, mode, app.today));
  navigate('play', key);
}

/** A finished Practice or Old Tech word opens on its reveal, where "Play again" lives. */
export function openReveal(key: string): void {
  const app = getApp();
  if (!app.save || !app.content) return;
  const record = app.save.rounds[key];
  if (record && record.post_step !== 0) {
    commit(engine.applyRound(app.save, app.content, key, { type: 'postStep', step: 0 }, app.today).state);
  }
  navigate('play', key);
}

/** "1 bar", "2 bars": every count uses the singular at 1. */
export function plural(count: number, one: string, many: string): string {
  return count + ' ' + (count === 1 ? one : many);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri, Oct 30" from "2026-10-30", read as a local calendar date. */
export function shortDate(date: string): string {
  const parts = date.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return WEEKDAYS[d.getDay()].slice(0, 3) + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
}
