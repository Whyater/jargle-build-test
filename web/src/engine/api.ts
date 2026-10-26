// Engine API: the functions the UI calls. Pure functions over (state, content, today).
// No DOM, no storage, no Date.now() inside: callers pass `today` (a LocalDate).
// Each function lives in its own module and is re-exported here, so the UI
// only ever imports from this file.

import type {
  BadgeId,
  ContentBundle,
  EndlessAnswer,
  EndlessAnswerResult,
  EndlessRun,
  LevelInfo,
  Question,
  QuestionKind,
  XpAction,
  Lesson,
  LocalDate,
  RoundMode,
  RoundRecord,
  SaveState,
  TermItem,
  TopicId,
} from './types';

import { todayLocal as realTodayLocal, dayNumber as realDayNumber, dateOfDay as realDateOfDay, addDays as realAddDays, longDate as realLongDate } from './dates';
import { newState as realNewState } from './state';
import { startRound as realStartRound, roundView as realRoundView, applyRound as realApplyRound, replayRound as realReplayRound, shareText as realShareText, shareLines as realShareLines } from './round';
import { homeView as realHomeView } from './home';
import { reviewSession as realReviewSession, answerReview as realAnswerReview, reviewLinkText as realReviewLinkText, reviewDoneLine as realReviewDoneLine } from './review';
import { lessonStatuses as realLessonStatuses, lessonOptions as realLessonOptions, saveLessonProgress as realSaveLessonProgress, finishLesson as realFinishLesson, todaysLesson as realTodaysLesson } from './lessons';
import { practiceList as realPracticeList, oldTechList as realOldTechList, nextWord as realNextWord, PRACTICE_EMPTY as realPracticeEmpty, OLD_TECH_INTRO as realOldTechIntro } from './lists';
import { startPtpSet as realStartPtpSet, advancePtp as realAdvancePtp, ptpRoundItem as realPtpRoundItem, ptpSummary as realPtpSummary, dealPtpSet as realDealPtpSet, ptpRoundCardLines as realPtpRoundCardLines, ptpTotalLine as realPtpTotalLine, ptpBestLine as realPtpBestLine } from './ptp';
import { badgeViews as realBadgeViews, BADGE_NAMES as realBadgeNames, WEEK_ONE_NOTE as realWeekOneNote } from './badges';
import { encodeProgressCode as realEncodeProgressCode, decodeProgressCode as realDecodeProgressCode, TYPO_MESSAGE as realTypoMessage, NEWER_MESSAGE as realNewerMessage, COPY_HINT as realCopyHint } from './code';
import { DEMO_JUDGE_LINE as realDemoJudgeLine, demoState as realDemoState } from './demo';
import { buildQuestion as realBuildQuestion, isCorrect as realIsCorrect, QUESTION_KINDS as realQuestionKinds } from './questions';
import { startEndless as realStartEndless, answerEndless as realAnswerEndless, nextEndlessQuestion as realNextEndlessQuestion, finishEndless as realFinishEndless, endlessPool as realEndlessPool, comboMultiplier as realComboMultiplier, ENDLESS_HEARTS as realEndlessHearts } from './endless';
import { xpFor as realXpFor, levelFromXp as realLevelFromXp, addXp as realAddXp } from './xp';
// --- Desktop rail (v2.1) ---
import { lastSevenDays as realLastSevenDays, todayGoals as realTodayGoals, nextLesson as realNextLesson } from './rail';
import type { RailDay, RailGoals } from './rail';
// --- end Desktop rail ---

// --- Dates -----------------------------------------------------

/** Day 1 is Sun Oct 25, 2026. */
export const LAUNCH_DATE: LocalDate = '2026-10-25';

export function todayLocal(_now: Date): LocalDate {
  return realTodayLocal(_now);
}
export function dayNumber(_date: LocalDate): number {
  return realDayNumber(_date);
}
export function dateOfDay(_day: number): LocalDate {
  return realDateOfDay(_day);
}

// --- Fresh state ------------------------------------------------------------

export function newState(): SaveState {
  return realNewState();
}

// --- Clue Ladder round --------------------------------------------

export interface CardView {
  term: string;
  /** 'live' can be picked; 'missed' flipped cream with amber tab; 'answer' flipped yellow. */
  state: 'live' | 'missed' | 'answer';
  selected: boolean;
  /** Shown once flipped. */
  meaning?: string;
}

