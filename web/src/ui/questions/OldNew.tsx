import type { OldNewQuestion } from '../../engine/types';
import { Mascot } from '../art';
import type { MascotPose } from '../art';
import { choiceState } from './Choice';
import { Choice } from './Choice';
import { useAnswerKeys } from './keys';
import type { QuestionProps } from './types';

/** The mascot on a tile cheers when it is the right side and says oops when it was a wrong pick. */
function artPose(state: string): MascotPose {
  if (state === 'right') return 'happy';
  if (state === 'wrong') return 'oops';
  return 'idle';
}

/** Old tech (Floyd's side) or today's tech (Bud's side)? */
export function OldNew({ question, picked, onAnswer, reward, keysOn = true, promptId, tag }: QuestionProps<OldNewQuestion>) {
  const pick = (choice: string) => onAnswer({ choice });
  useAnswerKeys('oldnew', question.options, keysOn && picked === null, pick);

  return (
    <div class="q q-oldnew">
      <div class="q-card" id={promptId} tabIndex={-1}>
        {tag ? <span class="q-tag">{tag}</span> : null}
        <p class="q-term">{question.term}</p>
        <p class="q-ask">Old tech or today's tech?</p>
      </div>
      <div class="q-choices pair" role="group" aria-label="Old tech or today's tech">
        {question.options.map((option, i) => (
          <Choice
            key={option}
            option={option}
            answer={question.answer}
            picked={picked}
            onPick={pick}
            keyHint={i === 0 ? 'O' : 'N'}
            reward={reward}
            look="big"
            tone={i === 0 ? 'coral' : 'mint'}
            label={i === 0 ? option + ' (Floyd)' : option + ' (Bud)'}
          >
            <span class="big-art">
              <Mascot who={i === 0 ? 'floyd' : 'bud'} size={72} pose={artPose(choiceState(option, question.answer, picked))} />
            </span>
            <span>{option}</span>
          </Choice>
        ))}
      </div>
    </div>
  );
}
