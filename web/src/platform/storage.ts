import type { LessonRecord, RoundRecord, SaveState } from '../engine/types';
import { newState } from '../engine/state';

export type StorageKey = 'jargle:v1' | 'jargle:demo:judge' | 'jargle:demo:new';

let lastLocalSaveAt = 0;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function filterList(value: unknown, kind: 'number' | 'string'): string[] | number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === kind) as string[] | number[];
}

function readRounds(value: unknown): SaveState['rounds'] {
  const result: SaveState['rounds'] = {};
  const source = asObject(value);
  for (const key of Object.keys(source)) {
    const item = asObject(source[key]);
    const status = item.status;
    const spent = item.spent;
    if ((status !== 'playing' && status !== 'solved' && status !== 'learned')
      || typeof item.k !== 'number'
      || !Array.isArray(spent) || !spent.every((entry) => typeof entry === 'string')
      || typeof item.post_step !== 'number') continue;
    if (item.finished_on !== undefined && typeof item.finished_on !== 'string') continue;
    result[key] = item as unknown as RoundRecord;
  }
  return result;
}

function readReview(value: unknown): SaveState['review'] {
  const result: SaveState['review'] = {};
  const source = asObject(value);
  for (const key of Object.keys(source)) {
    const entries = source[key];
    if (Array.isArray(entries)) {
      const dates = entries.filter((entry): entry is string => typeof entry === 'string');
      result[key] = dates;
    }
  }
  return result;
}

function readReviewSeen(value: unknown): SaveState['reviewSeen'] {
  const result: SaveState['reviewSeen'] = {};
  const source = asObject(value);
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'string') result[key] = source[key] as string;
  }
  return result;
}

function readLessons(value: unknown): SaveState['lessons'] {
  const result: SaveState['lessons'] = {};
  const source = asObject(value);
  for (const key of Object.keys(source)) {
    const item = asObject(source[key]);
    if (typeof item.card !== 'number' || !Array.isArray(item.answers)
      || !item.answers.every((entry) => typeof entry === 'string')
      || (item.finished_on !== null && typeof item.finished_on !== 'string')) continue;
    const record = { ...item } as unknown as LessonRecord;
    // Stars were added after the first lesson saves. Keep only valid values.
    if (item.stars !== undefined && (typeof item.stars !== 'number' || item.stars < 1 || item.stars > 3 || !Number.isInteger(item.stars))) {
      delete (record as { stars?: number }).stars;
    }
    result[key] = record;
  }
  return result;
}

// v2.1 lesson sessions
function readWordLessons(value: unknown): SaveState['wordLessons'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const key of Object.keys(value)) {
    const date = (value as Record<string, unknown>)[key];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) result[key] = date;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function readBadges(value: unknown): SaveState['badges'] {
  const result: SaveState['badges'] = {};
  const source = asObject(value);
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'string') result[key as keyof SaveState['badges']] = source[key] as never;
  }
  return result;
}

function readPtpSet(value: unknown, fallback: SaveState['ptpSet']): SaveState['ptpSet'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const ptp = value as Record<string, unknown>;
  if (typeof ptp.id !== 'number') return fallback;
  if (!Array.isArray(ptp.rounds)) return fallback;
  if (!ptp.rounds.every((item) => typeof item === 'string')) return fallback;
  if (typeof ptp.r !== 'number') return fallback;
  if (typeof ptp.done === 'boolean') {
    return { id: ptp.id, rounds: ptp.rounds as string[], r: ptp.r, done: ptp.done };
  }
  return { id: ptp.id, rounds: ptp.rounds as string[], r: ptp.r };
}

function readTextSize(
  value: unknown,
  fallback: SaveState['settings']['textSize'],
): SaveState['settings']['textSize'] {
  if (value === 'normal' || value === 'large' || value === 'largest') return value;
  return fallback;
}

/** A whole number of 0 or more, or undefined when the save never had one. */
function readCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

/** Copies XP and the Endless scores onto a state, skipping the ones that are missing. */
function addScores(state: SaveState, xp: number | undefined, endlessBest: number | undefined, endlessGames: number | undefined, endlessLastDay?: string): SaveState {
  if (xp !== undefined) state.xp = xp;
  if (endlessBest !== undefined) state.endlessBest = endlessBest;
  if (endlessGames !== undefined) state.endlessGames = endlessGames;
  if (endlessLastDay !== undefined) state.endlessLastDay = endlessLastDay;
  return state;
}

