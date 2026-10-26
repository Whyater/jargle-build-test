import type {
  BadgeId,
  ContentBundle,
  LocalDate,
  RoundMode,
  RoundRecord,
  SaveState,
  TermItem,
} from './types';
import type { CardView, RoundAction, RoundResult, RoundView } from './api';
import { addDays, dateOfDay, dayNumber } from './dates';
import { awardBadges } from './badges';
import {
  addSortedNumber,
  addUnique,
  copyState,
  dayFromKey,
  isEnded,
  ptpKey,
  scheduleEntry,
} from './state';
import { plural, seededShuffle } from './text';
import { pickMissLine } from './missLines';
import { isInGrace, roundCounts } from './counting';
import { xpFor } from './xp';

function barsLeft(record: RoundRecord): number {
  const clueCost = Math.min(record.k, 4) - 1;
  return Math.max(0, 6 - clueCost - 3 * record.spent.length);
}

function itemFor(content: ContentBundle, record: RoundRecord): TermItem {
  return content.items[record.item_id];
}

function freshRecord(
  itemId: string,
  mode: RoundMode,
  today: LocalDate,
  replay: boolean = false,
): RoundRecord {
  return {
    item_id: itemId,
    mode: mode,
    started_on: today,
    k: 1,
    spent: [],
    selected: null,
    status: 'playing',
    post_step: 0,
    miss_line: null,
    replay: replay,
  };
}

export function startRound(
  state: SaveState,
  _content: ContentBundle,
  key: string,
  itemId: string,
  mode: RoundMode,
  today: LocalDate,
): SaveState {
  if (state.rounds[key]) return state;
  const s = copyState(state);
  s.rounds[key] = freshRecord(itemId, mode, today);
  if (s.firstPlayDay === null) s.firstPlayDay = dayNumber(today);
  return s;
}

export function replayRound(
  state: SaveState,
  _content: ContentBundle,
  key: string,
  today: LocalDate,
): SaveState {
  const oldRecord = state.rounds[key];
  if (!oldRecord || !isEnded(oldRecord) || key.indexOf('ptp:') === 0) return state;
  const s = copyState(state);
  s.rounds[key] = freshRecord(oldRecord.item_id, oldRecord.mode, today, true);
  return s;
}

function titleFor(
  state: SaveState,
  key: string,
  record: RoundRecord,
  today: LocalDate,
): string {
  if (record.mode === 'oldtech') return 'Old tech';
  if (record.mode === 'ptp') return 'Pass the Phone';
  const day = dayFromKey(key);
  if (day === null) return 'Practice word';
  const todayNumber = dayNumber(today);
  if (day === todayNumber) return "Today's word";
  if (record.status === 'playing' && day === todayNumber - 1 && isInGrace(state, day, today)) {
    return "Yesterday's word";
  }
  if (isEnded(record) && record.counted_day === day && record.finished_on !== dateOfDay(day)) {
    return "Yesterday's word";
  }
  return 'Practice word';
}

function justForFunLine(
  state: SaveState,
  key: string,
  record: RoundRecord,
  today: LocalDate,
): string | null {
  if (record.mode === 'oldtech' || record.mode === 'ptp') {
    return "Just for fun: this doesn't change your streak or Days learned.";
  }
  const day = dayFromKey(key);
  if (day === null) return null;
  if (record.counted_day === day) return null;
  if (day === dayNumber(today)) return null;
  if (!isEnded(record) && isInGrace(state, day, today)) return null;
  return "Just for fun: this doesn't change your streak or Days learned.";
}

function cardMeaning(item: TermItem, term: string): string | undefined {
  if (term === item.term) return item.meaning;
  for (let i = 0; i < item.decoys.length; i++) {
    if (item.decoys[i].term === term) return item.decoys[i].meaning;
  }
  return undefined;
}

