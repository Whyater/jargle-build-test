import { useEffect, useState } from 'preact/hooks';
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
  /** Extra lines. When given, tapping the mascot makes him say the next one. */
  lines?: string[];
}

/** A mascot with a typed-out speech bubble next to him. His mouth moves while the line types. */
export function MascotSays({ who, text, pose = 'idle', size = 88, flip, lines }: MascotSaysProps) {
  const [talking, setTalking] = useState(false);
  // -1 means the main line; 0 and up are the extra lines, one per tap.
  const [lineIndex, setLineIndex] = useState(-1);
  // A new main line (for example a new greeting) wins over an old tapped line.
  useEffect(() => setLineIndex(-1), [text]);
  const tapped = !!lines && lines.length > 0 && lineIndex >= 0;
  const shownText = tapped && lines ? lines[lineIndex % lines.length] : text;
  // The mascot art takes pose and talking once its new version lands; until then they are ignored.
  // A tapped mascot looks happy while he answers.
  const extra = { pose: tapped ? 'happy' : pose, talking } as Record<string, unknown>;

  function talk() {
    if (lines && lines.length > 0) setLineIndex(lineIndex + 1);
  }

  return (
    <div class={flip ? 'says flip' : 'says'}>
      <div class="says-mascot">
        <Mascot who={who} size={size} {...extra} onTap={talk} />
      </div>
      <SpeechBubble text={shownText} tail={flip ? 'right' : 'left'} onTyping={setTalking} />
    </div>
  );
}
