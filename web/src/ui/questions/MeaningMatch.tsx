import type { MeaningQuestion } from '../../engine/types';
import { Choice } from './Choice';
import { useAnswerKeys } from './keys';
import type { QuestionProps } from './types';

/** See a word, pick what it means from 4. */
export function MeaningMatch({ question, picked, onAnswer, reward, keysOn = true, promptId, tag }: QuestionProps<MeaningQuestion>) {
  const pick = (choice: string) => onAnswer({ choice });
  useAnswerKeys('meaning', question.options, keysOn && picked === null, pick);

  return (
    <div class="q q-meaning">
      <div class="q-card" id={promptId} tabIndex={-1}>
        {tag ? <span class="q-tag">{tag}</span> : null}
        <p class="q-term">{question.term}</p>
        <p class="q-ask">What does this mean?</p>
      </div>
      <div class="q-choices rows" role="group" aria-label="Pick a meaning">
        {question.options.map((option, i) => (
          <Choice
            key={option}
            option={option}
            answer={question.answer}
            picked={picked}
            onPick={pick}
            keyHint={String(i + 1)}
            reward={reward}
            look="row"
          />
        ))}
      </div>
    </div>
  );
}
