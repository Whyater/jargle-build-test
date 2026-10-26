import { useState } from 'preact/hooks';
import { Button } from '../components/Button';
import { MascotSays } from '../components/MascotSays';
import type { LearnStep as LearnStepData } from '../../engine/types';

/** Splits an example sentence around the word so the word can be drawn bold. */
export function markWord(example: string, word: string) {
  const at = example.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return [example];
  return [
    example.slice(0, at),
    <mark class="ls-mark" key="word">
      {example.slice(at, at + word.length)}
    </mark>,
    example.slice(at + word.length),
  ];
}

/** Teaching cards, one at a time. Nothing to answer: read, then Next. */
export function LearnStep({ step, onDone }: { step: LearnStepData; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const card = step.cards[index];
  const last = index === step.cards.length - 1;
  if (!card) return null;
  return (
    <div class="ls-learn stack">
      <div class="ls-card" key={index}>
        {step.cards.length > 1 ? (
          <p class="ls-count">
            {index + 1} of {step.cards.length}
          </p>
        ) : null}
        {card.title ? <h2 class="ls-card-title">{card.title}</h2> : null}
        <p class="ls-card-text">{card.text}</p>
        {card.example ? (
          <p class="ls-example">
            <span class="ls-example-label">Example</span>
            {markWord(card.example, card.title)}
          </p>
        ) : null}
      </div>
      <MascotSays key={'says-' + index} who={card.mascot} text={card.line} pose="talk" size={72} />
      <div class="after-actions">
        <Button
          primary
          big
          block
          onClick={() => {
            if (last) onDone();
            else setIndex(index + 1);
          }}
        >
          {last ? 'Got it' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
