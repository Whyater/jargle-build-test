import { useState } from 'preact/hooks';
import type { ClueQuestion } from '../../engine/types';
import { Choice } from './Choice';
import { useAnswerKeys } from './keys';
import type { QuestionProps } from './types';

/** Points for a right answer after `shown` clues, before the combo multiplier. */
export function cluePoints(shown: number): number {
  if (shown <= 1) return 30;
  if (shown === 2) return 20;
  return 10;
}

interface ClueClimbProps extends QuestionProps<ClueQuestion> {
  /** The combo multiplier, so "Worth 60" can include it. */
  multiplier?: number;
}

/** Guess the word from clues. One clue to start; each extra clue makes it worth less. */
export function ClueClimb({ question, picked, onAnswer, reward, keysOn = true, promptId, tag, multiplier = 1 }: ClueClimbProps) {
  // QuestionView gives each question its own key, so a new question starts at one clue
  // (give it a key too when using ClueClimb on its own).
  const [shown, setShown] = useState(1);

  const total = question.clues.length;
  const canShowMore = picked === null && shown < total;
  const worth = cluePoints(shown) * multiplier;

  function more() {
    if (canShowMore) setShown(shown + 1);
  }
  const pick = (choice: string) => onAnswer({ choice, cluesUsed: shown });
  useAnswerKeys('clue', question.options, keysOn && picked === null, pick, (key) => {
    if (key === 'c' || key === 'C') more();
  });

  const clues = [];
  for (let i = 0; i < total; i++) {
    const open = i < shown;
    clues.push(
      <li key={i} class={open ? 'q-clue open' : 'q-clue'} aria-hidden={open ? undefined : 'true'}>
        <span class="q-clue-n" aria-hidden="true">
          {i + 1}
        </span>
        <span class="q-clue-text">{open ? question.clues[i] : 'Hidden clue'}</span>
      </li>,
    );
  }

  return (
    <div class="q q-clue-climb">
      <div class="q-card" id={promptId} tabIndex={-1}>
        {tag ? <span class="q-tag">{tag}</span> : null}
        <div class="q-ask-row">
          <p class="q-ask">Guess the word</p>
          <span class="q-worth" aria-live="polite">
            Worth {worth}
          </span>
        </div>
        <ol class="q-clues">{clues}</ol>
        <button
          type="button"
          class="q-more"
          onClick={more}
          aria-disabled={canShowMore ? undefined : 'true'}
          aria-keyshortcuts="C"
        >
          {shown < total ? 'Another clue' : 'All clues shown'}
          {shown < total ? (
            <span class="q-more-cost" aria-hidden="true">
              {' '}
              -10
            </span>
          ) : null}
        </button>
      </div>
      <div class="q-choices tiles" role="group" aria-label="Pick the word">
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
