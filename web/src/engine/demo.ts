import type { ContentBundle, LocalDate, SaveState } from './types';
import { dateOfDay } from './dates';
import { newState } from './state';
import { startRound, applyRound } from './round';
import { answerReview, reviewSession } from './review';
import { saveLessonProgress, finishLesson } from './lessons';

export const DEMO_LIST = [
  'two-factor-login',
  'wi-fi',
  'screenshot',
  'emoji',
  'phishing',
  'deepfake',
  'the-cloud',
  'bluetooth',
  'zelle',
  'hashtag',
  'spam',
  'claude',
];

export const DEMO_JUDGE_LINE = "Demo: a made-up history with 8 days learned. New here? Tap How to play. Try Pass the Phone, or pick a wrong word to see what it means.";

function demoContent(content: ContentBundle): ContentBundle {
  const copy: ContentBundle = JSON.parse(JSON.stringify(content));
  copy.schedule.days = [];
  for (let i = 0; i < DEMO_LIST.length; i++) {
    copy.schedule.days.push({ date: dateOfDay(i + 1), term: DEMO_LIST[i], rerun: false });
  }
  return copy;
}

function solveRound(
  state: SaveState,
  content: ContentBundle,
  key: string,
  itemId: string,
  mode: 'daily' | 'oldtech',
  today: LocalDate,
  clues: number,
): SaveState {
  let s = startRound(state, content, key, itemId, mode, today);
  for (let i = 1; i < clues; i++) {
    s = applyRound(s, content, key, { type: 'nextClue' }, today).state;
  }
  s = applyRound(s, content, key, { type: 'select', term: content.items[itemId].term }, today).state;
  s = applyRound(s, content, key, { type: 'check' }, today).state;
  return s;
}

function playReview(state: SaveState, content: ContentBundle, today: LocalDate, wrongId: string | null): SaveState {
  let s = state;
  const questions = reviewSession(s, content, today);
  for (let i = 0; i < questions.length; i++) {
    s = answerReview(s, questions[i].itemId, questions[i].itemId !== wrongId, today);
  }
  return s;
}

function judgeState(content: ContentBundle): SaveState {
  let s = newState();
  const bars = [4, 3, 4, 3, 4, 3, 4, 3];
  const days = [1, 2, 3, 4, 5, 9, 10, 11];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const today = dateOfDay(day);
    const id = DEMO_LIST[day - 1];
    s = solveRound(s, content, 'd:' + day, id, 'daily', today, bars[i] === 4 ? 3 : 4);
    s = applyRound(s, content, 'd:' + day, { type: 'postStep', step: 2 }, today).state;
    if (day >= 2) {
      s = playReview(s, content, today, day === 9 ? DEMO_LIST[0] : null);
    }
  }

  const oldTech = [content.oldTech[0], content.oldTech[1], content.oldTech[2], content.oldTech[3]];
  for (let i = 0; i < oldTech.length; i++) {
    const day = i < 2 ? 9 : 10;
    s = solveRound(s, content, oldTech[i], oldTech[i], 'oldtech', dateOfDay(day), 1);
  }

  const lessonId = 'make-a-strong-password';
  s = saveLessonProgress(s, lessonId, { card: 2 });
  s = finishLesson(s, content, lessonId, dateOfDay(11)).state;
  s.flags.textSizeAsked = true;
  return s;
}

export function demoState(kind: 'new' | 'judge', content: ContentBundle): {
  state: SaveState;
  today: LocalDate;
  content: ContentBundle;
} {
  const demo = demoContent(content);
  if (kind === 'new') {
    return { state: newState(), today: dateOfDay(12), content: demo };
  }
  return { state: judgeState(demo), today: dateOfDay(12), content: demo };
}
