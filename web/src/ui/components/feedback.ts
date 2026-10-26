import { playCombo, playCorrect, playHeartLost, playLevelUp, playTap, playWrong } from '../../platform/audio';
import { getApp } from '../store';

export type FeedbackKind = 'tap' | 'correct' | 'wrong' | 'levelUp' | 'combo' | 'heartLost';

function soundIsOn(): boolean {
  try {
    return getApp().save?.settings.sound !== false;
  } catch (_error) {
    return true;
  }
}

function vibrate(pattern: number | number[]): void {
  if (!soundIsOn() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch (_error) {
    // Some browsers reject vibration until the page has focus.
  }
}

/** Sound plus a buzz for a tap, an answer, a combo step, a lost heart or a level-up. Off when Sound is off.
 * comboLevel only matters for 'combo': 1, 2, 3... and the chime climbs with it. */
export function feedback(kind: FeedbackKind, comboLevel = 1): void {
  try {
    if (!soundIsOn()) return;

    if (kind === 'tap') {
      playTap();
      vibrate(10);
      return;
    }
    if (kind === 'correct') {
      playCorrect();
      vibrate(18);
      return;
    }
    if (kind === 'combo') {
      playCombo(comboLevel);
      vibrate(18);
      return;
    }
    if (kind === 'wrong') {
      playWrong();
      vibrate([30, 50, 30]);
      return;
    }
    if (kind === 'heartLost') {
      playHeartLost();
      vibrate([30, 50, 30]);
      return;
    }

    playLevelUp();
    vibrate([20, 40, 20, 40, 60]);
  } catch (_error) {
    // Feedback should never interrupt a round.
  }
}

/** A short buzz and a soft tap sound. Buttons, cards and tabs call this on every tap. */
export function buzz(): void {
  if (!soundIsOn()) return;
  try {
    playTap();
  } catch (_error) {
    // A tap sound must not break a button.
  }
  vibrate(8);
}
