// Daily Jargle: guess today's tech word in 6 tries, Wordle style.
// Green (correct) is the right letter in the right spot, yellow (present) is a letter that is in
// the word somewhere else, gray (absent) is a letter that is not in the word (or not again).

import type { BadgeId, ContentBundle, JargleRecord, JargleStatus, JargleTile, LocalDate, SaveState, TermItem } from './types';
import { dayNumber, addDays } from './dates';
import { addSortedNumber, addUnique, copyState, dailyItem } from './state';
import { awardBadges } from './badges';
import { xpFor } from './xp';

export const JARGLE_TRIES = 6;

/** How many of the item's own clues the game uses. The last unlock is a first-letter hint instead,
 *  because clue 5 often spells out letters of the full term, which can differ from the puzzle word. */
const ITEM_CLUES_USED = 4;

/** The answer: the item's `puzzle`, or the term's letters when that is 4 to 7 letters long. '' if neither works. */
export function puzzleAnswer(item: TermItem): string {
  if (item.puzzle && /^[A-Za-z]{4,7}$/.test(item.puzzle)) return item.puzzle.toUpperCase();
  const letters = item.term.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (/^[A-Z]{4,7}$/.test(letters)) return letters;
  return '';
}

/**
 * Colors one guess. First pass: exact matches are green, and every answer letter that was not
 * matched goes into a count. Second pass, left to right: a letter is yellow only while the answer
 * still has an unmatched copy of it, so a guess can't get more yellows than the answer has letters.
 */
