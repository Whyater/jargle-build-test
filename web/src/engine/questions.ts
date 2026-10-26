// Quick questions for Endless: Meaning Match, Name It, True or False,
// Old or New, and the mini Clue Climb. Built from an item and its 3 decoys.

import type { ContentBundle, Question, QuestionKind } from './types';
import { seededRandom, seededShuffle } from './text';

export const QUESTION_KINDS: QuestionKind[] = ['meaning', 'name', 'truefalse', 'oldnew', 'clue'];

/** Builds one question. The same (item, kind, seed) always gives the same question. */
export function buildQuestion(content: ContentBundle, itemId: string, kind: QuestionKind, seed: string): Question {
  const item = content.items[itemId];
  if (!item) throw new Error('Unknown item: ' + itemId);

  const decoyMeanings: string[] = [];
  const decoyTerms: string[] = [];
  for (let i = 0; i < item.decoys.length; i++) {
    decoyMeanings.push(item.decoys[i].meaning);
    decoyTerms.push(item.decoys[i].term);
  }

  if (kind === 'meaning') {
    return {
      id: kind + ':' + itemId + ':' + seed,
      kind: kind,
      itemId: itemId,
      difficulty: item.difficulty,
      why: item.term + ': ' + item.meaning,
      term: item.term,
      options: seededShuffle([item.meaning, ...decoyMeanings], seed + ':options'),
      answer: item.meaning,
    };
  }
  if (kind === 'name') {
    return {
      id: kind + ':' + itemId + ':' + seed,
      kind: kind,
      itemId: itemId,
      difficulty: item.difficulty,
      why: item.term + ': ' + item.meaning,
      meaning: item.meaning,
      options: seededShuffle([item.term, ...decoyTerms], seed + ':options'),
      answer: item.term,
    };
  }
  if (kind === 'truefalse') {
    const random = seededRandom(seed + ':tf');
    const isTrue = random() < 0.5;
    const shownMeaning = isTrue ? item.meaning : item.decoys[Math.floor(random() * 3)].meaning;
    return {
      id: kind + ':' + itemId + ':' + seed,
      kind: kind,
      itemId: itemId,
      difficulty: item.difficulty,
      why: item.term + ': ' + item.meaning,
      term: item.term,
      shownMeaning: shownMeaning,
      options: ['True', 'False'],
      answer: isTrue ? 'True' : 'False',
    };
  }
  if (kind === 'oldnew') {
    return {
      id: kind + ':' + itemId + ':' + seed,
      kind: kind,
      itemId: itemId,
      difficulty: item.difficulty,
      why: item.term + ': ' + item.meaning,
      term: item.term,
      options: ['Old tech', "Today's tech"],
      answer: item.old_tech ? 'Old tech' : "Today's tech",
    };
  }
  return {
    id: kind + ':' + itemId + ':' + seed,
    kind: kind,
    itemId: itemId,
    difficulty: item.difficulty,
    why: item.term + ': ' + item.meaning,
    clues: item.clues.slice(0, 3),
    options: seededShuffle([item.term, ...decoyTerms], seed + ':options'),
    answer: item.term,
  };
}

/** True if `choice` is the right option. */
export function isCorrect(question: Question, choice: string): boolean {
  return choice === question.answer;
}
