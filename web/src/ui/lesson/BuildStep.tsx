import { LetterTiles } from '../game/LetterTiles';
import type { BuildStep as BuildStepData } from '../../engine/types';

interface BuildStepProps {
  step: BuildStepData;
  onAnswer: (correct: boolean) => void;
}

/** Spell the word with letter tiles. One decoy tile keeps it a little puzzle. */
export function BuildStep({ step, onAnswer }: BuildStepProps) {
  return (
    <div class="ls-build stack">
      <p class="ls-ask">Spell the word.</p>
      <LetterTiles
        key={step.id}
        answer={step.answer}
        prompt={<p class="ls-card-text">{step.clue}</p>}
        difficulty={2}
        seed={step.id + ':' + step.itemId}
        tag="Build it"
        // Lessons have no points, so a hint has no cost to show.
        showHintCost={false}
        // LetterTiles plays the right or wrong sound itself, so the lesson sounds stay the same.
        onDone={(result) => onAnswer(result.correct)}
      />
    </div>
  );
}
