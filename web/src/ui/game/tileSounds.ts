// Sounds for the letter tiles. The new tile sounds (tilePick, tilePlace, tileReturn) are being
// added to audio.ts separately; until they land, each one borrows the closest existing sound.

import { playSound } from '../../platform/audio';
import type { SoundName } from '../../platform/audio';
import { buzz, feedback } from '../components/feedback';
import { getApp } from '../store';

export type TileSoundName = 'tilePick' | 'tilePlace' | 'tileReturn' | 'correct' | 'wrong';

// Swap these for the real names once audio.ts has them.
const FALLBACK: Record<'tilePick' | 'tilePlace' | 'tileReturn', SoundName> = {
  tilePick: 'tap',
  tilePlace: 'flick',
  tileReturn: 'tap',
};

function soundIsOn(): boolean {
  try {
    return getApp().save?.settings.sound !== false;
  } catch (_error) {
    return true;
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
    playSound(FALLBACK[name]);
    buzz();
  } catch (_error) {
    // A sound must never break the game.
  }
}
