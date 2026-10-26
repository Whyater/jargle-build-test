/**
 * A small stand-in for the Endless engine, used by the screen tests so they do not
 * depend on the real word list or its random picks.
 */
import type {
  ContentBundle,
  EndlessAnswer,
  EndlessAnswerResult,
  EndlessRun,
  LevelInfo,
  Question,
  QuestionKind,
  SaveState,
  TermItem,
} from '../../engine/types';

export const ENDLESS_HEARTS = 3;
const KINDS: QuestionKind[] = ['meaning', 'name', 'truefalse', 'oldnew', 'clue'];
type Seed = string | number;

function randomFor(seed: Seed): () => number {
  let hash = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let value = hash >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values: string[], seed: Seed): string[] {
  const output = values.slice();
  const random = randomFor(seed);
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = output[i];
    output[i] = output[j];
    output[j] = temp;
  }
  return output;
}

function itemFor(content: ContentBundle, itemId: string): TermItem {
  const item = content.items[itemId];
  if (!item) throw new Error('Unknown endless item: ' + itemId);
  return item;
}

export function fakeQuestion(
  content: ContentBundle,
  itemId: string,
  kind: QuestionKind,
  seed: Seed,
): Question {
  const item = itemFor(content, itemId);
  const meanings = item.decoys.map((decoy) => decoy.meaning);
  const terms = item.decoys.map((decoy) => decoy.term);
  const base = {
    id: itemId + ':' + kind + ':' + seed,
    kind,
    itemId,
    difficulty: item.difficulty,
    options: [] as string[],
    answer: item.meaning,
    why: item.term + ': ' + item.meaning,
  };

  if (kind === 'meaning') {
    return {
      ...base,
      kind,
      term: item.term,
      options: shuffle([item.meaning].concat(meanings), seed),
      answer: item.meaning,
    };
  }
  if (kind === 'name') {
    return {
      ...base,
      kind,
      meaning: item.meaning,
      options: shuffle([item.term].concat(terms), seed),
      answer: item.term,
    };
  }
  if (kind === 'truefalse') {
    const random = randomFor(String(seed) + ':truth');
    const isTrue = random() < 0.5;
    const shownMeaning = isTrue
      ? item.meaning
      : meanings[Math.floor(random() * meanings.length)];
    return {
      ...base,
      kind,
      term: item.term,
      shownMeaning,
      options: ['True', 'False'],
      answer: isTrue ? 'True' : 'False',
    };
  }
  if (kind === 'oldnew') {
    return {
      ...base,
      kind,
      term: item.term,
      options: ['Old tech', "Today's tech"],
      answer: item.old_tech ? 'Old tech' : "Today's tech",
    };
  }
  if (kind === 'tiles') {
    return {
      ...base,
      kind,
      meaning: item.meaning,
      term: item.term,
      options: [item.term],
      answer: item.term,
    };
  }
  return {
    ...base,
    kind: 'clue',
    clues: item.clues.slice(0, 3),
    options: shuffle([item.term].concat(terms), seed),
    answer: item.term,
  };
}

function firstKind(seed: number): QuestionKind {
  return KINDS[Math.abs(seed) % KINDS.length];
}

export function comboMultiplier(combo: number): number {
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

function firstItem(content: ContentBundle): string {
  const ids = Object.keys(content.items);
  if (!ids.length) throw new Error('Endless content is empty');
  return ids[0];
}

export function startEndless(
  _state: SaveState,
  content: ContentBundle,
  today: string,
  seed: number,
): EndlessRun {
  const pool = Object.keys(content.items);
  const itemId = firstItem(content);
  return {
    seed,
    today,
    pool,
    used: [],
    question: fakeQuestion(content, itemId, firstKind(seed), seed),
    answered: false,
    asked: 1,
    correct: 0,
    score: 0,
    hearts: ENDLESS_HEARTS,
    combo: 0,
    bestCombo: 0,
    xp: 0,
    over: false,
  };
}

export function isCorrect(question: Question, choice: string): boolean {
  return choice === question.answer;
}

export function answerEndless(run: EndlessRun, answer: EndlessAnswer): EndlessAnswerResult {
  if (run.answered || run.over || !run.question) {
    return {
      run,
      correct: false,
      points: 0,
      xpGained: 0,
      comboAfter: run.combo,
      multiplier: 1,
    };
  }
  const correct = isCorrect(run.question, answer.choice);
  if (!correct) {
    const hearts = run.hearts - 1;
    return {
      run: { ...run, answered: true, combo: 0, hearts, over: hearts <= 0 },
      correct: false,
      points: 0,
      xpGained: 0,
      comboAfter: 0,
      multiplier: 1,
    };
  }

  const comboAfter = run.combo + 1;
  const multiplier = comboMultiplier(comboAfter);
  let base = 10;
  if (run.question.kind === 'clue') {
    const cluesUsed = answer.cluesUsed || 1;
    if (cluesUsed === 1) base = 30;
    else if (cluesUsed === 2) base = 20;
    else base = 10;
  }
  const points = base * multiplier;
  const xpGained = comboAfter >= 3 ? 15 : 10;
  return {
    run: {
      ...run,
      answered: true,
      correct: run.correct + 1,
      score: run.score + points,
      combo: comboAfter,
      bestCombo: Math.max(run.bestCombo, comboAfter),
      xp: run.xp + xpGained,
    },
    correct: true,
    points,
    xpGained,
    comboAfter,
    multiplier,
  };
}

export function nextEndlessQuestion(run: EndlessRun, content: ContentBundle): EndlessRun {
  if (run.over) return run;
  const used = run.used.slice();
  if (run.question && used.indexOf(run.question.itemId) === -1) used.push(run.question.itemId);
  let available = run.pool.filter((id) => used.indexOf(id) === -1);
  if (!available.length) {
    used.length = 0;
    available = run.pool.slice();
  }
  const random = randomFor(String(run.seed) + ':' + run.asked);
  const itemId = available[Math.floor(random() * available.length)] || firstItem(content);
  const previousKind = run.question ? run.question.kind : null;
  let kind = KINDS[(Math.floor(random() * KINDS.length) + run.asked) % KINDS.length];
  if (previousKind && kind === previousKind) {
    kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
  }
  return {
    ...run,
    used,
    question: fakeQuestion(content, itemId, kind, String(run.seed) + ':' + run.asked),
    asked: run.asked + 1,
    answered: false,
  };
}

export function finishEndless(state: SaveState, run: EndlessRun, _today: string): SaveState {
  return {
    ...state,
    endlessBest: Math.max(state.endlessBest || 0, run.score),
    endlessGames: (state.endlessGames || 0) + 1,
    xp: (state.xp || 0) + run.xp,
  };
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, xp);
  let needed = 30;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed += 20;
  }
  return { level, intoLevel: remaining, needed };
}

export const fakeEndlessApi = {
  startEndless,
  answerEndless,
  nextEndlessQuestion,
  finishEndless,
  comboMultiplier,
  levelFromXp,
  isCorrect,
  ENDLESS_HEARTS,
};
