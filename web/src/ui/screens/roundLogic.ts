import type { ContentBundle, RoundMode } from '../../engine/types';
import type { RoundResult } from '../../engine/api';

export const newBadgesByRound = new Map<string, RoundResult['newBadges']>();

/** Find the widest message the round strip may need to hold. */
export function tallestMessage(content: ContentBundle): string {
  const messages: string[] = [
    'Careful: a wrong guess now ends the round. It still counts.',
    'Selected. Now tap Check.',
    'Tap a word first.',
    'Tap a word first. Careful: a wrong guess now ends the round. It still counts.',
    // The longest Next clue message: the first clue after a miss, with the warning added.
    "Clue 2 shown. 2 bars left. After a wrong guess, you can't reach the last clue. " +
      'Careful: a wrong guess now ends the round. It still counts.',
  ];

  content.missLines.either.forEach((line) => messages.push(line.text));
  content.missLines.floyd.forEach((line) => messages.push(line.text));

  let longest = messages[0];
  for (let index = 1; index < messages.length; index += 1) {
    if (messages[index].length > longest.length) longest = messages[index];
  }
  return longest;
}

/** Next clue taps less than 700 ms apart count only once. */
export function shouldIgnoreNextClue(lastTapMs: number | null, nowMs: number): boolean {
  return lastTapMs !== null && nowMs - lastTapMs < 700;
}

/** Keep the previous strip message unless a tap supplied a replacement. */
export function stripTextAfterTap(
  previous: string | null,
  resultMessage: string | null,
  warning: string | null,
  actionType: string,
): string | null {
  if (actionType === 'select' && warning !== null) return warning;
  if (actionType === 'check' && resultMessage === 'Tap a word first.' && warning !== null) {
    return resultMessage + ' ' + warning;
  }
  if (resultMessage !== null) return resultMessage;
  if (warning !== null) return warning;
  return previous;
}

/**
 * "Play again" is for finished solo words opened from Practice or Old Tech. Past dailies keep
 * their daily record (Home and Practice share one round), so any daily before today counts too.
 * Today's daily and Pass the Phone rounds never offer it.
 */
export function canPlayAgain(key: string, mode: RoundMode, todayNumber: number): boolean {
  if (mode === 'ptp' || key.indexOf('ptp:') === 0) return false;
  if (mode === 'practice' || mode === 'oldtech') return true;
  if (key.indexOf('d:') === 0) return Number(key.slice(2)) < todayNumber;
  return false;
}

/** XP each round earned when it ended on this visit, shown on the reveal. */
export const xpByRound = new Map<string, number>();

/** Rounds that ended on this visit. Only these get the confetti on the reveal. */
export const justEnded = new Set<string>();

/** The big happy line on the reveal. */
export function cheerLine(status: string): string {
  return status === 'solved' ? 'You got it!' : 'Good try!';
}

/**
 * Splits "6 bars left. An extra clue costs 1." into the count part and the rules part.
 * The big number already shows the count, so only the rules are shown; the count stays
 * in the line for screen readers.
 */
export function splitBatteryLine(line: string): { count: string; rules: string } {
  const cut = line.indexOf('. ');
  if (cut === -1) return { count: line, rules: '' };
  return { count: line.slice(0, cut + 1), rules: line.slice(cut + 2) };
}
