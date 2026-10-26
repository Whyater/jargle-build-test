import type { ContentBundle, SaveState } from '../../engine/types';
import type { HomeView } from '../../engine/api';

export function todayItemId(content: ContentBundle, today: string): string | null {
  for (const day of content.schedule.days) if (day.date === today) return day.term;
  return null;
}

export function judgeLineVisible(show: boolean, demo: 'judge' | 'new' | null): boolean {
  return show && demo !== 'judge';
}

export function msUntilTomorrow(now: Date): number {
  const tomorrow = new Date(now.getTime());
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(0, tomorrow.getTime() - now.getTime());
}

export function countdownText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(Math.max(0, ms) / 60000));
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? hours + 'h' : hours + 'h ' + rest + 'm';
}

export function readXp(save: SaveState): number {
  const value = (save as SaveState & { xp?: unknown }).xp;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function readEndlessBest(save: SaveState): number {
  const value = (save as SaveState & { endlessBest?: unknown }).endlessBest;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export interface LevelInfo {
  level: number;
  intoLevel: number;
  needed: number;
}

export function fallbackLevel(xp: number): LevelInfo {
  let remaining = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = 1;
  let needed = 30;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = 30 + (level - 1) * 20;
  }
  return { level: level, intoLevel: Math.floor(remaining), needed: needed };
}

export type WotdState =
  { kind: 'play' } | { kind: 'continue' } | { kind: 'solved'; bars: number } | { kind: 'missed' } | { kind: 'none' };

export function wotdState(view: HomeView, save: SaveState): WotdState {
  if (!view.today) return { kind: 'none' };
  if (!view.today.finished) return view.today.started ? { kind: 'continue' } : { kind: 'play' };
  const record = save.rounds[view.today.key];
  if (record && record.status === 'solved') {
    return { kind: 'solved', bars: record.end_bars ?? 0 };
  }
  return { kind: 'missed' };
}

export const INTRO_KEY = 'jargle:introSeen';

export function introSeen(): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return true;
    return storage.getItem(INTRO_KEY) === '1';
  } catch {
    return true;
  }
}

export function markIntroSeen(): void {
  try {
    globalThis.localStorage?.setItem(INTRO_KEY, '1');
  } catch {
    // Storage can be blocked by browser privacy settings.
  }
}

// The level Play last showed, so a level-up gets celebrated once when the player comes back.
export const LEVEL_KEY = 'jargle:seenLevel';

/** The last level Play celebrated, or 0 if it never showed one (or storage is blocked). */
export function seenLevel(): number {
  try {
    const value = Number(globalThis.localStorage.getItem(LEVEL_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function markSeenLevel(level: number): void {
  try {
    globalThis.localStorage.setItem(LEVEL_KEY, String(level));
  } catch {
    // Storage can be blocked by browser privacy settings.
  }
}

/** Celebrate only a real climb: not on the very first visit, and not when nothing changed. */
export function shouldCelebrateLevel(seen: number, level: number): boolean {
  return seen > 0 && level > seen;
}

export interface Greeting {
  who: 'floyd' | 'bud';
  pose: string;
  text: string;
}

/** What the mascot says at the top of Play. Picks a line from the word's state and the hour. */
export function greetingFor(kind: WotdState['kind'], streak: number, hour: number): Greeting {
  if (kind === 'solved') return { who: 'bud', pose: 'happy', text: 'You got it! Keep going in Endless?' };
  if (kind === 'missed') return { who: 'floyd', pose: 'happy', text: 'New word learned! Try Endless next?' };
  if (kind === 'continue') return { who: 'bud', pose: 'think', text: "Your word is waiting. Let's finish it!" };
  if (kind === 'none') return { who: 'floyd', pose: 'think', text: 'New words soon. Endless is open!' };
  if (streak >= 2) return { who: 'floyd', pose: 'happy', text: streak + ' days in a row! Keep it going.' };
  let hello = 'Hi there!';
  if (hour >= 5 && hour < 12) hello = 'Good morning!';
  else if (hour >= 12 && hour < 18) hello = 'Good afternoon!';
  else if (hour >= 18 || hour < 5) hello = 'Good evening!';
  return { who: 'bud', pose: 'wave', text: hello + " Today's word is ready." };
}
