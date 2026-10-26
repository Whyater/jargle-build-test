import type { HomeView } from '../../engine/api';
import type { SaveState } from '../../engine/types';
import { engine } from '../engine';
import { setAppForDev } from '../store';
import { devContent, devSave } from './content';
import type { GalleryEntry } from './types';

const today = '2026-11-06';
function saveWith(flags: Partial<SaveState['flags']> = {}): SaveState {
  return { ...devSave, flags: { ...devSave.flags, ...flags } };
}
function view(phase: HomeView['phase'], extra: Partial<HomeView> = {}): HomeView {
  const result = {
    phase,
    daysLearned: 0,
    streak: 0,
    gentleLine: null,
    today: { day: 12, key: 'd:12', started: false, finished: false },
    grace: null,
    reviewDue: 0,
    todaysLesson: null,
    shareLine: null,
    ptpInProgress: false,
    ...extra,
  };
  return {
    ...result,
    streakLine: result.streak >= 2 ? `Streak: ${result.streak} days played` : null,
    reviewLink: result.reviewDue === 0
      ? 'Review: nothing due today.'
      : `Review: ${result.reviewDue} ${result.reviewDue === 1 ? 'word' : 'words'} to practice`,
  };
}
function setup(save: SaveState, hv: HomeView = view('played'), demo: 'judge' | null = null): void {
  setAppForDev({ status: 'ready', content: devContent, save, today, demo, canSave: true });
  engine.homeView = () => hv;
  engine.dateOfDay = () => '2026-11-05';
  engine.startRound = (state, _content, _key, _itemId, _mode, _date) => state;
  engine.startPtpSet = (state, _content, _date) => state;
  engine.encodeProgressCode = () => 'JRG1-7K2M-Q9XA-4D0P-HR';
  engine.decodeProgressCode = () => ({ ok: false, error: 'format' });
}
export const homeGallery: GalleryEntry[] = [
  {
    name: 'Home prelaunch',
    route: 'home',
    setup: () => setup(saveWith(), view('prelaunch', { today: null })),
  },
  { name: 'Home first and text size', route: 'home', setup: () => setup(saveWith(), view('first')) },
  {
    name: 'Home not played, streak and gentle line',
    route: 'home',
    setup: () =>
      setup(
        saveWith({ textSizeAsked: true }),
        view('notPlayed', { daysLearned: 3, streak: 3, gentleLine: "Yesterday's word is in Practice. Play today's word to keep your streak." }),
      ),
  },
  {
    name: 'Home not played with grace',
    route: 'home',
    setup: () =>
      setup(
        saveWith({ textSizeAsked: true }),
        view('notPlayed', { daysLearned: 3, grace: { day: 11, key: 'd:11', started: false } }),
      ),
  },
  {
    name: 'Home played with share and lesson',
    route: 'home',
    setup: () =>
      setup(
        saveWith({ textSizeAsked: true }),
        view('played', {
          daysLearned: 4,
          streak: 4,
          shareLine: 'Jargle #12: 4 bars left',
          todaysLesson: null,
        }),
      ),
  },
  {
    name: 'Home no word',
    route: 'home',
    setup: () => setup(saveWith({ textSizeAsked: true }), view('noWord', { today: null, daysLearned: 4 })),
  },
  {
    name: 'Home judge demo',
    route: 'home',
    setup: () =>
      setup(
        saveWith({ textSizeAsked: true }),
        view('played', { daysLearned: 8, streak: 8, today: null }),
        'judge',
      ),
  },
  { name: 'Settings', route: 'settings', setup: () => setup(saveWith()) },
  { name: 'How to play', route: 'how', setup: () => setup(saveWith()) },
  { name: 'About', route: 'about', setup: () => setup(saveWith()) },
  { name: 'Get progress code', route: 'code', setup: () => setup(saveWith()) },
  { name: 'Use progress code', route: 'codeUse', setup: () => setup(saveWith()) },
  { name: 'Get Jargle', route: 'get', setup: () => setup(saveWith()) },
];
