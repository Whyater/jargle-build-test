import { useState } from 'preact/hooks';
import type { BlankStep as BlankStepData } from '../../engine/types';
import { lessonSound } from './sound';

interface BlankStepProps {
  step: BlankStepData;
  onAnswer: (correct: boolean) => void;
}

/** Fill the blank: a real sentence with the word missing. Tapping a choice answers. */
export function BlankStep({ step, onAnswer }: BlankStepProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const correct = picked === step.answer;

  function choose(option: string) {
    if (answered) return;
    setPicked(option);
    lessonSound(option === step.answer ? 'correct' : 'wrong');
    onAnswer(option === step.answer);
  }

  let slotClass = 'ls-slot';
  if (answered) slotClass += correct ? ' is-right' : ' is-wrong';

  return (
    <div class="ls-blank stack">
      <p class="ls-ask">Fill in the blank.</p>
      <p class="ls-sentence">
        {step.before}
        <span class={slotClass}>
          {answered ? (correct ? step.answer : <s>{picked}</s>) : <span class="visually-hidden">blank</span>}
        </span>
        {answered && !correct ? <span class="ls-slot is-right ls-slot-fix">{step.answer}</span> : null}
        {step.after}
      </p>
      <div class="ls-chips" role="group" aria-label="Choices">
        {step.options.map((option) => {
          let name = 'ls-chip';
          if (answered && option === step.answer) name += ' is-right';
          else if (answered && option === picked) name += ' is-wrong';
          return (
            <button
              type="button"
              key={option}
              class={name}
              aria-pressed={picked === option ? 'true' : 'false'}
              aria-disabled={answered ? 'true' : undefined}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
