import type { RoundAction, RoundResult, RoundView } from '../../engine/api';
import type { RoundMode, RoundRecord, SaveState } from '../../engine/types';
import { engine } from '../engine';
import { setAppForDev } from '../store';
import { devContent, devSave } from './content';
import type { GalleryEntry } from './types';

type FixtureKind =
  | 'fresh'
  | 'selected'
  | 'wrong'
  | 'ending'
  | 'solved'
  | 'learned'
  | 'share'
  | 'done'
  | 'practice-done'
  | 'ptp';

function recordFor(kind: FixtureKind): RoundRecord {
  const ptp = kind === 'ptp';
  const ended =
    kind === 'ending' ||
    kind === 'solved' ||
    kind === 'learned' ||
    kind === 'share' ||
    kind === 'done' ||
    kind === 'practice-done';
  const mode: RoundMode = ptp ? 'ptp' : kind === 'practice-done' ? 'practice' : 'daily';
  const status = kind === 'solved' ? 'solved' : ended ? 'learned' : 'playing';
  return {
    item_id: 'claude',
    mode,
    started_on: '2026-11-06',
    k: kind === 'fresh' ? 1 : kind === 'ending' ? 4 : 3,
    spent: kind === 'wrong' || kind === 'ending' ? ['Gemini'] : [],
    selected: kind === 'selected' ? 'Claude' : null,
    status,
    post_step: kind === 'share' ? 1 : kind === 'done' || kind === 'practice-done' ? 2 : 0,
    miss_line: kind === 'wrong' || kind === 'ending' ? "That one's tricky." : null,
    miss_speaker: kind === 'wrong' || kind === 'ending' ? 'floyd' : undefined,
    replay: false,
    counted_day: mode === 'daily' ? 12 : undefined,
  };
}

function saveFor(key: string, kind: FixtureKind): SaveState {
  const save: SaveState = { ...devSave, rounds: { [key]: recordFor(kind) } };
  if (kind === 'ptp')
    save.ptpSet = { id: 1, rounds: ['claude', 'rotary-phone', 'cassette-tape', 'claude'], r: 1 };
  if (kind !== 'fresh') save.flags = { ...save.flags, firstRoundDone: true };
  return save;
}

function viewFor(key: string, kind: FixtureKind): RoundView {
  const record = recordFor(kind);
  const ended = record.status !== 'playing';
  const cards = [
    {
      term: 'Claude',
      state: ended ? ('answer' as const) : ('live' as const),
      meaning: ended ? devContent.items.claude.meaning : undefined,
      selected: kind === 'selected',
    },
    {
      term: 'Gemini',
      state: kind === 'wrong' || kind === 'ending' ? ('missed' as const) : ('live' as const),
      selected: false,
      meaning: kind === 'wrong' || kind === 'ending' ? "Google's AI assistant." : undefined,
    },
    {
      term: 'Copilot',
      state: 'live' as const,
      selected: false,
    },
    { term: 'ChatGPT', state: 'live' as const, selected: false },
  ];
  // Missed cards move to the end.
  if (kind === 'wrong' || kind === 'ending') cards.push(cards.splice(1, 1)[0]);
  return {
    key,
    item: devContent.items.claude,
    mode: record.mode,
    record,
    title:
      record.mode === 'ptp'
        ? 'Pass the Phone'
        : record.mode === 'practice'
          ? 'Practice word'
          : "Today's word",
    bars: kind === 'wrong' || kind === 'ending' ? 3 : 4,
    batteryLine: '4 bars left. An extra clue costs 1. A wrong guess costs 3.',
    clues: devContent.items.claude.clues.slice(0, record.k),
    cards,
    nextClue: { enabled: !ended, label: 'Next clue', reason: ended ? 'No more clues' : undefined },
    canShowAnswer: !ended && record.k >= 3,
    warning: kind === 'wrong' ? 'Careful: a wrong guess now ends the round. It still counts.' : null,
    ended,
    resultLine: ended
      ? record.status === 'solved'
        ? 'You learned Claude. Solved with 4 bars left.'
        : "Learned it: Claude. That's a hard one. Here's what it means."
      : null,
    resultNote: kind === 'ending' ? "That's a hard one. Here's what it means." : null,
    justForFun: kind === 'ptp' ? "Just for fun: this doesn't change your streak or Days learned." : null,
    firstRoundHint: kind === 'fresh' ? 'Tap Next clue if you\'re not sure. More bars left is better.' : null,
    firstRound: kind === 'fresh',
    missLine: kind === 'wrong' || kind === 'ending' ? "That one's tricky." : null,
    missSpeaker: kind === 'wrong' || kind === 'ending' ? 'floyd' : null,
    budMood: record.status === 'solved' ? 'happy' : record.status === 'learned' || kind === 'wrong' || kind === 'ending' ? 'sympathetic' : 'idle',
  };
}

function setup(key: string, kind: FixtureKind): void {
  const save = saveFor(key, kind);
  setAppForDev({
    status: 'ready',
    content: devContent,
    save,
    today: '2026-11-06',
    demo: null,
    canSave: true,
  });
  engine.roundView = () => viewFor(key, kind);
  engine.applyRound = (state, _content, _key, action: RoundAction): RoundResult => {
    const next = { ...state, rounds: { ...state.rounds } };
    const record = { ...next.rounds[key] };
    if (action.type === 'postStep') record.post_step = action.step;
    next.rounds[key] = record;
    return {
      state: next,
      message: action.type === 'select' ? 'Selected. Now tap Check.' : null,
      outcome: action.type === 'select' ? 'selected' : 'none',
      newBadges: [],
      xpGained: 0,
    };
  };
  engine.shareText = () => 'Jargle #12: 4 bars left';
  engine.homeView = () => ({
    phase: 'played',
    daysLearned: 1,
    streak: 1,
    gentleLine: null,
    today: null,
    grace: null,
    reviewDue: 0,
    todaysLesson: null,
    shareLine: null,
    ptpInProgress: false,
    streakLine: null,
    reviewLink: 'Review: nothing due today.',
  });
  engine.badgeViews = () => [];
  engine.nextWord = () => ({ message: "You've done them all." });
}

export const roundGallery: GalleryEntry[] = [
  { name: 'Fresh first round', route: 'play', param: 'd:12', setup: () => setup('d:12', 'fresh') },
  { name: 'Clue 3 with card selected', route: 'play', param: 'd:12', setup: () => setup('d:12', 'selected') },
  { name: 'Wrong guess at 3 bars', route: 'play', param: 'd:12', setup: () => setup('d:12', 'wrong') },
  { name: 'Round ending miss board', route: 'play', param: 'd:12', setup: () => setup('d:12', 'ending') },
  { name: 'Solved reveal', route: 'play', param: 'd:12', setup: () => setup('d:12', 'solved') },
  { name: 'Learned reveal', route: 'play', param: 'd:12', setup: () => setup('d:12', 'learned') },
  { name: 'Share step', route: 'play', param: 'd:12', setup: () => setup('d:12', 'share') },
  { name: 'Done card daily', route: 'play', param: 'd:12', setup: () => setup('d:12', 'done') },
  {
    name: 'Done card practice',
    route: 'play',
    param: 'claude',
    setup: () => setup('claude', 'practice-done'),
  },
  { name: 'Pass the Phone reader', route: 'play', param: 'ptp:1:1', setup: () => setup('ptp:1:1', 'ptp') },
];
