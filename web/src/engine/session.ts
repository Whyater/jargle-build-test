import type {
  BadgeId,
  BuildStep,
  ContentBundle,
  Lesson,
  LessonSession,
  LocalDate,
  SaveState,
  SessionStep,
  Situation,
  TermItem,
} from './types';
import { addDays } from './dates';
import { buildQuestion } from './questions';
import { finishLesson } from './lessons';
import { copyState } from './state';
import { seededShuffle } from './text';

// Lesson sessions: short lists of mixed steps (learn, match pairs, fill the blank,
// scam or safe, spell it, pick the meaning, recap) built from a lesson or one word.
// Missed steps come back once at the end, and missed words go to Review.

export const WORD_LESSON_XP = 10;

function newSession(kind: 'lesson' | 'word', lessonId: string | null, itemId: string | null, steps: SessionStep[]): LessonSession {
  return { kind: kind, lessonId: lessonId, itemId: itemId, steps: steps, index: 0, answered: 0, misses: 0, missedItems: [], requeued: [] };
}

/** Pick the meaning from 4: the word's meaning and its 3 decoys' meanings. */
function meaningStep(content: ContentBundle, item: TermItem, seed: string): SessionStep {
  const question = buildQuestion(content, item.id, 'meaning', seed);
  let why = question.why;
  if (item.why) why = item.term + ': ' + item.why;
  return { id: 'meaning', kind: 'meaning', itemId: item.id, term: item.term, options: question.options, answer: question.answer, why: why };
}

function blankParts(item: TermItem): { before: string; after: string } {
  const sentence = item.blank ? item.blank.sentence : '';
  const at = sentence.indexOf('___');
  return { before: sentence.slice(0, at), after: sentence.slice(at + 3) };
}

function blankStep(item: TermItem, seed: string, id: string): SessionStep {
  const parts = blankParts(item);
  return {
    id: id,
    kind: 'blank',
    itemId: item.id,
    before: parts.before,
    after: parts.after,
    options: seededShuffle([item.term, ...(item.blank ? item.blank.wrong : [])], seed + ':options'),
    answer: item.term,
    why: item.term + ': ' + (item.why || item.meaning),
  };
}

function situationStep(situation: Situation, id: string, itemId: string | null): SessionStep {
  return {
    id: id,
    kind: 'situation',
    itemId: itemId,
    prompt: situation.options[0] + ' or ' + situation.options[1].toLowerCase() + '?',
    text: situation.text,
    options: situation.options.slice(),
    answer: situation.answer,
    why: situation.why,
  };
}

function lessonCards(lesson: Lesson): { id: string; kind: 'learn'; cards: { title: string; text: string; mascot: 'floyd' | 'bud'; line: string }[] } {
  return {
    id: 'learn-1',
    kind: 'learn',
    cards: lesson.cards.map(function (card) {
      // No title: the screen header already shows the lesson title.
      return { title: '', text: card.text, mascot: card.mascot, line: card.line };
    }),
  };
}

function wordCard(item: TermItem, title: string, mascot: 'floyd' | 'bud') {
  return {
    title: title,
    text: item.meaning,
    example: item.blank ? item.blank.sentence.replace('___', item.term) : undefined,
    mascot: mascot,
    line: item.why || item.meaning,
  };
}

function fallbackSteps(lesson: Lesson, checksSeed: string): SessionStep[] {
  const steps: SessionStep[] = [lessonCards(lesson)];
  for (let i = 0; i < lesson.checks.length; i++) {
    const check = lesson.checks[i];
    steps.push({
      id: 'check-' + i,
      kind: 'situation',
      itemId: null,
      prompt: check.prompt,
      text: '',
      options: seededShuffle(check.options, checksSeed + ':' + i),
      answer: check.answer,
      why: check.why,
    });
  }
  if (lesson.situations) {
    for (let i = 0; i < lesson.situations.length; i++) {
      steps.push(situationStep(lesson.situations[i], 'situation-' + i, null));
    }
  }
  steps.push({ id: 'recap', kind: 'recap', title: lesson.title, takeaway: lesson.takeaway, words: [] });
  return steps;
}