export function scoreGuess(answer: string, guess: string): JargleTile[] {
  const a = answer.toUpperCase();
  const g = guess.toUpperCase();
  const tiles: JargleTile[] = [];
  const unmatched: Record<string, number> = {};

  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      tiles.push('correct');
    } else {
      tiles.push('absent');
      unmatched[a[i]] = (unmatched[a[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (tiles[i] === 'correct') continue;
    const letter = g[i];
    if (unmatched[letter] > 0) {
      tiles[i] = 'present';
      unmatched[letter] = unmatched[letter] - 1;
    }
  }
  return tiles;
}

/** The best color each letter has earned so far, for the on-screen keyboard. */
export function keyboardStates(answer: string, guesses: string[]): Record<string, JargleTile> {
  const states: Record<string, JargleTile> = {};
  const rank: Record<JargleTile, number> = { absent: 1, present: 2, correct: 3 };
  for (const rawGuess of guesses) {
    const guess = rawGuess.toUpperCase();
    const tiles = scoreGuess(answer, guess);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const old = states[letter];
      if (!old || rank[tiles[i]] > rank[old]) states[letter] = tiles[i];
    }
  }
  return states;
}

/** Can this guess be played? `words` is the word list (null means any letters are fine). */
export function checkGuess(
  guess: string,
  length: number,
  words: Set<string> | null,
): 'ok' | 'short' | 'letters' | 'notword' {
  if (guess.length < length) return 'short';
  if (guess.length !== length || !/^[A-Za-z]+$/.test(guess)) return 'letters';
  if (words && !words.has(guess.toUpperCase())) return 'notword';
  return 'ok';
}

export function jargleDay(_content: ContentBundle, today: LocalDate): number {
  return dayNumber(today);
}

export function jargleItem(content: ContentBundle, day: number): TermItem | null {
  return dailyItem(content, day);
}

/** Clue 1 shows from the start and each wrong guess unlocks one more. Once the game is over, all show. */
export function cluesShown(item: TermItem, guessCount: number, status: JargleStatus): string[] {
  const all: string[] = item.clues.slice(0, ITEM_CLUES_USED);
  const answer = puzzleAnswer(item);
  if (answer) all.push('It starts with ' + answer[0] + '.');
  if (status !== 'playing') return all;
  return all.slice(0, Math.min(all.length, guessCount + 1));
}

export interface JargleView {
  day: number;
  /** The day number as a string, the key in SaveState.jargle. */
  key: string;
  item: TermItem;
  /** Letters in the answer, 4 to 7. */
  length: number;
  rows: { guess: string; tiles: JargleTile[] }[];
  status: JargleStatus;
  triesLeft: number;
  clues: string[];
  keyboard: Record<string, JargleTile>;
  /** Only once the game is over, so the screen can't leak it early. */
  answer: string | null;
  started: boolean;
  finished: boolean;
}

/** Today's game, or null when today has no word (or before launch). */
export function jargleView(state: SaveState, content: ContentBundle, today: LocalDate): JargleView | null {
  const day = jargleDay(content, today);
  if (day < 1) return null;
  const item = jargleItem(content, day);
  if (!item) return null;
  const answer = puzzleAnswer(item);
  if (!answer) return null;

  const key = String(day);
  const record = state.jargle ? state.jargle[key] : undefined;
  const status: JargleStatus = record ? record.status : 'playing';
  const guesses = record ? record.guesses : [];
  const rows = [];
  for (const guess of guesses) {
    rows.push({ guess: guess, tiles: scoreGuess(answer, guess) });
  }
  return {
    day: day,
    key: key,
    item: item,
    length: answer.length,
    rows: rows,
    status: status,
    triesLeft: Math.max(0, JARGLE_TRIES - guesses.length),
    clues: cluesShown(item, guesses.length, status),
    keyboard: keyboardStates(answer, guesses),
    answer: status === 'playing' ? null : answer,
    started: !!record,
    finished: status !== 'playing',
  };
}

export interface JargleGuessResult {
  state: SaveState;
  outcome: 'next' | 'won' | 'lost' | 'ignored';
  tiles: JargleTile[];
  xpGained: number;
  newBadges: BadgeId[];
}

/**
 * Plays one guess and returns a new state. The screen checks the word list first.
 * When the game ends this does the same bookkeeping as a finished daily clue round
 * (XP, Days learned, streak, Review, badges), so the rest of the app stays in step.
 */
export function submitJargleGuess(
  state: SaveState,
  content: ContentBundle,
  today: LocalDate,
  guess: string,
): JargleGuessResult {
  const view = jargleView(state, content, today);
  if (!view || view.finished || guess.length !== view.length || !/^[A-Za-z]+$/.test(guess)) {
    return { state: state, outcome: 'ignored', tiles: [], xpGained: 0, newBadges: [] };
  }

  const s = copyState(state);
  if (!s.jargle) s.jargle = {};
  let record: JargleRecord | undefined = s.jargle[view.key];
  if (!record) {
    record = { guesses: [], status: 'playing', started_on: today };
    if (s.firstPlayDay === null) s.firstPlayDay = dayNumber(today);
  }

  const answer = puzzleAnswer(view.item);
  const upper = guess.toUpperCase();
  const tiles = scoreGuess(answer, upper);
  record.guesses = record.guesses.concat([upper]);

  let outcome: 'next' | 'won' | 'lost' = 'next';
  if (upper === answer) {
    record.status = 'won';
    outcome = 'won';
  } else if (record.guesses.length >= JARGLE_TRIES) {
    record.status = 'lost';
    outcome = 'lost';
  }
  s.jargle[view.key] = record;

  if (outcome === 'next') {
    return { state: s, outcome: outcome, tiles: tiles, xpGained: 0, newBadges: [] };
  }

  // The game is over.
  record.finished_on = today;
  const alreadyCounted = (state.countedDays || []).indexOf(view.day) !== -1;
  const xp = alreadyCounted
    ? 0
    : xpFor({ type: 'jargle', won: outcome === 'won', guesses: record.guesses.length });
  record.xp_paid = xp;
  s.xp = (s.xp || 0) + xp;
  s.flags.firstRoundDone = true;
  if (!s.lastFinished) s.lastFinished = {};
  s.lastFinished[view.item.id] = today;
  // It can only be played on its own day, so a finished game always counts.
  addSortedNumber(s.finishedDays || (s.finishedDays = []), view.day);
  addSortedNumber(s.countedDays || (s.countedDays = []), view.day);
  addUnique(s.soloDone || (s.soloDone = []), view.item.id);
  if (!s.review[view.item.id]) {
    const due = [addDays(today, 1), addDays(today, 3), addDays(today, 7)];
    // A loss or a close call comes back one extra time, like a clue round with few bars left.
    if (outcome === 'lost' || record.guesses.length >= 5) due.push(addDays(today, 2));
    due.sort();
    s.review[view.item.id] = due;
  }
  const newBadges = awardBadges(s, content, today);
  return { state: s, outcome: outcome, tiles: tiles, xpGained: xp, newBadges: newBadges };
}

function tileEmoji(tile: JargleTile): string {
  if (tile === 'correct') return '🟩';
  if (tile === 'present') return '🟨';
  return '⬜';
}

/** "Jargle Day 2 3/6", the colored rows (no letters), then the link. '' until the game is over. */
export function jargleShareText(
  state: SaveState,
  content: ContentBundle,
  day: number,
  opts: { appUrl: string; demo: boolean },
): string {
  const record = state.jargle ? state.jargle[String(day)] : undefined;
  const item = jargleItem(content, day);
  if (!record || record.status === 'playing' || !item) return '';
  const answer = puzzleAnswer(item);
  const title = opts.demo ? 'Jargle demo' : 'Jargle Day ' + day;
  const score = record.status === 'won' ? record.guesses.length + '/6' : 'X/6';
  const rows: string[] = [];
  for (const guess of record.guesses) {
    let row = '';
    for (const tile of scoreGuess(answer, guess)) row += tileEmoji(tile);
    rows.push(row);
  }
  return title + ' ' + score + '\n\n' + rows.join('\n') + '\n\n' + opts.appUrl;
}

/** The result card's heading. */
export function jargleResultLine(view: JargleView): string | null {
  if (view.status === 'playing') return null;
  if (view.status === 'won') {
    return view.rows.length === 1 ? 'First try! Wow.' : 'You got it in ' + view.rows.length + '!';
  }
  return "Good try! Here's today's word.";
}
