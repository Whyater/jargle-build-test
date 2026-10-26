import { useState } from 'preact/hooks';
import { Icon } from '../components/Icons';
import { Mascot } from '../components/Mascot';
import type { MeaningStep, SituationStep } from '../../engine/types';
import { lessonSound } from './sound';
import '../screens/round.css';
import './lesson.css';

interface ChoiceStepProps {
  step: SituationStep | MeaningStep;
  onAnswer: (correct: boolean) => void;
}

/**
 * Two kinds of multiple choice:
 * a situation ("Scam or safe?") with 2 big buttons side by side,
 * and "What does it mean?" with stacked answer cards.
 */
export function ChoiceStep({ step, onAnswer }: ChoiceStepProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;

  function choose(option: string) {
    if (answered) return;
    setPicked(option);
    lessonSound(option === step.answer ? 'correct' : 'wrong');
    onAnswer(option === step.answer);
  }

  function optionClass(option: string, base: string): string {
    let name = base;
    if (answered && option === step.answer) name += ' is-answer';
    else if (answered && option === picked) name += ' is-missed';
    return name;
  }

  if (step.kind === 'situation') {
    return (
      <div class="ls-situation stack">
        <p class="ls-ask">{step.prompt}</p>
        {step.text ? (
          <div class="ls-scene">
            <span class="ls-scene-mascot" aria-hidden="true">
              <Mascot who="bud" size={64} pose="think" />
            </span>
            <p class="ls-scene-text">{step.text}</p>
          </div>
        ) : null}
        <div class={step.options.length === 2 ? 'ls-duo' : 'ls-stack'}>
          {step.options.map((option) => (
            <button
              type="button"
              key={option}
              class={optionClass(option, 'ls-big-choice')}
              aria-pressed={picked === option ? 'true' : 'false'}
              aria-disabled={answered ? 'true' : undefined}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class="ls-meaning stack">
      <p class="ls-ask">What does this word mean?</p>
      <p class="ls-word">{step.term}</p>
      <div class="cards play-cards">
        {step.options.map((option) => {
          const isAnswer = answered && option === step.answer;
          return (
            <button
              type="button"
              key={option}
              class={optionClass(option, 'answer-card') + (answered ? ' flip' : '')}
              aria-pressed={picked === option ? 'true' : 'false'}
              aria-disabled={answered ? 'true' : undefined}
              onClick={() => choose(option)}
            >
              <span class="meaning ls-meaning-text">{option}</span>
              {isAnswer ? (
                <span class="state-icon">
                  <Icon name="check" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