export function buildLessonSession(lesson: Lesson, content: ContentBundle, seed: string): LessonSession {
  const words: TermItem[] = [];
  for (const id of lesson.words || []) {
    const item = content.items[id];
    if (item && item.blank) words.push(item);
  }
  if (words.length < 4 || !(lesson.situations && lesson.situations.length > 0)) {
    return newSession('lesson', lesson.id, null, fallbackSteps(lesson, seed));
  }

  const steps: SessionStep[] = [lessonCards(lesson)];
  steps.push({
    id: 'learn-2', kind: 'learn', cards: words.map(function (item, i) {
      return wordCard(item, item.term, i % 2 === 0 ? 'bud' : 'floyd');
    }),
  });
  const pairs = words.slice(0, 4).map(function (item) {
    return { itemId: item.id, term: item.term, meaning: item.short || item.meaning };
  });
  // Two words with the same meaning text would make the pairs step impossible, so fall back.
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const sameMeaning = pairs[i].meaning.trim().toLowerCase() === pairs[j].meaning.trim().toLowerCase();
      const sameTerm = pairs[i].term.trim().toLowerCase() === pairs[j].term.trim().toLowerCase();
      if (sameMeaning || sameTerm) {
        return newSession('lesson', lesson.id, null, fallbackSteps(lesson, seed));
      }
    }
  }
  steps.push({
    id: 'pairs', kind: 'pairs', pairs: pairs,
    terms: seededShuffle(pairs.map(function (p) { return p.term; }), seed + ':pair-terms'),
    meanings: seededShuffle(pairs.map(function (p) { return p.meaning; }), seed + ':pair-meanings'),
  });
  steps.push(blankStep(words[0], seed + ':blank', 'blank:' + words[0].id));
  // A lesson has 2 to 4 situation cards; the seed picks one, so a replay can show a different one.
  const situation = seededShuffle(lesson.situations, seed + ':situation')[0];
  steps.push(situationStep(situation, 'situation', null));

  let buildItem: TermItem | null = null;
  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    if (/^[A-Za-z]{3,10}$/.test(item.term) && item.id !== words[0].id) {
      buildItem = item;
      break;
    }
  }
  if (!buildItem) {
    for (let i = 0; i < words.length; i++) {
      if (/^[A-Za-z]{3,10}$/.test(words[i].term)) {
        buildItem = words[i];
        break;
      }
    }
  }
  if (buildItem) {
    const build: BuildStep = {
      id: 'build', kind: 'build', itemId: buildItem.id, clue: buildItem.meaning,
      answer: buildItem.term, why: buildItem.term + ': ' + (buildItem.short || buildItem.meaning),
    };
    steps.push(build);
  } else {
    const another = words[1] || words[0];
    steps.push(blankStep(another, seed + ':build-fallback', 'blank:build-fallback'));
  }

  // One of the lesson's own checks, so the session also tests the advice the cards taught.
  if (lesson.checks && lesson.checks.length > 0) {
    // Skip a check that asks the same question as the situation card just shown (some lessons have both).
    const situationStart = situation.text.slice(0, 20).toLowerCase();
    const checks = seededShuffle(lesson.checks, seed + ':check');
    let check = checks[0];
    for (let i = 0; i < checks.length; i++) {
      if (checks[i].prompt.toLowerCase().indexOf(situationStart) !== 0) {
        check = checks[i];
        break;
      }
    }
    steps.push({
      id: 'check',
      kind: 'situation',
      itemId: null,
      prompt: check.prompt,
      text: '',
      options: seededShuffle(check.options, seed + ':check-options'),
      answer: check.answer,
      why: check.why,
    });
  } else {
    let meaningItem = words[0];
    const buildUsedId = buildItem ? buildItem.id : (words[1] || words[0]).id;
    for (let i = 0; i < words.length; i++) {
      if (words[i].id !== words[0].id && words[i].id !== buildUsedId) {
        meaningItem = words[i];
        break;
      }
    }
    steps.push(meaningStep(content, meaningItem, seed + ':meaning'));
  }

  const recapWords: { term: string; meaning: string }[] = [];
  for (let i = 0; i < words.length; i++) {
    recapWords.push({ term: words[i].term, meaning: words[i].short || words[i].meaning });
  }
  steps.push({ id: 'recap', kind: 'recap', title: lesson.title, takeaway: lesson.takeaway, words: recapWords });
  return newSession('lesson', lesson.id, null, steps);
}

