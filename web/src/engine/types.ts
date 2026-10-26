// Shared contract between content, engine and UI.
// Change a shape here only together with every consumer.

/** Local calendar date, "YYYY-MM-DD". Never a timestamp. */
export type LocalDate = string;

export type TopicId =
  | 'locks-and-keys'
  | 'talking-computers'
  | 'scams-and-fakes'
  | 'your-phone'
  | 'internet-talk'
  | 'how-the-internet-works'
  | 'money-on-your-phone'
  | 'old-tech';

/** topic order for dailies and lessons. */
export const TOPIC_ORDER: TopicId[] = [
  'locks-and-keys',
  'scams-and-fakes',
  'your-phone',
  'internet-talk',
  'how-the-internet-works',
  'money-on-your-phone',
  // Chatbot words come late on purpose, after the everyday ones.
  'talking-computers',
];

export type Speaker = 'floyd' | 'bud';

export interface Source {
  name: string;
  url: string;
}

export interface Decoy {
  term: string;
  meaning: string;
  source_urls: string[];
}

export interface ExchangeLine {
  speaker: Speaker;
  /** Floyd lines only. */
  tone?: 'right' | 'neutral' | 'friendly';
  text: string;
  link_urls?: string[];
}

export type Difficulty = 1 | 2 | 3;

/** A daily term, a Pass the Phone extra (ptp-1, ptp-2) or an Old Tech item. */
export interface TermItem {
  id: string;
  kind: 'term';
  topic: TopicId;
  term: string;
  meaning: string;
  clues: [string, string, string, string, string];
  assumes: string[];
  decoys: [Decoy, Decoy, Decoy];
  exchange: ExchangeLine[];
  old_tech: boolean;
  sources: Source[];
  checked_on: LocalDate | null;
  difficulty: Difficulty;
  decisive_clue: Difficulty;
  /** Day number the item first becomes visible (Old Tech, lessons). Dailies use their schedule day. */
  release_day?: number;
  /** Extra word for Endless only. Never a daily word, out from day 1. */
  bank?: boolean;
  // --- Daily Jargle (v2.1) ---
  /** Daily Jargle answer, 4 to 7 letters A-Z. */
  puzzle?: string;
  // --- Lesson session fields (v2.1). All optional. ---
  /** Fill the blank: a real sentence with "___" where the term goes, and 2 or 3 wrong terms. */
  blank?: BlankSentence;
  /** One short line on why this word matters in real life. */
  why?: string;
  /** A short meaning, 6 words or fewer, used in Match pairs. */
  short?: string;
  /** "Scam or safe?" style cards for the word's own mini lesson. */
  situations?: Situation[];
}

export interface BlankSentence {
  /** Has exactly one "___". */
  sentence: string;
  /** 2 or 3 wrong choices. Never the term itself. */
  wrong: string[];
}

/** A short real-life moment with 2 choices, like "Scam" and "Safe". */
export interface Situation {
  text: string;
  options: [string, string];
  /** One of options. */
  answer: string;
  /** One short line saying why. */
  why: string;
}

export interface LessonCard {
  text: string;
  mascot: Speaker;
  line: string;
}

export interface LessonCheck {
  prompt: string;
  options: string[];
  answer: string;
  why: string;
}

/** worked lesson JSON. */
export interface Lesson {
  id: string;
  topic: TopicId;
  /** 1-based position inside its topic. */
  number: number;
  title: string;
  cards: LessonCard[];
  checks: LessonCheck[];
  takeaway: string;
  sources: Source[];
  checked_on: LocalDate | null;
  /** Defaults to `number`. */
  release_day?: number;
  // --- Lesson session fields (v2.1). All optional. ---
  /** Item ids taught in this lesson (4). Each one is out by the lesson's release day. */
  words?: string[];
  /** 2 to 4 situation cards. */
  situations?: Situation[];
}

export interface ScheduleDay {
  date: LocalDate;
  /** TermItem id. */
  term: string;
  rerun: boolean;
}

/** schedule file. */
export interface Schedule {
  version: number;
  days: ScheduleDay[];
}

/** miss lines. `needs_clue` lines wait while Next clue is off. */
export interface MissLine {
  text: string;
  needs_clue?: boolean;
}

