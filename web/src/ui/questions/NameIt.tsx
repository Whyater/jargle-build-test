import type { NameQuestion } from '../../engine/types';
import { Choice } from './Choice';
import { useAnswerKeys } from './keys';
import type { QuestionProps } from './types';

/** See a meaning, pick the word from 4. */
export function NameIt({ question, picked, onAnswer, reward, keysOn = true, promptId, tag }: QuestionProps<NameQuestion>) {
  const pick = (choice: string) => onAnswer({ choice });
  useAnswerKeys('name', question.options, keysOn && picked === null, pick);

  return (
    <div class="q q-name">
      <div class="q-card" id={promptId} tabIndex={-1}>
        {tag ? <span class="q-tag">{tag}</span> : null}
        <p class="q-meaning-text">{question.meaning}</p>
        <p class="q-ask">Which word means this?</p>
      </div>
      <div class="q-choices tiles" role="group" aria-label="Pick a word">
        {question.options.map((option, i) => (
          <Choice
            key={option}
            option={option}
            answer={question.answer}
            picked={picked}
            onPick={pick}
            keyHint={String(i + 1)}
            reward={reward}
            look="tile"
          />
        ))}
      </div>
    </div>
  );
}