export function buildWordSession(itemId: string, content: ContentBundle, seed: string): LessonSession | null {
  const item = content.items[itemId];
  if (!item || !item.blank) return null;
  const steps: SessionStep[] = [
    { id: 'learn', kind: 'learn', cards: [wordCard(item, item.term, 'floyd')] },
    blankStep(item, seed + ':blank', 'blank:' + item.id),
  ];
  if (item.situations && item.situations.length > 0) steps.push(situationStep(item.situations[0], 'situation', item.id));
  steps.push(meaningStep(content, item, seed + ':meaning'));
  return newSession('word', null, item.id, steps);
}

/**
 * Records one answer. A wrong step comes back once at the end. Match pairs pass
 * the item ids of the words that were mixed up, so those words go to Review too.
 */
export function answerStep(session: LessonSession, correct: boolean, pairMisses?: string[]): LessonSession {
  const result = JSON.parse(JSON.stringify(session)) as LessonSession;
  const step = session.steps[session.index];
  if (!step || step.kind === 'learn' || step.kind === 'recap') return result;
  result.answered += 1;
  if (correct) return result;
  result.misses += 1;
  let missedIds: string[] = [];
  if (step.kind === 'pairs') missedIds = pairMisses || [];
  else if (step.itemId) missedIds = [step.itemId];
  for (const id of missedIds) {
    if (result.missedItems.indexOf(id) === -1) result.missedItems.push(id);
  }
  if (step.id.endsWith(':again') || result.requeued.indexOf(step.id) !== -1) return result;
  result.requeued.push(step.id);
  const again = JSON.parse(JSON.stringify(step)) as SessionStep;
  again.id = step.id + ':again';
  // Missed steps come back before the recap card, so the recap stays last.
  const last = result.steps[result.steps.length - 1];
  if (last && last.kind === 'recap') result.steps.splice(result.steps.length - 1, 0, again);
  else result.steps.push(again);
  return result;
}

export function nextStep(session: LessonSession): LessonSession {
  const result = JSON.parse(JSON.stringify(session)) as LessonSession;
  result.index = Math.min(result.index + 1, result.steps.length);
  return result;
}

export function sessionDone(session: LessonSession): boolean {
  return session.index >= session.steps.length;
}

/** 3 stars with no misses, 2 with one or two, 1 otherwise. */
export function sessionStars(session: LessonSession): number {
  if (session.misses === 0) return 3;
  if (session.misses <= 2) return 2;
  return 1;
}

function addMissReviews(state: SaveState, missed: string[], today: LocalDate): void {
  for (const id of missed) {
    const dates = state.review[id];
    if (!dates) state.review[id] = [addDays(today, 1), addDays(today, 3), addDays(today, 7)];
    else {
      const next = addDays(today, 1);
      if (dates.indexOf(next) === -1) dates.push(next);
      dates.sort();
    }
  }
}

export function finishLessonSession(state: SaveState, content: ContentBundle, session: LessonSession, today: LocalDate): { state: SaveState; newBadges: BadgeId[]; xpGained: number; stars: number } {
  let result: SaveState;
  let newBadges: BadgeId[] = [];
  let xpGained = 0;
  if (session.kind === 'lesson' && session.lessonId) {
    const finished = finishLesson(state, content, session.lessonId, today);
    result = finished.state;
    newBadges = finished.newBadges;
    xpGained = finished.xpGained;
    const oldStars = result.lessons[session.lessonId].stars || 0;
    result.lessons[session.lessonId].stars = Math.max(oldStars, sessionStars(session));
  } else {
    result = copyState(state);
    const id = session.itemId;
    if (id) {
      if (!result.wordLessons) result.wordLessons = {};
      // XP only the first time, so replaying one word is not an XP farm.
      if (!result.wordLessons[id]) {
        xpGained = WORD_LESSON_XP;
        result.xp = (result.xp || 0) + WORD_LESSON_XP;
      }
      result.wordLessons[id] = today;
    }
  }
  addMissReviews(result, session.missedItems, today);
  return { state: result, newBadges: newBadges, xpGained: xpGained, stars: sessionStars(session) };
}