function validState(value: unknown): SaveState | null {
  const raw = asObject(value);
  if (raw.v !== 1) return null;
  const defaults = newState();
  const settings = asObject(raw.settings);
  const flags = asObject(raw.flags);
  const miss = asObject(raw.missLineIndex);
  const queue = asObject(raw.missLineQueue);
  const ptpSet = readPtpSet(raw.ptpSet, defaults.ptpSet);
  const lastFinished: Record<string, string> = {};
  const savedLastFinished = asObject(raw.lastFinished);
  for (const key of Object.keys(savedLastFinished)) {
    const date = savedLastFinished[key];
    if (typeof date === 'string') lastFinished[key] = date;
  }
  const state: SaveState = {
    ...defaults,
    v: 1,
    rounds: readRounds(raw.rounds),
    ptpSet,
    ptpTotal: typeof raw.ptpTotal === 'number' ? raw.ptpTotal : defaults.ptpTotal,
    ptpBest: typeof raw.ptpBest === 'number' ? raw.ptpBest : defaults.ptpBest,
    firstPlayDay: typeof raw.firstPlayDay === 'number' || raw.firstPlayDay === null
      ? raw.firstPlayDay
      : defaults.firstPlayDay,
    review: readReview(raw.review),
    reviewSeen: readReviewSeen(raw.reviewSeen),
    lessons: readLessons(raw.lessons),
    wordLessons: readWordLessons(raw.wordLessons),
    badges: readBadges(raw.badges),
    missLineIndex: {
      floyd: typeof miss.floyd === 'number' ? miss.floyd : 0,
      bud: typeof miss.bud === 'number' ? miss.bud : 0,
    },
    settings: {
      textSize: readTextSize(settings.textSize, defaults.settings.textSize),
      sound: typeof settings.sound === 'boolean' ? settings.sound : defaults.settings.sound,
      reducedMotion: typeof settings.reducedMotion === 'boolean'
        ? settings.reducedMotion
        : defaults.settings.reducedMotion,
    },
    flags: {
      firstRoundDone: typeof flags.firstRoundDone === 'boolean' ? flags.firstRoundDone : false,
      textSizeAsked: typeof flags.textSizeAsked === 'boolean' ? flags.textSizeAsked : false,
      inAppNoteHidden: typeof flags.inAppNoteHidden === 'boolean' ? flags.inAppNoteHidden : false,
      persistAsked: typeof flags.persistAsked === 'boolean' ? flags.persistAsked : false,
    },
    countedDays: filterList(raw.countedDays, 'number') as number[],
    finishedDays: filterList(raw.finishedDays, 'number') as number[],
    soloDone: filterList(raw.soloDone, 'string') as string[],
    lastFinished,
    missLineQueue: {
      floyd: filterList(queue.floyd, 'number') as number[],
      bud: filterList(queue.bud, 'number') as number[],
    },
  };
  // Desktop rail (v2.1): the last day an Endless run finished, kept only if it looks like a date.
  const endlessLastDay = typeof raw.endlessLastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.endlessLastDay)
    ? raw.endlessLastDay
    : undefined;
  return addScores(state, readCount(raw.xp), readCount(raw.endlessBest), readCount(raw.endlessGames), endlessLastDay);
}

export function loadState(key: StorageKey): SaveState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const savedAt = asObject(parsed).savedAt;
    if (typeof savedAt === 'number') lastLocalSaveAt = savedAt;
    return validState(parsed);
  } catch {
    return null;
  }
}

export function saveState(key: StorageKey, state: SaveState): boolean {
  try {
    const savedAt = Date.now();
    window.localStorage.setItem(key, JSON.stringify({ ...state, savedAt }));
    lastLocalSaveAt = savedAt;
    return true;
  } catch {
    return false;
  }
}

