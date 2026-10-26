import type { ContentBundle, LocalDate, SaveState } from './types';
import {
  builtOldTech,
  copyState,
  isEnded,
  lastFinished,
  oldTechReleaseDay,
  ptpKey,
  scheduleEntry,
} from './state';
import { isInGrace } from './counting';
import { dayNumber } from './dates';

function chooseCandidate(ids: string[], state: SaveState, used: string[]): string | null {
  const finished = lastFinished(state);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (used.indexOf(id) !== -1) continue;
    if (!finished[id]) return id;
  }

  // If everything was played, use the word finished longest ago.
  let chosen: string | null = null;
  let chosenDate = '';
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (used.indexOf(id) !== -1 || !finished[id]) continue;
    if (chosen === null || finished[id] < chosenDate) {
      chosen = id;
      chosenDate = finished[id];
    }
  }
  return chosen;
}

function chooseExtra(content: ContentBundle, used: string[]): string | null {
  for (let i = 0; i < content.ptpExtras.length; i++) {
    const id = content.ptpExtras[i];
    if (used.indexOf(id) !== -1) continue;
    if (content.items[id]) return id;
  }
  return null;
}

function addRound(rounds: string[], used: string[], id: string | null): void {
  if (!id) return;
  rounds.push(id);
  used.push(id);
}

function chooseDailyOrExtra(
  dailyIds: string[],
  state: SaveState,
  content: ContentBundle,
  used: string[],
): string | null {
  const daily = chooseCandidate(dailyIds, state, used);
  if (daily) return daily;
  // Each empty daily slot gets the first extra that this set has not used.
  return chooseExtra(content, used);
}

export function dealPtpSet(state: SaveState, content: ContentBundle, today: LocalDate): string[] {
  const todayNumber = dayNumber(today);
  const dailyIds: string[] = [];
  for (let day = 1; day < todayNumber; day++) {
    const entry = scheduleEntry(content, day);
    if (!entry) continue;

    // A daily started yesterday is still in grace, so leave it for solo play.
    if (isInGrace(state, day, today)) continue;
    if (dailyIds.indexOf(entry.term) === -1) dailyIds.push(entry.term);
  }

  const oldIds: string[] = [];
  const oldItems = builtOldTech(content);
  for (let i = 0; i < oldItems.length; i++) {
    if (oldTechReleaseDay(oldItems[i]) <= todayNumber) oldIds.push(oldItems[i].id);
  }

  const rounds: string[] = [];
  const used: string[] = [];

  addRound(rounds, used, chooseDailyOrExtra(dailyIds, state, content, used));

  addRound(rounds, used, chooseCandidate(oldIds, state, used));

  addRound(rounds, used, chooseDailyOrExtra(dailyIds, state, content, used));

  addRound(rounds, used, chooseCandidate(oldIds, state, used));
  return rounds;
}

export function startPtpSet(state: SaveState, content: ContentBundle, today: LocalDate): SaveState {
  const s = copyState(state);
  if (s.ptpSet && !s.ptpSet.done) {
    let ended = 0;
    for (let r = 1; r <= s.ptpSet.rounds.length; r++) {
      if (isEnded(s.rounds[ptpKey(s.ptpSet.id, r)])) ended++;
    }
    s.ptpTotal += ended;
  }

  const id = s.ptpSet ? s.ptpSet.id + 1 : 1;
  s.ptpSet = {
    id: id,
    rounds: dealPtpSet(s, content, today),
    r: 1,
    done: false,
  };
  return s;
}

export function advancePtp(state: SaveState): SaveState {
  const s = copyState(state);
  if (s.ptpSet && !s.ptpSet.done && s.ptpSet.r < s.ptpSet.rounds.length) {
    s.ptpSet.r += 1;
  }
  return s;
}

export function ptpRoundItem(state: SaveState, round: number): string | null {
  if (!state.ptpSet || round < 1 || round > state.ptpSet.rounds.length) return null;
  return state.ptpSet.rounds[round - 1] || null;
}

export function ptpSummary(
  state: SaveState,
  content: ContentBundle,
): {
  rounds: { itemId: string; term: string; solved: boolean; bars: number }[];
  total: number;
  best: number;
} {
  const rounds: { itemId: string; term: string; solved: boolean; bars: number }[] = [];
  if (state.ptpSet) {
    for (let i = 0; i < state.ptpSet.rounds.length; i++) {
      const itemId = state.ptpSet.rounds[i];
      const record = state.rounds[ptpKey(state.ptpSet.id, i + 1)];
      const item = content.items[itemId];
      rounds.push({
        itemId: itemId,
        term: item ? item.term : itemId,
        solved: !!record && record.status === 'solved',
        bars: record && record.end_bars ? record.end_bars : 0,
      });
    }
  }
  return { rounds: rounds, total: state.ptpTotal, best: state.ptpBest };
}

export function ptpRoundCardLines(round: number, oldTechRound: boolean): string[] {
  let roundKindLine: string;
  if (oldTechRound) {
    roundKindLine = 'Old tech round: the person who remembers older tech reads.';
  } else {
    roundKindLine = 'Modern word round: the person who uses newer tech reads.';
  }
  return [
    'Pass the Phone: two people, one phone.',
    "The reader reads each clue and word out loud and taps the other person's pick.",
    'Round ' + round + ' of 4.',
    "Just for fun: this doesn't change your streak or Days learned.",
    roundKindLine,
    'Not sure? Take turns.',
  ];
}

export function ptpTotalLine(n: number): string {
  return "Words you've played together on this phone: " + n;
}

export function ptpBestLine(m: number): string {
  return 'Best set so far: ' + m + ' of 4 solved with 3 or more bars left';
}
