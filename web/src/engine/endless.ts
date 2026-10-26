// Endless mode: mixed quick questions, 3 hearts, a combo multiplier, and a
// best score. A run is plain data; only finishEndless touches the save.

import type { ContentBundle, EndlessAnswer, EndlessAnswerResult, EndlessRun, LocalDate, SaveState } from './types';
import { dayNumber } from './dates';
import { builtOldTech, copyState, oldTechReleaseDay } from './state';
import { seededRandom } from './text';
import { xpFor } from './xp';
import { QUESTION_KINDS, TILES_CHANCE, buildQuestion, canSpell, isCorrect } from './questions';

export const ENDLESS_HEARTS = 3;

function addToPool(content: ContentBundle, list: string[], id: string): void {
  if (content.items[id] && list.indexOf(id) === -1) list.push(id);
}

/** Item ids released by today: dailies up to today, open Old Tech, Pass the Phone extras, bank words. */
export function endlessPool(content: ContentBundle, today: LocalDate): string[] {
  const result: string[] = [];
  const todayDay = dayNumber(today);
  for (let i = 0; i < content.schedule.days.length; i++) {
    const entry = content.schedule.days[i];
    const day = dayNumber(entry.date);
    if (day >= 1 && day <= todayDay) addToPool(content, result, entry.term);
  }
  const old = builtOldTech(content);
  for (let i = 0; i < old.length; i++) {
    if (oldTechReleaseDay(old[i]) <= todayDay) addToPool(content, result, old[i].id);
  }
  for (let i = 0; i < content.ptpExtras.length; i++) addToPool(content, result, content.ptpExtras[i]);
  // Bank words are never daily words, so they are safe to ask from day 1.
  if (todayDay >= 1) {
    const ids = Object.keys(content.items).sort();
    for (let i = 0; i < ids.length; i++) {
      if (content.items[ids[i]].bank === true) addToPool(content, result, ids[i]);
    }
  }
  return result;
}

