import { engine } from '../engine';
import { setAppForDev } from '../store';
import { devContent, devSave } from './content';
import type { ListEntry, BadgeView, PtpSummary, ReviewQuestion, LessonStatus } from '../../engine/api';
import type { SaveState } from '../../engine/types';
import { WEEK_ONE_NOTE } from '../../engine/api';

export interface GalleryEntry {
  name: string;
  route: string;
  param?: string;
  setup: () => void;
}
const base = (): SaveState => ({ ...devSave, rounds: {}, lessons: {}, badges: {} });
const list = (old = false): ListEntry[] =>
  old
    ? [
        {
          itemId: 'rotary-phone',
          key: 'rotary-phone',
          label: 'Rotary phone',
          date: '2026-10-30',
          finished: true,
          open: true,
          lockLine: null,
        },
        {
          itemId: 'cassette-tape',
          key: 'cassette-tape',
          label: 'Cassette tape',
          finished: false,
          open: false,
          lockLine: 'Opens Thursday, Nov 5.',
        },
      ]
    : [
        {
          itemId: 'claude',
          key: 'd:12',
          label: 'Claude',
          date: '2026-10-30',
          finished: true,
          open: true,
          lockLine: null,
        },
        {
          itemId: 'claude',
          key: 'd:11',
          label: 'Not finished yet',
          date: '2026-10-29',
          finished: false,
          open: true,
          lockLine: null,
        },
      ];
function setup(extra: () => void) {
  return () => {
    setAppForDev({
      status: 'ready',
      content: devContent,
      save: base(),
      today: '2026-11-06',
      demo: null,
      canSave: true,
    });
    extra();
  };
}
function ptpSetup(r: number, ended: boolean) {
  return () => {
    const save = base();
    save.ptpSet = { id: 1, rounds: ['claude', 'rotary-phone', 'claude', 'cassette-tape'], r };
    if (ended) {
      save.rounds['ptp:1:4'] = {
        item_id: 'cassette-tape',
        mode: 'ptp',
        started_on: '2026-11-06',
        k: 2,
        spent: [],
        selected: null,
        status: 'solved',
        post_step: 0,
        miss_line: null,
        replay: false,
        end_bars: 5,
      };
    }
    setAppForDev({ status: 'ready', content: devContent, save, today: '2026-11-06', demo: null, canSave: true });
    engine.ptpSummary = () => summary;
    engine.badgeViews = () => badges;
  };
}
function lessonSetup(record: { card: number; answers: string[]; finished_on: string | null }) {
  return () => {
    const save = base();
    save.lessons['turn-on-two-factor-login'] = record;
    setAppForDev({
      status: 'ready',
      content: devContent,
      save,
      today: '2026-11-06',
      demo: null,
      canSave: true,
    });
  };
}
const emptyReview: ReviewQuestion[] = [];
const review: ReviewQuestion[] = [
  {
    itemId: 'claude',
    prompt: 'Which one means: A chatbot made by Anthropic that can talk through tasks.?',
    options: [
      { term: 'Claude', meaning: 'A chatbot made by Anthropic that can talk through tasks.' },
      { term: 'Gemini', meaning: "Google's AI assistant." },
      { term: 'Copilot', meaning: 'Microsoft AI assistant.' },
    ],
    answer: 'Claude',
  },
];
const statuses: LessonStatus[] = [{ lesson: devContent.lessons[0], open: true, done: false, lockLine: null }];
const badges: BadgeView[] = [
  {
    id: 'first-word',
    name: 'First Word',
    earned: '2026-10-26',
    condition: 'Finish a daily word.',
    progress: null,
    note: null,
  },
  {
    id: 'first-lesson',
    name: 'First Lesson',
    earned: '2026-10-29',
    condition: 'Finish a lesson.',
    progress: null,
    note: null,
  },
  {
    id: 'taught-someone',
    name: 'Taught Someone',
    earned: '2026-10-30',
    condition: 'Finish all 4 Pass the Phone rounds.',
    progress: null,
    note: null,
  },
  {
    id: 'week-one',
    name: 'Week One',
    earned: null,
    condition: 'Learn for 7 days.',
    progress: { have: 3, need: 7 },
    note: WEEK_ONE_NOTE,
  },
  {
    id: 'days-30',
    name: '30 Days Learned',
    earned: null,
    condition: 'Learn for 30 days.',
    progress: { have: 8, need: 30 },
    note: null,
  },
  {
    id: 'days-60',
    name: '60 Days Learned',
    earned: null,
    condition: 'Learn for 60 days.',
    progress: { have: 8, need: 60 },
    note: null,
  },
  {
    id: 'floyds-student',
    name: "Floyd's Student",
    earned: null,
    condition: 'Play 5 Old Tech words.',
    progress: { have: 1, need: 5 },
    note: null,
  },
];const summary: PtpSummary = {
  rounds: [{ itemId: 'claude', term: 'Claude', solved: true, bars: 4 }],
  total: 4,
  best: 2,
};

export const listsGallery: GalleryEntry[] = [
  {
    name: 'Review mid-session',
    route: 'review',
    setup: setup(() => {
      engine.reviewSession = () => review;
    }),
  },
  {
    name: 'Review end',
    route: 'review',
    setup: setup(() => {
      engine.reviewSession = () => emptyReview;
    }),
  },
  {
    name: 'Review empty',
    route: 'review',
    setup: setup(() => {
      engine.reviewSession = () => emptyReview;
    }),
  },
  {
    name: 'Learn list',
    route: 'learn',
    setup: setup(() => {
      engine.lessonStatuses = () => statuses;
      engine.practiceList = () => list();
    }),
  },
  {
    name: 'Lesson card 1',
    route: 'lesson',
    param: 'turn-on-two-factor-login',
    setup: lessonSetup({ card: 1, answers: [], finished_on: null }),
  },
  {
    name: 'Lesson check answered wrong',
    route: 'lesson',
    param: 'turn-on-two-factor-login',
    setup: lessonSetup({ card: 3, answers: ['A shopping site you used once'], finished_on: null }),
  },
  {
    name: 'Lesson done',
    route: 'lesson',
    param: 'turn-on-two-factor-login',
    setup: lessonSetup({
      card: 3,
      answers: ['A second step', 'No one who contacts you first', 'Account settings'],
      finished_on: '2026-11-06',
    }),
  },
  {
    name: 'Practice list',
    route: 'practice',
    setup: setup(() => {
      engine.practiceList = () => list();
    }),
  },
  {
    name: 'Practice empty',
    route: 'practice',
    setup: setup(() => {
      engine.practiceList = () => [];
    }),
  },
  {
    name: 'Old tech list',
    route: 'oldtech',
    setup: setup(() => {
      engine.oldTechList = () => list(true);
    }),
  },
  { name: 'Ptp start', route: 'ptp', setup: setup(() => {}) },
  { name: 'Ptp round modern', route: 'ptp', setup: ptpSetup(1, false) },
  { name: 'Ptp round old tech', route: 'ptp', setup: ptpSetup(2, false) },
  {
    name: 'Ptp summary',
    route: 'ptp',
    setup: ptpSetup(4, true),
  },
  {
    name: 'Badges',
    route: 'badges',
    setup: setup(() => {
      engine.badgeViews = () => badges;
    }),
  },
];