export interface MissLines {
  either: MissLine[];
  floyd: MissLine[];
}

/** Everything the app ships, loaded from /content/bundle.json. */
export interface ContentBundle {
  version: number;
  items: Record<string, TermItem>;
  lessons: Lesson[];
  /** Old Tech item ids in their fixed order. */
  oldTech: string[];
  /** ptp-1 and ptp-2. */
  ptpExtras: string[];
  schedule: Schedule;
  missLines: MissLines;
  commonWords: string[];
}

// ---------------------------------------------------------------------------
// Saved state. Stored as JSON under `jargle:v1`, `jargle:demo:judge`,
// `jargle:demo:new`.

export type RoundMode = 'daily' | 'practice' | 'oldtech' | 'ptp';
export type RoundStatus = 'playing' | 'solved' | 'learned';

export interface RoundRecord {
  item_id: string;
  mode: RoundMode;
  started_on: LocalDate;
  /** Clues shown, 1..5. */
  k: number;
  /** Missed decoy terms, in order. */
  spent: string[];
  selected: string | null;
  status: RoundStatus;
  /** 0 reveal, 1 share, 2 done card. */
  post_step: number;
  miss_line: string | null;
  replay: boolean;
  finished_on?: LocalDate;
  /** Bars left at the end; derived but frozen when the round ends. */
  end_bars?: number;
  /** Day number the round counts for, if it counted. */
  counted_day?: number;
  /** Clue count when the one non-ending miss happened. */
  miss_k?: number;
  /** Who says miss_line. */
  miss_speaker?: Speaker;
}

export interface LessonRecord {
  card: number;
  answers: string[];
  finished_on: LocalDate | null;
  /** Best stars (1 to 3) from a lesson session. Missing on older saves. */
  stars?: number;
}

export interface PtpSet {
  id: number;
  /** Item ids for rounds 1..4. */
  rounds: string[];
  /** Current round, 1..4. */
  r: number;
  /** True once round 4 has finished. */
  done?: boolean;
}

export type BadgeId =
  | 'first-word'
  | 'week-one'
  | 'days-30'
  | 'days-60'
  | 'first-lesson'
  | 'floyds-student'
  | 'taught-someone';

export type TextSize = 'normal' | 'large' | 'largest';

export interface Settings {
  textSize: TextSize;
  sound: boolean;
  reducedMotion: boolean;
}

export interface SaveState {
  v: 1;
  /** Keys: `d:{day}` for dailies, item id for other solo rounds, `ptp:{set}:{r}`. */
  rounds: Record<string, RoundRecord>;
  ptpSet: PtpSet | null;
  /** {N}: words played together on this phone. */
  ptpTotal: number;
  /** {M}: best set, rounds solved with 3+ bars left. */
  ptpBest: number;
  firstPlayDay: number | null;
  /** item id -> due dates. */
  review: Record<string, LocalDate[]>;
  /** Review answers today: item id -> last session date answered. */
  reviewSeen: Record<string, LocalDate>;
  lessons: Record<string, LessonRecord>;
  badges: Partial<Record<BadgeId, LocalDate>>;
  /** Next miss line index per speaker. */
  missLineIndex: { floyd: number; bud: number };
  settings: Settings;
  flags: {
    firstRoundDone: boolean;
    textSizeAsked: boolean;
    inAppNoteHidden: boolean;
    persistAsked: boolean;
  };
  // Progress history. Kept apart from round records because a replay
  // overwrites its record, and a progress code has no records to load.
  /** Day numbers whose daily counted (Days learned). */
  countedDays?: number[];
  /** Day numbers whose daily was finished solo, counted or not. */
  finishedDays?: number[];
  /** Item ids finished solo (Home, Practice, Old Tech). */
  soloDone?: string[];
  /** Item id -> last date it was finished on this phone, in any mode. */
  lastFinished?: Record<string, LocalDate>;
  /** Miss lines still to say this cycle, as indexes, per speaker. */
  missLineQueue?: { floyd: number[]; bud: number[] };
  // v2 fields. Optional so saves from before v2 still load (missing = 0).
  /** Total XP earned on this phone. The progress code does not carry it. */
  xp?: number;
  /** Best Endless score. */
  endlessBest?: number;
  /** Endless games finished. */
  endlessGames?: number;
  // --- Lesson sessions (v2.1) ---
  /** Word mini lessons: item id -> date last finished. XP is paid once per word. */
  wordLessons?: Record<string, LocalDate>;
  // --- Desktop rail (v2.1) ---
  /** Last date an Endless run finished on this phone. Used for today's goals. */
  endlessLastDay?: LocalDate;
  // --- end Desktop rail ---
  // --- Daily Jargle (v2.1) ---
  /** Daily Jargle records keyed by day number string. */
  jargle?: Record<string, JargleRecord>;
}