export function storageWorks(): boolean {
  try {
    const key = 'jargle:storage-test';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function requestPersist(): void {
  try {
    const storage = navigator.storage;
    if (storage && typeof storage.persist === 'function') {
      void storage.persist().catch(() => undefined);
    }
  } catch {
    // Some browsers throw while reading navigator.storage.
  }
}

function ended(round: RoundRecord): boolean {
  return round.status !== 'playing';
}

function finishedDate(round: RoundRecord): string {
  return round.finished_on ?? '9999-99-99';
}

function chooseRound(mine: RoundRecord, theirs: RoundRecord): RoundRecord {
  const mineEnded = ended(mine);
  const theirsEnded = ended(theirs);
  if (mineEnded !== theirsEnded) return theirsEnded ? theirs : mine;
  if (mineEnded) {
    const mineDate = finishedDate(mine);
    const theirDate = finishedDate(theirs);
    if (theirDate < mineDate) return theirs;
    if (theirDate > mineDate) return mine;
    return theirs.post_step > mine.post_step ? theirs : mine;
  }
  const mineProgress = mine.k + mine.spent.length;
  const theirProgress = theirs.k + theirs.spent.length;
  if (theirProgress > mineProgress) return theirs;
  if (theirProgress < mineProgress) return mine;
  if (theirs.post_step > mine.post_step) return theirs;
  return mine;
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function chooseLesson(mine: LessonRecord, theirs: LessonRecord): LessonRecord {
  const mineFinished = mine.finished_on !== null;
  const theirsFinished = theirs.finished_on !== null;
  let chosen: LessonRecord;
  if (mineFinished !== theirsFinished) chosen = theirsFinished ? theirs : mine;
  else if (mineFinished && theirsFinished) {
    if ((theirs.finished_on as string) < (mine.finished_on as string)) chosen = theirs;
    else chosen = mine;
  } else {
    chosen = theirs.card > mine.card ? theirs : mine;
  }
  const stars = Math.max(mine.stars || 0, theirs.stars || 0);
  return stars > 0 ? { ...chosen, stars } : { ...chosen };
}

function mergePtpSet(mine: SaveState['ptpSet'], theirs: SaveState['ptpSet']): SaveState['ptpSet'] {
  if (!mine) {
    return theirs ? { ...theirs, rounds: [...theirs.rounds] } : null;
  }
  if (!theirs) return { ...mine, rounds: [...mine.rounds] };
  if (mine.id === theirs.id) {
    return {
      ...mine,
      rounds: [...mine.rounds],
      r: Math.max(mine.r, theirs.r),
      done: !!mine.done || !!theirs.done,
    };
  }
  if (mine.id > theirs.id) return { ...mine, rounds: [...mine.rounds] };
  return { ...theirs, rounds: [...theirs.rounds] };
}

function unionNumbers(mine: number[] = [], theirs: number[] = []): number[] {
  const values = new Set<number>();
  for (const value of mine) values.add(value);
  for (const value of theirs) values.add(value);
  return Array.from(values).sort((a, b) => a - b);
}

function unionStrings(mine: string[] = [], theirs: string[] = []): string[] {
  const values = new Set<string>();
  for (const value of mine) values.add(value);
  for (const value of theirs) values.add(value);
  return Array.from(values);
}

function mergeFirstPlayDay(mine: number | null, theirs: number | null): number | null {
  if (mine === null) return theirs;
  if (theirs === null) return mine;
  return Math.min(mine, theirs);
}

function mergeMissLineQueue(mine: SaveState, theirs: SaveState): SaveState['missLineQueue'] {
  if (mine.missLineQueue) {
    return { floyd: [...mine.missLineQueue.floyd], bud: [...mine.missLineQueue.bud] };
  }
  if (theirs.missLineQueue) {
    return { floyd: [...theirs.missLineQueue.floyd], bud: [...theirs.missLineQueue.bud] };
  }
  return undefined;
}

export function mergeStates(mine: SaveState, theirs: SaveState & { savedAt?: number }): SaveState {
  const rounds: Record<string, RoundRecord> = { ...mine.rounds };
  for (const key of Object.keys(theirs.rounds)) {
    const incoming = theirs.rounds[key];
    rounds[key] = rounds[key] ? chooseRound(rounds[key], incoming) : incoming;
  }

  const review: Record<string, string[]> = { ...mine.review };
  const reviewSeen: Record<string, string> = { ...mine.reviewSeen };
  for (const key of Object.keys(theirs.review)) {
    const incoming = theirs.review[key];
    const current = review[key];
    const theirsSeen = theirs.reviewSeen[key] ?? '';
    const mineSeen = mine.reviewSeen[key] ?? '';
    if (!current || (!sameArray(current, incoming) && theirsSeen > mineSeen)) review[key] = [...incoming];
  }
  for (const key of Object.keys(theirs.reviewSeen)) {
    if (!reviewSeen[key] || theirs.reviewSeen[key] > reviewSeen[key]) {
      reviewSeen[key] = theirs.reviewSeen[key];
    }
  }

  const lessons: Record<string, LessonRecord> = { ...mine.lessons };
  for (const key of Object.keys(theirs.lessons)) {
    lessons[key] = lessons[key] ? chooseLesson(lessons[key], theirs.lessons[key]) : theirs.lessons[key];
  }

  // v2.1 lesson sessions: keep every word and the later completion date.
  const wordLessons: Record<string, string> = { ...(mine.wordLessons || {}) };
  for (const key of Object.keys(theirs.wordLessons || {})) {
    const incoming = theirs.wordLessons![key];
    if (!wordLessons[key] || incoming > wordLessons[key]) wordLessons[key] = incoming;
  }

  const badges = { ...mine.badges };
  for (const key of Object.keys(theirs.badges) as Array<keyof SaveState['badges']>) {
    const incoming = theirs.badges[key];
    if (!badges[key] || (incoming !== undefined && incoming < badges[key]!)) badges[key] = incoming;
  }

  const ptpSet = mergePtpSet(mine.ptpSet, theirs.ptpSet);
  const countedDays = unionNumbers(mine.countedDays, theirs.countedDays);
  const finishedDays = unionNumbers(mine.finishedDays, theirs.finishedDays);
  const soloDone = unionStrings(mine.soloDone, theirs.soloDone);
  const lastFinished: Record<string, string> = { ...(mine.lastFinished || {}) };
  for (const key of Object.keys(theirs.lastFinished || {})) {
    if (!lastFinished[key] || theirs.lastFinished![key] > lastFinished[key]) {
      lastFinished[key] = theirs.lastFinished![key];
    }
  }

  const merged: SaveState = {
    v: 1,
    rounds,
    ptpSet,
    ptpTotal: Math.max(mine.ptpTotal, theirs.ptpTotal),
    ptpBest: Math.max(mine.ptpBest, theirs.ptpBest),
    firstPlayDay: mergeFirstPlayDay(mine.firstPlayDay, theirs.firstPlayDay),
    review,
    reviewSeen,
    lessons,
    wordLessons: Object.keys(wordLessons).length > 0 ? wordLessons : undefined,
    badges,
    missLineIndex: {
      floyd: Math.max(mine.missLineIndex.floyd, theirs.missLineIndex.floyd),
      bud: Math.max(mine.missLineIndex.bud, theirs.missLineIndex.bud),
    },
    settings: typeof theirs.savedAt === 'number' && theirs.savedAt > lastLocalSaveAt
      ? { ...theirs.settings }
      : { ...mine.settings },
    flags: {
      firstRoundDone: mine.flags.firstRoundDone || theirs.flags.firstRoundDone,
      textSizeAsked: mine.flags.textSizeAsked || theirs.flags.textSizeAsked,
      inAppNoteHidden: mine.flags.inAppNoteHidden || theirs.flags.inAppNoteHidden,
      persistAsked: mine.flags.persistAsked || theirs.flags.persistAsked,
    },
    countedDays,
    finishedDays,
    soloDone,
    lastFinished,
    // The miss queue is a per-phone shuffle queue, so keep mine.
    missLineQueue: mergeMissLineQueue(mine, theirs),
  };
  // XP and scores only go up, so the bigger number from either tab is the right one.
  // Desktop rail (v2.1): keep the later Endless day. YYYY-MM-DD strings sort like dates.
  const endlessLastDay = mine.endlessLastDay && theirs.endlessLastDay
    ? (mine.endlessLastDay > theirs.endlessLastDay ? mine.endlessLastDay : theirs.endlessLastDay)
    : (mine.endlessLastDay || theirs.endlessLastDay);
  return addScores(merged, biggest(mine.xp, theirs.xp), biggest(mine.endlessBest, theirs.endlessBest), biggest(mine.endlessGames, theirs.endlessGames), endlessLastDay);
}

function biggest(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

export function watchOtherTabs(
  key: StorageKey,
  onChange: (incoming: SaveState & { savedAt?: number }) => void,
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== key || event.newValue === null) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      const savedAt = asObject(parsed).savedAt;
      const state = validState(parsed);
      if (state) {
        onChange(typeof savedAt === 'number' ? { ...state, savedAt } : state);
      }
    } catch {
      // Ignore malformed updates from another tab.
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function onWake(callback: () => void): () => void {
  const visibility = () => {
    if (document.visibilityState === 'visible') callback();
  };
  const show = (event: PageTransitionEvent) => {
    if (event.persisted) callback();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pageshow', show);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pageshow', show);
  };
}
