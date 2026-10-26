// Sounds for Daily Jargle. Each game moment has its own function, so the screen reads plainly.

import { playFlip, playKeyPress, playLose, playWin, playWrong } from '../../platform/audio';
import { getApp } from '../store';

function soundIsOn(): boolean {
  const save = getApp().save;
  return !save || save.settings.sound !== false;
}

function vibrate(pattern: number | number[]): void {
  if (!soundIsOn() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch (_error) {
    // Some browsers refuse to vibrate until the page has focus.
  }
}

export function keySound(): void {
  if (soundIsOn()) playKeyPress();
}

/** One tile turning over. `col` is its place in the row (0 is the first letter), so a row plays a little rising tune. */
export function flipSound(col: number): void {
  if (soundIsOn()) playFlip(col);
}

export function winSound(): void {
  if (!soundIsOn()) return;
  playWin();
  vibrate([20, 40, 20, 40, 60]);
}

export function loseSound(): void {
  if (soundIsOn()) playLose();
}

/** A guess that can't be used (too short, not a word). */
export function invalidSound(): void {
  if (!soundIsOn()) return;
  playWrong();
  vibrate([30, 50, 30]);
}
