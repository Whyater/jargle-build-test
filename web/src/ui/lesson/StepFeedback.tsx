import { Announcer } from '../components/BottomBar';
import { Button } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import { Icon } from '../components/Icons';

interface StepFeedbackProps {
  correct: boolean;
  why: string;
  /** True when a missed step will come back at the end. */
  comesBack?: boolean;
  onContinue: () => void;
}

const RIGHT_WORDS = ['Nice!', 'You got it!', 'Great job!', 'Spot on!'];

/** The sheet that slides up after an answer: right or not, one line on why, and Continue. */
export function StepFeedback({ correct, why, comesBack, onContinue }: StepFeedbackProps) {
  // Pick the cheer from the why text, so it stays the same on every render of this step.
  const cheer = RIGHT_WORDS[why.length % RIGHT_WORDS.length];
  const verdict = correct ? cheer : 'Not quite.';
  return (
    <div class={'ls-feedback after-actions ' + (correct ? 'is-right' : 'is-wrong')}>
      <div class={correct ? 'quiz-why is-right' : 'quiz-why is-wrong'}>
        <p class="quiz-verdict">
          <span class="quiz-verdict-icon" aria-hidden="true">
            {correct ? <Icon name="check" /> : <GameIcon name="close" size={18} />}
          </span>
          {verdict}
        </p>
        <p class="ls-why">{why}</p>
        {!correct && comesBack ? <p class="ls-again">You will see this one again at the end.</p> : null}
      </div>
      <Button primary big block variant={correct ? 'correct' : 'coral'} onClick={onContinue}>
        Continue
      </Button>
      <Announcer message={verdict + ' ' + why} />
    </div>
  );
}
