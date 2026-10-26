// XP and levels. XP comes from finished rounds, lessons and Endless answers.

import { copyState } from './state';
import type { LevelInfo, SaveState, XpAction } from './types';

/** XP for one action. */
export function xpFor(action: XpAction): number {
  if (action.type === 'lesson') return 30;
  if (action.type === 'endless') {
    if (!action.correct) return 0;
    // A small bonus once a combo is going.
    return action.combo >= 3 ? 15 : 10;
  }
  // A finished Clue Climb round. Dailies are worth the most.
  const bars = Math.max(0, action.bars);
  if (action.mode === 'daily') {
    return action.status === 'solved' ? 20 + 5 * bars : 10;
  }
  return action.status === 'solved' ? 10 + 2 * bars : 5;
}

/** XP needed to go from `level` to the next one: 30, 50, 70, ... */
export function xpForLevel(level: number): number {
  return 30 + 20 * (level - 1);
}

/** Level from total XP. Level 2 starts at 30 XP (three right answers in Endless). */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let left = Math.max(0, Math.floor(xp || 0));
  while (left >= xpForLevel(level)) {
    left -= xpForLevel(level);
    level++;
  }
  return { level: level, intoLevel: left, needed: xpForLevel(level) };
}

/** Returns a copy of the state with XP added. */
export function addXp(state: SaveState, amount: number): SaveState {
  const copy = copyState(state);
  copy.xp = (copy.xp || 0) + Math.max(0, Math.round(amount));
  return copy;
}
