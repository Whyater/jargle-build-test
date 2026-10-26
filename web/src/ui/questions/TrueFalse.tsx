import type { TrueFalseQuestion } from '../../engine/types';
import { CheckMark, Choice, CrossMark, choiceState } from './Choice';
import { useAnswerKeys } from './keys';
import type { QuestionProps } from './types';

/**
 * Before the answer True shows a check and False a cross. After it, the glyph shows the result
 * instead, so a right "False" never shows a cross on a green button.
 */
function glyphFor(index: number, state: string) {
  if (state === 'right') return <CheckMark />;
  if (state === 'wrong') return <CrossMark />;
  if (state === 'dim') return null;
  return index === 0 ? <CheckMark /> : <CrossMark />;
}

/** "Cache means ..." True or False, with two huge buttons. */
export function TrueFalse({ question, picked, onAnswer, reward, keysOn = true, promptId, tag }: QuestionProps<TrueFalseQuestion>) {
  const pick = (choice: string) => onAnswer({ choice });
  useAnswerKeys('truefalse', question.options, keysOn && picked === null, pick);

  return (
    <div class="q q-truefalse">
      <div class="q-card" id={promptId} tabIndex={-1}>
        {tag ? <span class="q-tag">{tag}</span> : null}
        <p class="q-statement">
          <span class="q-term-inline">{question.term}</span> means: {question.shownMeaning}
        </p>
        <p class="q-ask">True or false?</p>
      </div>
      <div class="q-choices pair" role="group" aria-label="True or false">
        {question.options.map((option, i) => (
          <Choice
            key={option}
            option={option}
            answer={question.answer}
            picked={picked}
            onPick={pick}
            keyHint={i === 0 ? 'T' : 'F'}
            reward={reward}
            look="big"
            tone={i === 0 ? 'mint' : 'coral'}
          >
            <span class="big-icon">{glyphFor(i, choiceState(option, question.answer, picked))}</span>
            <span>{option}</span>
          </Choice>
        ))}
      </div>
    </div>
  );
}
