// Sounds for the letter tiles. Each tile move has its own soft sound in audio.ts.

import { playTilePick, playTilePlace, playTileReturn } from '../../platform/audio';
import { feedback } from '../components/feedback';
import { getApp } from '../store';

export type TileSoundName = 'tilePick' | 'tilePlace' | 'tileReturn' | 'correct' | 'wrong';

function soundIsOn(): boolean {
  try {
    return getApp().save?.settings.sound !== false;
  } catch (_error) {
    return true;
  }
}

// A tiny buzz on phones. Not buzz() from feedback, because that also plays the button tap sound.
function smallBuzz(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(8);
  } catch (_error) {
    // Some browsers refuse to vibrate until the page has focus.
  }
}

/** Plays a tile sound with a tiny buzz. Respects the Sound and buzz setting. */
export function tileSound(name: TileSoundName): void {
  try {
    if (name === 'correct' || name === 'wrong') {
      feedback(name);
      return;
    }
    if (!soundIsOn()) return;
    if (name === 'tilePick') playTilePick();
    else if (name === 'tilePlace') playTilePlace();
    else playTileReturn();
    smallBuzz();
  } catch (_error) {
    // A sound must never break the game.
  }
}