export interface RoundView {
  key: string;
  item: TermItem;
  mode: RoundMode;
  record: RoundRecord;
  title: string;
  bars: number;
  /** "{b} bars left. An extra clue costs 1. A wrong guess costs 3." with its variants. */
  batteryLine: string;
  clues: string[];
  /** Missed cards move to the end. */
  cards: CardView[];
  nextClue: { enabled: boolean; label: string; reason?: string };
  canShowAnswer: boolean;
  /** "Careful: a wrong guess now ends the round. It still counts." when it applies. */
  warning: string | null;
  ended: boolean;
  /** Result line once ended ("You learned {word}. Solved with {n} bars left." etc.). */
  resultLine: string | null;
  /** "That's a hard one. Here's what it means." after a round-ending miss. */
  resultNote: string | null;
  /** "Just for fun: this doesn't change your streak or Days learned." for rounds that can't count. */
  justForFun: string | null;
  /** "Tap Next clue if you're not sure. More bars left is better." until the first finished round. */
  firstRoundHint: string | null;
  /** True until the player's first finished round (show the first-round labels). */
  firstRound: boolean;
  /** Miss line from the last wrong Check, until the next tap. */
  missLine: string | null;
  missSpeaker: 'floyd' | 'bud' | null;
  /** Bud's light dot. */
  budMood: 'happy' | 'sympathetic' | 'idle';
}

export type RoundAction =
  | { type: 'select'; term: string }
  | { type: 'check' }
  | { type: 'nextClue' }
  | { type: 'showAnswer' } // after the user confirms "Yes, show it"
  | { type: 'postStep'; step: number };

export interface RoundResult {
  state: SaveState;
  /** Text for the message strip (aria-live), or null to keep it. */
  message: string | null;
  outcome: 'none' | 'selected' | 'wrong' | 'solved' | 'learned';
  newBadges: BadgeId[];
  /** XP added by this tap (only when the round ends), else 0. */
  xpGained: number;
}

/** Opening a round starts it. Returns the existing record if already started. */
export function startRound(
  _state: SaveState,
  _content: ContentBundle,
  _key: string,
  _itemId: string,
  _mode: RoundMode,
  _today: LocalDate,
): SaveState {
  return realStartRound(_state, _content, _key, _itemId, _mode, _today);
}

export function roundView(_state: SaveState, _content: ContentBundle, _key: string, _today: LocalDate): RoundView {
  return realRoundView(_state, _content, _key, _today);
}

/** Applies one tap. Round-ending writes also update counters, badges and Review. */
export function applyRound(
  _state: SaveState,
  _content: ContentBundle,
  _key: string,
  _action: RoundAction,
  _today: LocalDate,
): RoundResult {
  return realApplyRound(_state, _content, _key, _action, _today);
}

/** "Play again": overwrites a finished solo record with a fresh one marked replay. */
export function replayRound(
  _state: SaveState,
  _content: ContentBundle,
  _key: string,
  _today: LocalDate,
): SaveState {
  return realReplayRound(_state, _content, _key, _today);
}

/** share text (dailies that count). */
export function shareText(
  _state: SaveState,
  _content: ContentBundle,
  _key: string,
  _opts: { appUrl: string; demo: boolean },
): string {
  return realShareText(_state, _content, _key, _opts);
}

// --- Home ----------------------------------------------------------

export interface HomeView {
  phase: 'prelaunch' | 'first' | 'notPlayed' | 'played' | 'noWord';
  daysLearned: number;
  streak: number;
  gentleLine: string | null;
  today: { day: number; key: string; started: boolean; finished: boolean } | null;
  grace: { day: number; key: string; started: boolean } | null;
  reviewDue: number;
  todaysLesson: Lesson | null;
  shareLine: string | null;
  ptpInProgress: boolean;
  /** "Streak: {s} days played", only at 2 or more. */
  streakLine: string | null;
  /** "Review: {n} words to practice" or "Review: nothing due today." */
  reviewLink: string;
}

export function homeView(_state: SaveState, _content: ContentBundle, _today: LocalDate): HomeView {
  return realHomeView(_state, _content, _today);
}

// --- Review ---------------------------------------------------------------