// --- Daily Jargle (v2.1) ---
export type JargleTile = 'correct' | 'present' | 'absent';
export type JargleStatus = 'playing' | 'won' | 'lost';

export interface JargleRecord {
  guesses: string[];
  status: JargleStatus;
  started_on: LocalDate;
  finished_on?: LocalDate;
}

// ---------------------------------------------------------------------------
// Quick questions (v2). Built only from an item's own term, meaning and its
// 3 decoys, so no new content is needed.

// Letter tiles (v2.1)
export type QuestionKind = 'meaning' | 'name' | 'truefalse' | 'oldnew' | 'clue' | 'tiles';

/** Fields every question has. */
export interface QuestionBase {
  /** "{kind}:{itemId}:{seed}". Unique within a run. */
  id: string;
  kind: QuestionKind;
  itemId: string;
  difficulty: Difficulty;
  /** Buttons in display order (already shuffled where that makes sense). */
  options: string[];
  /** The option that is right. Always one of `options`. */
  answer: string;
  /** Short line shown after answering: "{term}: {meaning}". */
  why: string;
}

/** See a word, pick its meaning from 4 (the item's meaning + its 3 decoys' meanings). */
export interface MeaningQuestion extends QuestionBase {
  kind: 'meaning';
  term: string;
}

/** See a meaning, pick the word from 4 (the term + its 3 decoy terms). */
export interface NameQuestion extends QuestionBase {
  kind: 'name';
  meaning: string;
}

/** "{term} means: {shownMeaning}". Options are always ['True', 'False']. False uses a decoy's meaning. */
export interface TrueFalseQuestion extends QuestionBase {
  kind: 'truefalse';
  term: string;
  shownMeaning: string;
}

/** Is this old tech or today's tech? Options are always ['Old tech', "Today's tech"]. Uses `old_tech`. */
export interface OldNewQuestion extends QuestionBase {
  kind: 'oldnew';
  term: string;
}

/**
 * Mini Clue Climb: the item's first 3 clues, shown one at a time by the UI,
 * then pick the word from 4. Fewer clues used = more points.
 */
export interface ClueQuestion extends QuestionBase {
  kind: 'clue';
  /** Exactly 3 clues (the first 3 of the item; the decisive clue is always among them). */
  clues: string[];
}

/** See the meaning, spell the word with letter tiles; options is [term] (no buttons are shown) and answer is the term. */
// Letter tiles (v2.1)
export interface TilesQuestion extends QuestionBase {
  kind: 'tiles';
  meaning: string;
  term: string;
}

export type Question = MeaningQuestion | NameQuestion | TrueFalseQuestion | OldNewQuestion | ClueQuestion | TilesQuestion;

// ---------------------------------------------------------------------------
// Endless mode (v2). A run lives in memory (or the UI may keep it in
// sessionStorage); only finishEndless writes to SaveState.

export interface EndlessAnswer {
  /** The option the player tapped. */
  choice: string;
  /** Clue questions only: clues shown when they answered, 1 to 3. Missing = 1. */
  cluesUsed?: number;
  /** Tiles questions only: points from the tiles game (10 to 18: base 10, speed bonus, no-hint bonus). Missing = 10. */
  tileScore?: number;
}

