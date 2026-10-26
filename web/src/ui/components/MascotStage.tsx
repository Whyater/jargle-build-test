import { useEffect, useState } from 'preact/hooks';
import { Mascot } from './Mascot';
import { SpeechBubble } from './SpeechBubble';
import type { MascotPose } from '../art';
import type { Speaker } from '../../engine/types';

interface MascotStageProps {
  who: Speaker;
  pose: string;
  text: string;
  size: number;
  /** What each mascot says when tapped, one line per tap. */
  floydLines: string[];
  budLines: string[];
}

/**
 * Floyd and Bud standing on top of the card below them, with one speech bubble above.
 * Tapping either one makes that mascot say his next line, and the bubble's tail moves to him.
 */
export function MascotStage({ who, pose, text, size, floydLines, budLines }: MascotStageProps) {
  const [speaker, setSpeaker] = useState<Speaker>(who);
  // -1 means the greeting. Each mascot keeps his own place in his list of lines.
  const [floydIndex, setFloydIndex] = useState(-1);
  const [budIndex, setBudIndex] = useState(-1);
  const [talking, setTalking] = useState(false);

  // A new greeting (for example after finishing today's word) starts over.
  useEffect(() => {
    setSpeaker(who);
    setFloydIndex(-1);
    setBudIndex(-1);
  }, [text, who]);

  function tapFloyd() {
    setSpeaker('floyd');
    setFloydIndex(floydIndex + 1);
  }
  function tapBud() {
    setSpeaker('bud');
    setBudIndex(budIndex + 1);
  }

  let line = text;
  if (speaker === 'floyd' && floydIndex >= 0) line = floydLines[floydIndex % floydLines.length];
  if (speaker === 'bud' && budIndex >= 0) line = budLines[budIndex % budLines.length];
  const tapped = (speaker === 'floyd' && floydIndex >= 0) || (speaker === 'bud' && budIndex >= 0);

  // The one talking uses the greeting pose (or looks happy after a tap); the other one just stands.
  const talkPose = (tapped ? 'happy' : pose) as MascotPose;
  const floydPose = speaker === 'floyd' ? talkPose : 'idle';
  const budPose = speaker === 'bud' ? talkPose : 'idle';

  return (
    // The tail position in CSS is worked out from half the mascot size.
    <div class={'stage from-' + speaker} style={'--stage-half: ' + size / 2 + 'px'}>
      <SpeechBubble text={line} tail="bottom" onTyping={setTalking} />
      <div class="stage-row">
        <Mascot who="floyd" size={size} pose={floydPose} talking={speaker === 'floyd' && talking} onTap={tapFloyd} />
        <Mascot who="bud" size={size} pose={budPose} talking={speaker === 'bud' && talking} onTap={tapBud} />
      </div>
    </div>
  );
}
