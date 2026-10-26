// Small pure helpers for the Endless screen, kept apart so they are easy to test.

import type { EndlessAnswerResult, EndlessRun, Question, Speaker } from '../../engine/types';
import type { LineMood } from './endlessLines';

/** How long a right answer stays on screen before the next question. */
export const ADVANCE_MS = 900;

/**
 * The combo meter: 3 pips that fill toward the next multiplier.
 * Combo 0-2 fills toward x2, 3-5 toward x3, and from 6 the meter stays full.
 */
export function comboMeter(combo: number): { filled: number; next: number | null } {
  if (combo >= 6) return { filled: 3, next: null };
  if (combo >= 3) return { filled: combo - 3, next: 3 };
  return { filled: combo, next: 2 };
}

/** Which kind of line the mascot says after an answer. */
export function reactionMood(result: EndlessAnswerResult): LineMood {
  if (!result.correct) return 'wrong';
  // Cheer louder each time the combo reaches a new multiplier step.
  if (result.comboAfter === 3 || result.comboAfter === 6 || (result.comboAfter > 6 && result.comboAfter % 5 === 0)) {
    return 'combo';
  }
  return 'right';
}

/** Floyd and Bud take turns, one question each. */
export function speakerFor(turn: number): Speaker {
  return turn % 2 === 0 ? 'bud' : 'floyd';
}

/** Answers given so far in this run. */
export function answersGiven(run: EndlessRun): number {
  return run.answered ? run.asked : run.asked - 1;
}

/** Leaving before the first answer saves nothing; after that the run counts so its XP is kept. */
/**
 * Finishing a run adds its XP and counts a game, so it must happen only once. The first call
 * flips the flag and runs finish(); every later call does nothing. Returns true if it ran.
 */
export function finishRunOnce(saved: { current: boolean }, finish: () => void): boolean {
  if (saved.current) return false;
  saved.current = true;
  finish();
  return true;
}

export function shouldSaveOnLeave(run: EndlessRun | null, saved: boolean): boolean {
  if (!run || saved) return false;
  return answersGiven(run) > 0;
}

/** What the mascot says before an answer. It adds a nudge instead of repeating the question. */
export function hintFor(question: Question): string {
  if (question.kind === 'meaning') return 'Hmm, I think I know this one!';
  if (question.kind === 'name') return 'Picture it, then pick it.';
  if (question.kind === 'truefalse') return 'Trust your gut!';
  if (question.kind === 'oldnew') return 'Old like Floyd, or new like Bud?';
  return 'Fewer clues, more points!';
}

/** What a screen reader hears right after an answer. */
export function answerAnnouncement(result: EndlessAnswerResult, question: Question): string {
  const hearts = result.run.hearts === 1 ? '1 heart left' : result.run.hearts + ' hearts left';
  if (result.correct) {
    let text = 'Correct! Plus ' + result.points + ' points.';
    if (result.comboAfter >= 2) text += ' Combo ' + result.comboAfter + '.';
    return text;
  }
  let text = 'Not quite. The answer is ' + question.answer + '. ' + hearts + '.';
  if (result.run.over) text = 'Not quite. The answer is ' + question.answer + '. Out of hearts.';
  return text;
}

/** A new best only counts if the run scored something and beat the old best. */
export function isNewBest(score: number, oldBest: number): boolean {
  return score > 0 && score > oldBest;
}

/** A seed for a new run. Any whole number works; the time keeps runs different. */
export function newSeed(now: number): number {
  return Math.floor(now % 2147483647);
}
