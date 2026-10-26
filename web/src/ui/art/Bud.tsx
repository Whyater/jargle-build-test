import { Mascot } from './Mascot';
import type { MascotPose } from './Mascot';

export type BudMood = 'idle' | 'happy' | 'sympathetic';

type BudProps = {
  size?: number;
  title?: string;
  wiggle?: boolean;
  mood?: BudMood;
  pose?: MascotPose;
  talking?: boolean;
};

// Older screens pass a mood instead of a pose. A miss shows his "oops" face,
// which is a little surprised but never sad.
export function poseForMood(mood: BudMood): MascotPose {
  if (mood === 'happy') return 'happy';
  if (mood === 'sympathetic') return 'oops';
  return 'idle';
}

// Bud is a phone. His screen is his face.
export function Bud({ size = 96, title, wiggle = false, mood = 'idle', pose, talking = false }: BudProps) {
  const shown = pose || poseForMood(mood);
  return <Mascot who="bud" size={size} title={title} wiggle={wiggle} pose={shown} talking={talking} />;
}
