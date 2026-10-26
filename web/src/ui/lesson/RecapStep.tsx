import { Button } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import type { RecapStep as RecapStepData } from '../../engine/types';

/** The last card: what you learned in this lesson. */
export function RecapStep({ step, onDone }: { step: RecapStepData; onDone: () => void }) {
  return (
    <div class="ls-recap stack">
      <div class="ls-card ls-recap-card">
        <p class="ls-count">What you learned</p>
        <h2 class="ls-card-title">{step.title}</h2>
        <p class="ls-card-text">{step.takeaway}</p>
      </div>
      {step.words.length ? (
        <ul class="ls-word-list">
          {step.words.map((word) => (
            <li key={word.term}>
              <span class="ls-word-star" aria-hidden="true">
                <GameIcon name="star" size={18} />
              </span>
              <span>
                <b>{word.term}</b> {word.meaning}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div class="after-actions">
        <Button primary big block onClick={onDone}>
          Finish lesson
        </Button>
      </div>
    </div>
  );
}