function cardViews(item: TermItem, record: RoundRecord): CardView[] {
  const terms = seededShuffle(
    [item.term, item.decoys[0].term, item.decoys[1].term, item.decoys[2].term],
    item.id,
  );
  const live: string[] = [];
  const missed: string[] = [];
  for (let i = 0; i < terms.length; i++) {
    if (record.spent.indexOf(terms[i]) === -1) live.push(terms[i]);
  }
  for (let i = 0; i < record.spent.length; i++) {
    if (terms.indexOf(record.spent[i]) !== -1) missed.push(record.spent[i]);
  }
  const ordered = live.concat(missed);
  const cards: CardView[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const term = ordered[i];
    const isMissed = record.spent.indexOf(term) !== -1;
    const isAnswer = term === item.term;
    let state: CardView['state'] = 'live';
    if (isMissed) state = 'missed';
    else if (isAnswer && isEnded(record)) state = 'answer';
    cards.push({
      term: term,
      state: state,
      selected: record.selected === term,
      meaning: isMissed || (isAnswer && isEnded(record)) ? cardMeaning(item, term) : undefined,
    });
  }
  return cards;
}

function batteryLine(record: RoundRecord, bars: number): string {
  if (isEnded(record)) return plural(bars, 'bar', 'bars') + ' left.';
  if (record.k === 4) {
    return plural(bars, 'bar', 'bars') + ' left. The last clue is free. A wrong guess costs 3.';
  }
  if (record.k === 5) {
    return plural(bars, 'bar', 'bars') + ' left. A wrong guess costs 3.';
  }
  return plural(bars, 'bar', 'bars') + ' left. An extra clue costs 1. A wrong guess costs 3.';
}

function nextClueState(record: RoundRecord): { enabled: boolean; label: string; reason?: string } {
  const label = record.k === 4 ? 'Last clue (free)' : 'Next clue (costs 1 bar)';
  if (isEnded(record)) return { enabled: false, label: label };
  if (record.k >= 5) return { enabled: false, label: label, reason: 'No more clues' };
  const nextRecord: RoundRecord = { ...record, k: record.k + 1 };
  if (barsLeft(nextRecord) <= 0) {
    return { enabled: false, label: label, reason: 'Last bar: pick a word' };
  }
  return { enabled: true, label: label };
}

function resultLine(item: TermItem, record: RoundRecord): string | null {
  if (!isEnded(record)) return null;
  if (record.status === 'solved') {
    return 'You learned ' + item.term + '. Solved with '
      + plural(record.end_bars || 0, 'bar', 'bars') + ' left.';
  }
  return 'Learned it: ' + item.term + '.';
}

export function shareLines(
  state: SaveState,
  content: ContentBundle,
  key: string,
  demo: boolean,
): string {
  const record = state.rounds[key];
  if (!record || !isEnded(record)) return '';
  const day = dayFromKey(key);
  if (day === null || record.counted_day !== day) return '';
  const number = demo ? 'demo' : String(day);
  let first: string;
  if (record.status === 'solved') {
    first = 'Jargle ' + (demo ? 'demo' : '#' + number) + ': '
      + plural(record.end_bars || 0, 'bar', 'bars') + ' left';
  } else {
    first = 'Jargle ' + (demo ? 'demo' : '#' + number) + ': learned it ('
      + plural(record.k, 'clue', 'clues') + ')';
  }
  if (day !== null) {
    const entry = scheduleEntry(content, day);
    if (entry && entry.rerun) first += ' (Rerun)';
  }
  if (record.status === 'solved') {
    const misses = record.spent.length === 0
      ? 'no misses'
      : plural(record.spent.length, 'miss', 'misses');
    return first + '\n' + plural(record.k, 'clue', 'clues') + ', ' + misses;
  }
  return first;
}

export function shareText(
  state: SaveState,
  content: ContentBundle,
  key: string,
  opts: { appUrl: string; demo: boolean },
): string {
  const lines = shareLines(state, content, key, opts.demo);
  if (!lines) return '';
  return lines + '\nA daily tech word game. Try today\'s:\n' + opts.appUrl;
}

