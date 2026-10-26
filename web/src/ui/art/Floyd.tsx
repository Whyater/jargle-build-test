import { Mascot } from './Mascot';
import type { MascotPose } from './Mascot';

type FloydProps = {
  size?: number;
  title?: string;
  wiggle?: boolean;
  pose?: MascotPose;
  talking?: boolean;
};

// Floyd is a 3.5 inch floppy disk. His label is his face.
export function Floyd({ size = 96, title, wiggle = false, pose = 'idle', talking = false }: FloydProps) {
  return <Mascot who="floyd" size={size} title={title} wiggle={wiggle} pose={pose} talking={talking} />;
}