export interface ReviewQuestion {
  itemId: string;
  prompt: string; // "Which one means: {meaning}?"
  options: { term: string; meaning: string }[]; // term + 2 decoys, shuffled
  answer: string;
}

export function reviewSession(_state: SaveState, _content: ContentBundle, _today: LocalDate): ReviewQuestion[] {
  return realReviewSession(_state, _content, _today);
}
export function answerReview(
  _state: SaveState,
  _itemId: string,
  _correct: boolean,
  _today: LocalDate,
): SaveState {
  return realAnswerReview(_state, _itemId, _correct, _today);
}

// --- Lessons --------------------------------------------------------------

export interface LessonStatus {
  lesson: Lesson;
  open: boolean;
  done: boolean;
  /** "Finish the earlier lesson first." or "Opens {weekday}, {month} {day}." */
  lockLine: string | null;
}

export function lessonStatuses(_state: SaveState, _content: ContentBundle, _today: LocalDate): LessonStatus[] {
  return realLessonStatuses(_state, _content, _today);
}
/** Options in display order for check i. */
export function lessonOptions(_lesson: Lesson, _checkIndex: number): string[] {
  return realLessonOptions(_lesson, _checkIndex);
}
export function saveLessonProgress(
  _state: SaveState,
  _lessonId: string,
  _patch: { card?: number; answer?: string },
): SaveState {
  return realSaveLessonProgress(_state, _lessonId, _patch);
}
export function finishLesson(
  _state: SaveState,
  _content: ContentBundle,
  _lessonId: string,
  _today: LocalDate,
): { state: SaveState; newBadges: BadgeId[]; xpGained: number } {
  return realFinishLesson(_state, _content, _lessonId, _today);
}

// --- Practice and Old Tech ------------------------------------------------

export interface ListEntry {
  itemId: string;
  key: string;
  label: string; // term once finished, else date or "Not finished yet"
  date?: LocalDate;
  finished: boolean;
  open: boolean;
  lockLine: string | null;
  /** Daily day number (Practice only). */
  day?: number;
  topic?: TopicId;
}

export function practiceList(_state: SaveState, _content: ContentBundle, _today: LocalDate): ListEntry[] {
  return realPracticeList(_state, _content, _today);
}
export function oldTechList(_state: SaveState, _content: ContentBundle, _today: LocalDate): ListEntry[] {
  return realOldTechList(_state, _content, _today);
}
/** "Next word" target, or a message when none is left. */
export function nextWord(
  _state: SaveState,
  _content: ContentBundle,
  _mode: 'practice' | 'oldtech',
  _today: LocalDate,
): { entry: ListEntry } | { message: string } {
  return realNextWord(_state, _content, _mode, _today);
}

// --- Pass the Phone -------------------------------------------------------

export function startPtpSet(_state: SaveState, _content: ContentBundle, _today: LocalDate): SaveState {
  return realStartPtpSet(_state, _content, _today);
}
/** "Next round": moves the set to its next round (after rounds 1 to 3). */
export function advancePtp(_state: SaveState): SaveState {
  return realAdvancePtp(_state);
}
/** Item id for a round of the current set, or null if there is no set. */
export function ptpRoundItem(_state: SaveState, _round: number): string | null {
  return realPtpRoundItem(_state, _round);
}
export interface PtpSummary {
  rounds: { itemId: string; term: string; solved: boolean; bars: number }[];
  total: number; // {N}
  best: number; // {M}
}
export function ptpSummary(_state: SaveState, _content: ContentBundle): PtpSummary {
  return realPtpSummary(_state, _content);
}

// --- Badges -----------------------------------------------------------------

export interface BadgeView {
  id: BadgeId;
  name: string;
  earned: LocalDate | null;
  condition: string;
  progress: { have: number; need: number } | null;
  /** Extra line on the card (Week One only). */
  note: string | null;
}
export function badgeViews(_state: SaveState, _content: ContentBundle, _today: LocalDate): BadgeView[] {
  return realBadgeViews(_state, _content, _today);
}

// --- Restore code ------------------------------------------------------------

export function encodeProgressCode(_state: SaveState, _content: ContentBundle, _today: LocalDate): string {
  return realEncodeProgressCode(_state, _content, _today);
}
export type DecodeResult =
  | { ok: true; apply: (state: SaveState, content: ContentBundle, today: LocalDate) => SaveState }
  | { ok: false; error: 'typo' | 'newer' | 'format' };
