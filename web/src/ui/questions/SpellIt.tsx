import type { TilesQuestion } from '../../engine/types';
import { LetterTiles } from '../game/LetterTiles';
import type { QuestionProps } from './types';

/** See a meaning, spell the word with letter tiles. */
export function SpellIt({ question, picked, onAnswer, reward, keysOn = true, promptId, tag }: QuestionProps<TilesQuestion>) {
  return (
    <div class="q q-tiles">
      <LetterTiles
        answer={question.term}
        prompt={<p class="q-meaning-text">{question.meaning}</p>}
        difficulty={question.difficulty}
        seed={question.id}
        keysOn={keysOn && picked === null}
        promptId={promptId}
        tag={tag}
        reward={reward}
        // Endless plays its own right, wrong and level-up sounds.
        resultSound={false}
        onDone={(result) => onAnswer({ choice: result.correct ? question.answer : '', tileScore: result.score })}
      />
    </div>
  );
}
