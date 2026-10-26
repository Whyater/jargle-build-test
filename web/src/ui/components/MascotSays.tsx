import { useState } from 'preact/hooks';
import { Mascot } from './Mascot';
import { SpeechBubble } from './SpeechBubble';
import type { Speaker } from '../../engine/types';

interface MascotSaysProps {
  who: Speaker;
  text: string;
  /** Pose name for the new mascot art (idle, talk, happy, oops, think, wave). */
  pose?: string;
  size?: number;
  /** Mascot on the right, bubble on the left. */
  flip?: boolean;
}

/** A mascot with a typed-out speech bubble next to him. His mouth moves while the line types. */
export function MascotSays({ who, text, pose = 'idle', size = 88, flip }: MascotSaysProps) {
  const [talking, setTalking] = useState(false);
  // The mascot art takes pose and talking once its new version lands; until then they are ignored.
  const extra = { pose, talking } as Record<string, unknown>;
  return (
    <div class={flip ? 'says flip' : 'says'}>
      <div class="says-mascot">
        <Mascot who={who} size={size} {...extra} />
      </div>
      <SpeechBubble text={text} tail={flip ? 'right' : 'left'} onTyping={setTalking} />
    </div>
  );
}