function finishRound(
  state: SaveState,
  content: ContentBundle,
  key: string,
  today: LocalDate,
): BadgeId[] {
  const record = state.rounds[key];
  if (record.finished_on) return [];
  const item = itemFor(content, record);
  record.finished_on = today;
  // Freeze the battery so later views do not change the result.
  record.end_bars = barsLeft(record);
  const day = dayFromKey(key);
  const jargle = day === null || !state.jargle ? undefined : state.jargle[String(day)];
  const alreadyCounted = day !== null && (state.countedDays || []).indexOf(day) !== -1;
  const bonusRound = record.mode === 'daily' && day !== null
    && ((jargle && jargle.status !== 'playing') || alreadyCounted);
  // A replay earns XP at the practice rate, so a daily only pays the daily rate once.
  state.xp = (state.xp || 0) + xpFor({
    type: 'round',
    mode: record.replay || bonusRound ? 'practice' : record.mode,
    status: record.status as 'solved' | 'learned',
    bars: record.end_bars || 0,
  });
  state.flags.firstRoundDone = true;
  if (!state.lastFinished) state.lastFinished = {};
  state.lastFinished[item.id] = today;

  if (day !== null) {
    addSortedNumber(state.finishedDays || (state.finishedDays = []), day);
    addUnique(state.soloDone || (state.soloDone = []), item.id);
    if (roundCounts(state, key, today)) {
      addSortedNumber(state.countedDays || (state.countedDays = []), day);
      record.counted_day = day;
    }
    if (!state.review[item.id]) {
      const due = [addDays(today, 1), addDays(today, 3), addDays(today, 7)];
      if (record.status === 'learned' || (record.end_bars || 0) <= 2) due.push(addDays(today, 2));
      due.sort();
      state.review[item.id] = due;
    }
  } else if (record.mode === 'oldtech') {
    addUnique(state.soloDone || (state.soloDone = []), item.id);
  }

  if (key.indexOf('ptp:') === 0 && state.ptpSet && key === ptpKey(state.ptpSet.id, 4)) {
    state.ptpSet.done = true;
    state.ptpTotal += 4;
    let best = 0;
    for (let i = 1; i <= 4; i++) {
      const round = state.rounds[ptpKey(state.ptpSet.id, i)];
      if (round && round.status === 'solved' && (round.end_bars || 0) >= 3) best++;
    }
    if (best > state.ptpBest) state.ptpBest = best;
  }
  return awardBadges(state, content, today);
}

export function roundView(
  state: SaveState,
  content: ContentBundle,
  key: string,
  today: LocalDate,
): RoundView {
  const record = state.rounds[key];
  const item = itemFor(content, record);
  const bars = barsLeft(record);
  const ended = isEnded(record);
  const nextClue = nextClueState(record);
  const canShowAnswer = !ended && (record.k >= 3 || record.spent.length > 0);
  const warning = !ended && bars <= 3
    ? 'Careful: a wrong guess now ends the round. It still counts.'
    : null;
  const result = resultLine(item, record);
  const resultNote = ended && record.status === 'learned' && bars === 0
    ? "That's a hard one. Here's what it means."
    : null;
  return {
    key: key,
    item: item,
    mode: record.mode,
    record: record,
    title: titleFor(state, key, record, today),
    bars: bars,
    batteryLine: batteryLine(record, bars),
    clues: item.clues.slice(0, record.k),
    cards: cardViews(item, record),
    nextClue: nextClue,
    canShowAnswer: canShowAnswer,
    warning: warning,
    ended: ended,
    resultLine: result,
    resultNote: resultNote,
    justForFun: justForFunLine(state, key, record, today),
    firstRoundHint: !state.flags.firstRoundDone && !ended
      ? 'Tap Next clue if you\'re not sure. More bars left is better.'
      : null,
    firstRound: !state.flags.firstRoundDone,
    missLine: record.miss_line,
    missSpeaker: record.miss_speaker || null,
    budMood: record.status === 'solved'
      ? 'happy'
      : record.status === 'learned' || !!record.miss_line ? 'sympathetic' : 'idle',
  };
}

function result(
  state: SaveState,
  message: string | null,
  outcome: RoundResult['outcome'],
  newBadges: BadgeId[] = [],
  xpGained: number = 0,
): RoundResult {
  return { state: state, message: message, outcome: outcome, newBadges: newBadges, xpGained: xpGained };
}

