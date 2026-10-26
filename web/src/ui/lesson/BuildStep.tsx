import { useState } from 'preact/hooks';
import { Button } from '../components/Button';
import type { BuildStep as BuildStepData } from '../../engine/types';
import { lessonSound } from './sound';

interface BuildStepProps {
  step: BuildStepData;
  onAnswer: (correct: boolean) => void;
}

/** Letters only, lower case, so "Wi-Fi" and "wifi" both count. */
export function cleanSpelling(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// BUILD STEP PLACEHOLDER: a plain text box until the shared letter tiles component lands.
// Swap the form below for <LetterTiles> and keep the same onAnswer call.
export function BuildStep({ step, onAnswer }: BuildStepProps) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const letters = cleanSpelling(step.answer).length;

  function check() {
    if (done || cleanSpelling(text) === '') return;
    const correct = cleanSpelling(text) === cleanSpelling(step.answer);
    setDone(true);
    lessonSound(correct ? 'correct' : 'wrong');
    onAnswer(correct);
  }

  return (
    <div class="ls-build stack">
      <p class="ls-ask">Spell the word.</p>
      <div class="ls-card ls-clue">
        <p class="ls-card-text">{step.clue}</p>
        <p class="ls-hint">
          {letters} letters, starts with {step.answer.charAt(0).toUpperCase()}
        </p>
      </div>
      <form
        class="ls-build-form"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <label class="visually-hidden" for="ls-build-input">
          Your spelling
        </label>
        <input
          id="ls-build-input"
          class="ls-input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          value={text}
          readOnly={done}
          onInput={(event) => setText((event.target as HTMLInputElement).value)}
        />
        {done ? null : (
          <Button primary big block disabled={cleanSpelling(text) === ''} onClick={check}>
            Check
          </Button>
        )}
      </form>
    </div>
  );
}
