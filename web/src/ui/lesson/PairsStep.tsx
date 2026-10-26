import { useState } from 'preact/hooks';
import { Announcer } from '../components/BottomBar';
import type { PairsStep as PairsStepData } from '../../engine/types';
import { lessonSound } from './sound';

interface PairsStepProps {
  step: PairsStepData;
  /** Called once, when every pair is matched. Right means no wrong tries. */
  onAnswer: (correct: boolean, why: string, missedIds: string[]) => void;
}

/** Match pairs: tap a word, then its meaning (either side first). */
export function PairsStep({ step, onAnswer }: PairsStepProps) {
  const [pickedTerm, setPickedTerm] = useState<string | null>(null);
  const [pickedMeaning, setPickedMeaning] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  // Item ids of the words that were part of a wrong try. They go to Review.
  const [missedIds, setMissedIds] = useState<string[]>([]);
  // The two tiles of a wrong try shake for a moment.
  const [shake, setShake] = useState<string[]>([]);
  const [line, setLine] = useState('');

  function meaningOf(term: string): string {
    for (const pair of step.pairs) if (pair.term === term) return pair.meaning;
    return '';
  }

  function tryPair(term: string, meaning: string) {
    setPickedTerm(null);
    setPickedMeaning(null);
    if (meaningOf(term) === meaning) {
      const next = matched.concat([term]);
      setMatched(next);
      setLine(term + ': ' + meaning + '.');
      if (next.length === step.pairs.length) {
        lessonSound('correct');
        const why = misses === 0 ? 'All ' + step.pairs.length + ' pairs matched on the first try.' : 'All matched. The mixed-up ones will come back.';
        onAnswer(misses === 0, why, missedIds);
      } else {
        lessonSound('tap');
      }
      return;
    }
    lessonSound('wrong');
    setMisses(misses + 1);
    const nextMissed = missedIds.slice();
    for (const pair of step.pairs) {
      if ((pair.term === term || pair.meaning === meaning) && nextMissed.indexOf(pair.itemId) === -1) nextMissed.push(pair.itemId);
    }
    setMissedIds(nextMissed);
    setShake([term, meaning]);
    // The why for a wrong try: what the tapped word really means.
    setLine('Not a match. ' + term + ' means: ' + meaningOf(term) + '.');
    window.setTimeout(() => setShake([]), 450);
  }

  function tapTerm(term: string) {
    if (matched.indexOf(term) !== -1) return;
    if (pickedMeaning) tryPair(term, pickedMeaning);
    else {
      lessonSound('tap');
      setPickedTerm(pickedTerm === term ? null : term);
    }
  }

  function tapMeaning(meaning: string) {
    if (matchedMeaning(meaning)) return;
    if (pickedTerm) tryPair(pickedTerm, meaning);
    else {
      lessonSound('tap');
      setPickedMeaning(pickedMeaning === meaning ? null : meaning);
    }
  }

  function matchedMeaning(meaning: string): boolean {
    for (const term of matched) if (meaningOf(term) === meaning) return true;
    return false;
  }

  function tileClass(isPicked: boolean, isMatched: boolean, isShaking: boolean): string {
    let name = 'ls-tile';
    if (isPicked) name += ' is-picked';
    if (isMatched) name += ' is-matched';
    if (isShaking) name += ' is-shaking';
    return name;
  }

  return (
    <div class="ls-pairs stack">
      <p class="ls-ask">Tap a word, then its meaning.</p>
      <div class="ls-pair-grid">
        <ul class="ls-col" aria-label="Words">
          {step.terms.map((term) => {
            const isMatched = matched.indexOf(term) !== -1;
            return (
              <li key={term}>
                <button
                  type="button"
                  class={tileClass(pickedTerm === term, isMatched, shake.indexOf(term) !== -1) + ' is-term'}
                  aria-pressed={pickedTerm === term ? 'true' : 'false'}
                  aria-disabled={isMatched ? 'true' : undefined}
                  onClick={() => tapTerm(term)}
                >
                  {term}
                </button>
              </li>
            );
          })}
        </ul>
        <ul class="ls-col" aria-label="Meanings">
          {step.meanings.map((meaning) => {
            const isMatched = matchedMeaning(meaning);
            return (
              <li key={meaning}>
                <button
                  type="button"
                  class={tileClass(pickedMeaning === meaning, isMatched, shake.indexOf(meaning) !== -1)}
                  aria-pressed={pickedMeaning === meaning ? 'true' : 'false'}
                  aria-disabled={isMatched ? 'true' : undefined}
                  onClick={() => tapMeaning(meaning)}
                >
                  {meaning}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p class={'ls-pair-line' + (line.indexOf('Not a match') === 0 ? ' is-wrong' : '')} aria-hidden="true">
        {line}
      </p>
      <Announcer message={line} />
    </div>
  );
}