export function decodeProgressCode(_text: string): DecodeResult {
  return realDecodeProgressCode(_text);
}

// --- Demo ---------------------------------------------------------------------

export function demoState(
  _kind: 'judge' | 'new',
  _content: ContentBundle,
): { state: SaveState; today: LocalDate; content: ContentBundle } {
  return realDemoState(_kind, _content);
}

// --- Quick questions (v2) -------------------------------------------------

/** Builds one question from an item and its decoys. Same inputs = same question. */
export function buildQuestion(_content: ContentBundle, _itemId: string, _kind: QuestionKind, _seed: string): Question {
  return realBuildQuestion(_content, _itemId, _kind, _seed);
}
/** True if `choice` is the right option for the question. */
export function isCorrect(_question: Question, _choice: string): boolean {
  return realIsCorrect(_question, _choice);
}

// --- Endless (v2) -----------------------------------------------------------

/** A new run with its first question ready. Only items released by `today`. */
export function startEndless(_state: SaveState, _content: ContentBundle, _today: LocalDate, _seed: number): EndlessRun {
  return realStartEndless(_state, _content, _today, _seed);
}
/** Scores the current question (hearts, combo, score, XP). Call nextEndlessQuestion to move on. */
export function answerEndless(_run: EndlessRun, _answer: EndlessAnswer): EndlessAnswerResult {
  return realAnswerEndless(_run, _answer);
}
/** The run with its next question. Unchanged if the run is over. */
export function nextEndlessQuestion(_run: EndlessRun, _content: ContentBundle): EndlessRun {
  return realNextEndlessQuestion(_run, _content);
}
/** Saves the run: endlessBest, endlessGames and XP. Call on game over or when the player leaves. */
export function finishEndless(_state: SaveState, _run: EndlessRun, _today: LocalDate): SaveState {
  return realFinishEndless(_state, _run, _today);
}

// --- XP and levels (v2) -----------------------------------------------------

export function xpFor(_action: XpAction): number {
  return realXpFor(_action);
}
/** {level, intoLevel, needed} from total XP. Level 2 comes after about 3 right answers. */
export function levelFromXp(_xp: number): LevelInfo {
  return realLevelFromXp(_xp);
}

// --- Desktop rail (v2.1) ---
export function lastSevenDays(_state: SaveState, _today: LocalDate): RailDay[] {
  return realLastSevenDays(_state, _today);
}
export function todayGoals(_state: SaveState, _today: LocalDate): RailGoals {
  return realTodayGoals(_state, _today);
}
export function nextLesson(_state: SaveState, _content: ContentBundle, _today: LocalDate): Lesson | null {
  return realNextLesson(_state, _content, _today);
}
export type { RailDay, RailGoals } from './rail';
// --- end Desktop rail ---

export {
  realAddXp as addXp,
  realEndlessPool as endlessPool,
  realComboMultiplier as comboMultiplier,
  realEndlessHearts as ENDLESS_HEARTS,
  realQuestionKinds as QUESTION_KINDS,
  realAddDays as addDays,
  realLongDate as longDate,
  realShareLines as shareLines,
  realReviewLinkText as reviewLinkText,
  realReviewDoneLine as reviewDoneLine,
  realPracticeEmpty as PRACTICE_EMPTY,
  realOldTechIntro as OLD_TECH_INTRO,
  realTypoMessage as TYPO_MESSAGE,
  realNewerMessage as NEWER_MESSAGE,
  realCopyHint as COPY_HINT,
  realWeekOneNote as WEEK_ONE_NOTE,
  realBadgeNames as BADGE_NAMES,
  realPtpRoundCardLines as ptpRoundCardLines,
  realPtpTotalLine as ptpTotalLine,
  realPtpBestLine as ptpBestLine,
  realDemoJudgeLine as DEMO_JUDGE_LINE,
  realTodaysLesson as todaysLesson,
  realDealPtpSet as dealPtpSet,
};

// --- Lesson sessions (v2.1) ---
export { buildLessonSession, buildWordSession, answerStep, nextStep, sessionDone, sessionStars, finishLessonSession, WORD_LESSON_XP } from './session';