function doSelect(
  state: SaveState,
  record: RoundRecord,
  item: TermItem,
  term: string,
): RoundResult {
  const terms = [item.term, item.decoys[0].term, item.decoys[1].term, item.decoys[2].term];
  if (record.spent.indexOf(term) !== -1 || terms.indexOf(term) === -1) {
    return result(state, null, 'none');
  }
  record.selected = term;
  return result(state, 'Selected. Now tap Check.', 'selected');
}

function doCheck(
  state: SaveState,
  content: ContentBundle,
  key: string,
  today: LocalDate,
): RoundResult {
  const record = state.rounds[key];
  const item = itemFor(content, record);
  if (!record.selected) return result(state, 'Tap a word first.', 'none');
  const selected = record.selected;
  record.selected = null;
  if (selected === item.term) {
    record.status = 'solved';
    const badges = finishRound(state, content, key, today);
    return result(state, resultLine(item, record), 'solved', badges);
  }

  record.spent.push(selected);
  record.miss_k = record.k;
  if (barsLeft(record) === 0) {
    record.status = 'learned';
    const badges = finishRound(state, content, key, today);
    return result(
      state,
      'Learned it: ' + item.term + ". That's a hard one. Here's what it means.",
      'learned',
      badges,
    );
  }

  const nextRecord: RoundRecord = { ...record, k: record.k + 1 };
  const line = pickMissLine(state, content, item.id, barsLeft(nextRecord) > 0 && record.k < 5);
  if (line) {
    record.miss_line = line.text;
    record.miss_speaker = line.speaker;
  }
  return result(
    state,
    line ? line.text : 'Careful: a wrong guess now ends the round. It still counts.',
    'wrong',
  );
}

function doNextClue(
  state: SaveState,
  content: ContentBundle,
  key: string,
  today: LocalDate,
): RoundResult {
  const record = state.rounds[key];
  const view = roundView(state, content, key, today);
  if (!view.nextClue.enabled) return result(state, view.nextClue.reason || null, 'none');
  record.k++;
  let message = 'Clue ' + record.k + ' shown. ' + plural(barsLeft(record), 'bar', 'bars') + ' left.';
  if (record.miss_k === record.k - 1 && record.spent.length > 0) {
    message += " After a wrong guess, you can't reach the last clue.";
  }
  if (barsLeft(record) <= 3) {
    message += ' Careful: a wrong guess now ends the round. It still counts.';
  }
  return result(state, message, 'none');
}

function doShowAnswer(
  state: SaveState,
  content: ContentBundle,
  key: string,
  today: LocalDate,
): RoundResult {
  const record = state.rounds[key];
  const view = roundView(state, content, key, today);
  if (!view.canShowAnswer) return result(state, null, 'none');
  const item = itemFor(content, record);
  record.status = 'learned';
  const badges = finishRound(state, content, key, today);
  return result(state, 'Learned it: ' + item.term + '.', 'learned', badges);
}

function applyAction(
  s: SaveState,
  content: ContentBundle,
  key: string,
  action: RoundAction,
  today: LocalDate,
): RoundResult {
  const record = s.rounds[key];
  if (!record) return result(s, null, 'none');
  if (action.type === 'postStep') {
    record.post_step = action.step;
    return result(s, null, 'none');
  }
  record.miss_line = null;
  record.miss_speaker = undefined;
  if (record.status !== 'playing') return result(s, null, 'none');
  const item = itemFor(content, record);
  if (action.type === 'select') return doSelect(s, record, item, action.term);
  if (action.type === 'check') return doCheck(s, content, key, today);
  if (action.type === 'nextClue') return doNextClue(s, content, key, today);
  return doShowAnswer(s, content, key, today);
}

export function applyRound(
  state: SaveState,
  content: ContentBundle,
  key: string,
  action: RoundAction,
  today: LocalDate,
): RoundResult {
  const s = copyState(state);
  const xpBefore = s.xp || 0;
  const roundResult = applyAction(s, content, key, action, today);
  // XP only changes when a round ends.
  roundResult.xpGained = Math.max(0, (roundResult.state.xp || 0) - xpBefore);
  return roundResult;
}
