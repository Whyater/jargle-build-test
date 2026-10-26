import { playSound } from '../../platform/audio';
import { getApp } from '../store';

export type FeedbackKind = 'tap' | 'correct' | 'wrong' | 'levelUp';

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

/** Sound plus a buzz for a tap, a right answer, a wrong answer or a level-up. Off when Sound is off. */
export function feedback(kind: FeedbackKind): void {
  try {
    if (!soundIsOn()) return;

    if (kind === 'tap') {
      playSound('tap');
      vibrate(10);
      return;
    }
    if (kind === 'correct') {
      playSound('chime');
      vibrate(18);
      return;
    }
    if (kind === 'wrong') {
      playSound('tock');
      vibrate([30, 50, 30]);
      return;
    }

    playSound('chime');
    vibrate([20, 40, 20, 40, 60]);
    const playSecond = () => {
      try {
        if (soundIsOn()) playSound('ding');
      } catch (_error) {
        // A delayed sound must not interrupt a round.
      }
    };
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(playSecond, 180);
    } else {
      setTimeout(playSecond, 180);
    }
  } catch (_error) {
    // Feedback should never interrupt a round.
  }
}

/** Just a short buzz, no sound. Buttons, cards and tabs call this on every tap. */
export function buzz(): void {
  vibrate(8);
}
