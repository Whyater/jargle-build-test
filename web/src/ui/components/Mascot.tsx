import { useState } from 'preact/hooks';
import { playSound } from '../../platform/audio';
import { Mascot as MascotArt, poseForMood } from '../art';
import type { MascotPose } from '../art';
import type { Mood } from './art';
import type { Speaker } from '../../engine/types';

interface MascotProps {
  who: Speaker;
  size?: number;
  pose?: MascotPose;
  talking?: boolean;
  // Older screens still pass Bud's mood; a pose wins when both are given.
  mood?: Mood;
  /** Called on a tap too, so a speech bubble can show his next line. */
  onTap?: () => void;
}

/** A mascot you can tap: he wiggles, waves and makes his own sound. */
export function Mascot({ who, size = 72, pose, talking = false, mood, onTap }: MascotProps) {
  const [wiggle, setWiggle] = useState(false);
  const name = who === 'floyd' ? 'Floyd' : 'Bud';

  function sayHi() {
    // Restart the wiggle even on a quick second tap.
    setWiggle(false);
    window.setTimeout(() => setWiggle(true), 0);
    window.setTimeout(() => setWiggle(false), 320);
    playSound(who === 'floyd' ? 'whirr' : 'bloop');
    if (onTap) onTap();
  }

  let shown: MascotPose = pose || 'idle';
  if (!pose && mood) shown = poseForMood(mood);
  // A tap says hi with a quick wave.
  if (wiggle && shown === 'idle' && !talking) shown = 'wave';

  return (
    <button type="button" class="mascot-btn" aria-label={'Say hi to ' + name} onClick={sayHi}>
      <MascotArt who={who} size={size} pose={shown} talking={talking} wiggle={wiggle} />
    </button>
  );
}

/** Floyd and Bud side by side on one baseline. */
export function MascotPair({ size = 72, budMood }: { size?: number; budMood?: Mood }) {
  return (
    <div class="mascots">
      <Mascot who="floyd" size={size} />
      <Mascot who="bud" size={size} mood={budMood} />
    </div>
  );
}
