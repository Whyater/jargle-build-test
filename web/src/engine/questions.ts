// Quick questions for Endless: Meaning Match, Name It, True or False,
// Old or New, and the mini Clue Climb. Built from an item and its 3 decoys.

import type { ContentBundle, Question, QuestionKind } from './types';
import { seededRandom, seededShuffle } from './text';

export const QUESTION_KINDS: QuestionKind[] = ['meaning', 'name', 'truefalse', 'oldnew', 'clue'];

// Tiles are tried on 0.4 of picks and never twice in a row. Only single words
// with 3 to 9 letters qualify, so they make up about 1 in 4 questions on the real word list.
export const TILES_CHANCE = 0.4;

/** True for a short single word that works well as phone letter tiles. */
export function canSpell(term: string): boolean {
  // Hyphens, spaces and long words make poor tile games on a phone.
  return /^[A-Za-z]{3,9}$/.test(term);
}

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
  if (kind === 'tiles') {
    return {
      id: kind + ':' + itemId + ':' + seed,
      kind: kind,
      itemId: itemId,
      difficulty: item.difficulty,
      why: item.term + ': ' + item.meaning,
      meaning: item.meaning,
      term: item.term,
      options: [item.term],
      answer: item.term,
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
  if (question.kind === 'tiles') {
    const clean = (value: string): string => value.toUpperCase().replace(/[^A-Z]/g, '');
    if (clean(choice) === '') return false;
    return clean(choice) === clean(question.answer);
  }
  return choice === question.answer;
}