export interface EndlessRun {
  seed: number;
  /** Date the run started. Fixes which items are released. */
  today: LocalDate;
  /** Item ids this run may ask about (released by `today`). */
  pool: string[];
  /** Item ids already asked in this cycle; cleared once the whole pool is used. */
  used: string[];
  /** The question on screen now. It stays after the last answer so the why line can show. Null only if the pool is empty. */
  question: Question | null;
  /** True after answerEndless and before nextEndlessQuestion. */
  answered: boolean;
  /** Questions asked so far, counting the current one. */
  asked: number;
  /** Right answers so far. */
  correct: number;
  score: number;
  /** Starts at 3. A wrong answer loses one. */
  hearts: number;
  /** Right answers in a row right now. */
  combo: number;
  bestCombo: number;
  /** XP earned this run, added to SaveState by finishEndless. */
  xp: number;
  /** True when hearts reach 0. */
  over: boolean;
}

export interface EndlessAnswerResult {
  run: EndlessRun;
  correct: boolean;
  /** Points added to the score (base x combo multiplier). 0 when wrong. */
  points: number;
  xpGained: number;
  /** Combo after this answer (0 after a wrong one). */
  comboAfter: number;
  /** Multiplier used for this answer: 1, 2 or 3. */
  multiplier: number;
}

// ---------------------------------------------------------------------------
// XP and levels (v2).

/** Things that earn XP. Bars are the bars left when a Clue Climb round ended. */
export type XpAction =
  | { type: 'round'; mode: RoundMode; status: 'solved' | 'learned'; bars: number }
  | { type: 'lesson' }
  | { type: 'endless'; correct: boolean; combo: number }
  // --- Daily Jargle (v2.1) ---
  | { type: 'jargle'; won: boolean; guesses: number };

export interface LevelInfo {
  /** 1 for a new player. */
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP this level needs in total before the next one. */
  needed: number;
}

// ---------------------------------------------------------------------------
// Lesson sessions (v2.1). A session is a short list of mixed steps built from a
// lesson (or one word). It lives in memory; only the finish writes to SaveState.

export type SessionStepKind = 'learn' | 'pairs' | 'blank' | 'situation' | 'meaning' | 'build' | 'recap';

export interface LearnCard {
  /** Big heading: the word. Empty for lesson cards, whose screen already shows the title. */
  title: string;
  text: string;
  /** A real sentence that uses the word. */
  example?: string;
  mascot: Speaker;
  line: string;
}

export interface LearnStep {
  id: string;
  kind: 'learn';
  /** Shown one at a time inside the step. */
  cards: LearnCard[];
}

export interface PairsStep {
  id: string;
  kind: 'pairs';
  /** 4 pairs. `terms` and `meanings` are each shuffled for display. */
  pairs: { itemId: string; term: string; meaning: string }[];
  terms: string[];
  meanings: string[];
}

export interface BlankStep {
  id: string;
  kind: 'blank';
  itemId: string;
  /** Sentence text before and after the blank. */
  before: string;
  after: string;
  options: string[];
  answer: string;
  why: string;
}

export interface SituationStep {
  id: string;
  kind: 'situation';
  /** Null for lesson situations that are not about one word. */
  itemId: string | null;
  /** "Scam or safe?", "Yes or no?" or the lesson check prompt. */
  prompt: string;
  text: string;
  options: string[];
  answer: string;
  why: string;
}

export interface MeaningStep {
  id: string;
  kind: 'meaning';
  itemId: string;
  term: string;
  options: string[];
  answer: string;
  why: string;
}

/** Spell the word. The UI uses letter tiles (a text box until those land). */
export interface BuildStep {
  id: string;
  kind: 'build';
  itemId: string;
  /** The meaning shown as the clue. */
  clue: string;
  answer: string;
  why: string;
}

export interface RecapStep {
  id: string;
  kind: 'recap';
  title: string;
  takeaway: string;
  words: { term: string; meaning: string }[];
}

export type SessionStep = LearnStep | PairsStep | BlankStep | SituationStep | MeaningStep | BuildStep | RecapStep;

export interface LessonSession {
  kind: 'lesson' | 'word';
  /** Set for kind 'lesson'. */
  lessonId: string | null;
  /** Set for kind 'word'. */
  itemId: string | null;
  steps: SessionStep[];
  /** Step on screen now. Equal to steps.length when the session is over. */
  index: number;
  /** Steps that were answered at least once. */
  answered: number;
  /** Wrong answers, counting repeats. */
  misses: number;
  /** Item ids that were missed at least once, in order. */
  missedItems: string[];
  /** Step ids already sent to the end once, so a step comes back only one time. */
  requeued: string[];
}