/** x1, x2 from a combo of 3, x3 from a combo of 6. */
export function comboMultiplier(combo: number): number {
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

/** A new run with its first question ready. Same seed and inputs = same run. */
export function startEndless(_state: SaveState, content: ContentBundle, today: LocalDate, seed: number): EndlessRun {
  const run: EndlessRun = {
    seed: seed,
    today: today,
    pool: endlessPool(content, today),
    used: [],
    question: null,
    answered: false,
    asked: 0,
    correct: 0,
    score: 0,
    hearts: ENDLESS_HEARTS,
    combo: 0,
    bestCombo: 0,
    xp: 0,
    over: false,
  };
  if (run.pool.length === 0) return { ...run, over: true };
  return nextEndlessQuestion(run, content);
}

/** Scores the current question. Does not move on; call nextEndlessQuestion after showing the why line. */
export function answerEndless(run: EndlessRun, answer: EndlessAnswer): EndlessAnswerResult {
  if (run.over || run.answered || !run.question) {
    return { run: copyRun(run), correct: false, points: 0, xpGained: 0, comboAfter: run.combo, multiplier: 1 };
  }
  const next = copyRun(run);
  const right = isCorrect(run.question, answer.choice);
  let points = 0;
  let xpGained = 0;
  let multiplier = 1;
  if (right) {
    next.combo = run.combo + 1;
    next.correct = run.correct + 1;
    next.bestCombo = Math.max(run.bestCombo, next.combo);
    multiplier = comboMultiplier(next.combo);
    let base = 10;
    if (run.question.kind === 'tiles') {
      const tileScore = answer.tileScore;
      if (tileScore !== undefined && !Number.isNaN(tileScore)) {
        base = Math.max(10, Math.min(18, Math.round(tileScore)));
      }
    } else if (run.question.kind === 'clue') {
      const clues = Math.max(1, Math.min(3, answer.cluesUsed || 1));
      if (clues === 1) {
        base = 30;
      } else if (clues === 2) {
        base = 20;
      } else {
        base = 10;
      }
    }
    points = base * multiplier;
    next.score = run.score + points;
    xpGained = xpFor({ type: 'endless', correct: true, combo: next.combo });
    next.xp = run.xp + xpGained;
  } else {
    next.combo = 0;
    next.hearts = Math.max(0, run.hearts - 1);
    if (next.hearts <= 0) next.over = true;
  }
  next.answered = true;
  return { run: next, correct: right, points, xpGained, comboAfter: next.combo, multiplier };
}

/** Picks the next question. Returns the run unchanged if it is over. */
export function nextEndlessQuestion(run: EndlessRun, content: ContentBundle): EndlessRun {
  if (run.over) return copyRun(run);
  const seedText = run.seed + ':' + run.asked;
  const random = seededRandom(seedText + ':pick');
  const tilesRandom = seededRandom(seedText + ':tiles');
  let maxDifficulty = 3;
  if (run.correct < 3) {
    maxDifficulty = 1;
  } else if (run.correct < 8) {
    maxDifficulty = 2;
  }
  // Skip ids missing from this content (a run kept across a content update).
  const pool: string[] = [];
  for (let i = 0; i < run.pool.length; i++) {
    if (content.items[run.pool[i]]) pool.push(run.pool[i]);
  }
  if (pool.length === 0) {
    const ended = copyRun(run);
    ended.over = true;
    return ended;
  }
  let used = run.used.slice();
  let candidates: string[] = [];
  for (let i = 0; i < pool.length; i++) {
    const id = pool[i];
    if (used.indexOf(id) === -1 && content.items[id].difficulty <= maxDifficulty) candidates.push(id);
  }
  if (candidates.length === 0) {
    for (let i = 0; i < pool.length; i++) {
      const id = pool[i];
      if (used.indexOf(id) === -1) candidates.push(id);
    }
  }
  if (candidates.length === 0) {
    used = [];
    const current = run.question;
    candidates = [];
    for (let i = 0; i < pool.length; i++) {
      const id = pool[i];
      if (!current || pool.length === 1 || id !== current.itemId) candidates.push(id);
    }
    const filtered: string[] = [];
    for (let i = 0; i < candidates.length; i++) {
      if (content.items[candidates[i]].difficulty <= maxDifficulty) filtered.push(candidates[i]);
    }
    if (filtered.length > 0) candidates = filtered;
  }
  const current = run.question;
  let wantTiles = (!current || current.kind !== 'tiles') && tilesRandom() < TILES_CHANCE;
  if (wantTiles) {
    const tileCandidates: string[] = [];
    for (let i = 0; i < candidates.length; i++) {
      if (canSpell(content.items[candidates[i]].term)) tileCandidates.push(candidates[i]);
    }
    if (tileCandidates.length > 0) {
      candidates = tileCandidates;
    } else {
      wantTiles = false;
    }
  }
  const itemId = candidates[Math.floor(random() * candidates.length)];
  let kinds = QUESTION_KINDS;
  if (current) {
    kinds = [];
    for (let i = 0; i < QUESTION_KINDS.length; i++) {
      if (QUESTION_KINDS[i] !== current.kind) kinds.push(QUESTION_KINDS[i]);
    }
  }
  const kind = wantTiles ? 'tiles' : kinds[Math.floor(random() * kinds.length)];
  const question = buildQuestion(content, itemId, kind, seedText);
  used.push(itemId);
  return { ...run, used, question, asked: run.asked + 1, answered: false };
}

/** Ends the run: saves the best score, counts the game and adds the run's XP. Call it once per run. */
export function finishEndless(state: SaveState, run: EndlessRun, today: LocalDate): SaveState {
  const result = copyState(state);
  result.endlessBest = Math.max(result.endlessBest || 0, run.score);
  result.endlessGames = (result.endlessGames || 0) + 1;
  result.xp = (result.xp || 0) + run.xp;
  result.endlessLastDay = today;
  return result;
}

function copyRun(run: EndlessRun): EndlessRun {
  return { ...run, used: run.used.slice(), pool: run.pool.slice() };
}
