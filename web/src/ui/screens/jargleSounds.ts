// Sounds for Daily Jargle. Each game moment has its own function, so the screen reads plainly.
// They use the current sound set for now. When the new keyPress, flip, win and lose sounds land
// in platform/audio.ts, only the names in this file need to change.

import { playSound } from '../../platform/audio';
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
  if (soundIsOn()) playSound('tap');
}

/** One tile turning over. `col` is its place in the row (0 is the first letter). */
export function flipSound(_col: number): void {
  if (soundIsOn()) playSound('flick');
}

export function winSound(): void {
  if (!soundIsOn()) return;
  playSound('chime');
  vibrate([20, 40, 20, 40, 60]);
  window.setTimeout(() => {
    if (soundIsOn()) playSound('ding');
  }, 180);
}

export function loseSound(): void {
  if (soundIsOn()) playSound('twoNotes');
}

/** A guess that can't be used (too short, not a word). */
export function invalidSound(): void {
  if (!soundIsOn()) return;
  playSound('tock');
  vibrate([30, 50, 30]);
}
