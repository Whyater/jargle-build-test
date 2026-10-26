// Test content. Uses the real item ids, with made-up clues, so tests don't
// depend on the content folder. The Claude item and the lesson are the
// worked examples from the game rules.

import { dateOfDay } from '../dates';
import type { ContentBundle, Difficulty, Lesson, TermItem, TopicId } from '../types';

export const REAL_SCHEDULE = [
  'two-factor-login',
  'wi-fi',
  'screenshot',
  'emoji',
  'claude',
  'deepfake',
  'the-cloud',
  'bluetooth',
  'zelle',
  'hashtag',
  'spam',
  'phishing',
  'qr-code',
  'password-manager',
];

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

export const OLD_TECH = ['rotary-phone', 'cassette-tape', 'dewey-decimal-system', 'floppy-disk', 'phone-book', 'fax-machine'];

/** Weeks count from launch day: day 1 of each week is 1, days 2 to 4 are 2, days 5 to 7 are 3. */
export function difficultyForDay(day: number): Difficulty {
  const weekday = (day - 1) % 7; // 0 = launch weekday (Sunday)
  if (weekday === 0) return 1;
  if (weekday <= 3) return 2;
  return 3;
}

function termName(id: string): string {
  return id.replace(/-/g, ' ');
}

export function makeItem(id: string, topic: TopicId, difficulty: Difficulty, oldTech: boolean): TermItem {
  const name = termName(id);
  return {
    id: id,
    kind: 'term',
    topic: topic,
    term: name,
    meaning: 'The meaning of ' + name + '.',
    clues: ['Clue 1 for ' + id, 'Clue 2 for ' + id, 'Clue 3 for ' + id, 'Clue 4 for ' + id, 'Clue 5 for ' + id],
    assumes: [],
    decoys: [
      { term: name + ' decoy a', meaning: 'Decoy a meaning.', source_urls: [] },
      { term: name + ' decoy b', meaning: 'Decoy b meaning.', source_urls: [] },
      { term: name + ' decoy c', meaning: 'Decoy c meaning.', source_urls: [] },
    ],
    exchange: [{ speaker: 'floyd', tone: 'neutral', text: 'A line.' }],
    old_tech: oldTech,
    sources: [],
    checked_on: null,
    difficulty: difficulty,
    decisive_clue: difficulty,
  };
}

export const CLAUDE_ITEM: TermItem = {
  id: 'claude',
  kind: 'term',
  topic: 'talking-computers',
  term: 'Claude',
  meaning:
    "An AI made by Anthropic. It's a chatbot, a computer program built to talk with people. Ask it questions or hand it tasks.",
  clues: [
    "It isn't a person, but it answers when you ask it something.",
    'You can hand it a task, not just a question.',
    "It's made by a company called Anthropic.",
    "It shares its name with a man's first name.",
    'Its name has six letters and starts with C.',
  ],
  assumes: ["Gemini is Google's", "Copilot is Microsoft's", "ChatGPT is OpenAI's"],
  decoys: [
    { term: 'Gemini', meaning: "Google's AI assistant. You can upload a long document and it sums it up for you.", source_urls: [] },
    { term: 'Copilot', meaning: "Microsoft's AI assistant. It can search the web and give short summaries with sources.", source_urls: [] },
    { term: 'ChatGPT', meaning: 'An AI from OpenAI. You chat with it to get answers and find ideas.', source_urls: [] },
  ],
  exchange: [{ speaker: 'bud', text: 'Try it with someone you trust.' }],
  old_tech: false,
  sources: [],
  checked_on: null,
  difficulty: 3,
  decisive_clue: 3,
};

export function makeLesson(id: string, topic: TopicId, number: number): Lesson {
  return {
    id: id,
    topic: topic,
    number: number,
    title: 'Lesson ' + id,
    cards: [
      { text: 'Card one.', mascot: 'floyd', line: 'Floyd line.' },
      { text: 'Card two.', mascot: 'bud', line: 'Bud line.' },
    ],
    checks: [
      { prompt: 'Question 1?', options: ['Right one', 'Wrong one', 'Other one'], answer: 'Right one', why: 'Why 1.' },
      { prompt: 'Question 2?', options: ['Right two', 'Wrong two', 'Other two'], answer: 'Right two', why: 'Why 2.' },
      { prompt: 'Question 3?', options: ['Right three', 'Wrong three', 'Other three'], answer: 'Right three', why: 'Why 3.' },
    ],
    takeaway: 'Takeaway.',
    sources: [],
    checked_on: null,
  };
}

const TOPICS: TopicId[] = [
  'locks-and-keys',
  'talking-computers',
  'scams-and-fakes',
  'your-phone',
  'internet-talk',
  'how-the-internet-works',
  'money-on-your-phone',
];

export interface FixtureOptions {
  /** Daily ids in schedule order, Day 1 first. Default: the real Days 1 to 14. */
  schedule?: string[];
  /** Total dailies; extra ones are named word-15, word-16 and so on. */
  days?: number;
  /** Total Old Tech items (6 to 20); extras are old-7, old-8 and so on. */
  oldTechCount?: number;
  /** Build all 28 lessons (4 per topic) instead of the 2 launch lessons. */
  allLessons?: boolean;
}

export function buildContent(options: FixtureOptions = {}): ContentBundle {
  const scheduleIds = (options.schedule || REAL_SCHEDULE).slice();
  const totalDays = options.days || scheduleIds.length;
  for (let day = scheduleIds.length + 1; day <= totalDays; day++) {
    scheduleIds.push('word-' + day);
  }

  const items: Record<string, TermItem> = {};
  const days = [];
  for (let i = 0; i < scheduleIds.length; i++) {
    const id = scheduleIds[i];
    const day = i + 1;
    if (!items[id]) {
      items[id] = id === 'claude' ? CLAUDE_ITEM : makeItem(id, TOPICS[i % TOPICS.length], difficultyForDay(day), false);
    }
    days.push({ date: dateOfDay(day), term: id, rerun: false });
  }

  const oldTech = OLD_TECH.slice();
  const oldTechCount = options.oldTechCount || 6;
  for (let n = oldTech.length + 1; n <= oldTechCount; n++) oldTech.push('old-' + n);
  for (let i = 0; i < oldTech.length; i++) {
    items[oldTech[i]] = makeItem(oldTech[i], 'old-tech', i % 2 === 0 ? 1 : 2, true);
  }

  items['ptp-1'] = makeItem('ptp-1', 'internet-talk', 1, false);
  items['ptp-2'] = makeItem('ptp-2', 'your-phone', 2, false);

  const lessons: Lesson[] = [makeLesson('make-a-strong-password', 'locks-and-keys', 1)];
  const worked = makeLesson('turn-on-two-factor-login', 'locks-and-keys', 2);
  worked.title = 'Turn on two-factor login';
  worked.takeaway = 'Start with your email and your bank.';
  lessons.push(worked);
  if (options.allLessons) {
    for (let t = 0; t < TOPICS.length; t++) {
      for (let n = 1; n <= 4; n++) {
        if (t === 0 && n <= 2) continue;
        lessons.push(makeLesson(TOPICS[t] + '-' + n, TOPICS[t], n));
      }
    }
  }

  return {
    version: 1,
    items: items,
    lessons: lessons,
    oldTech: oldTech,
    ptpExtras: ['ptp-1', 'ptp-2'],
    schedule: { version: 1, days: days },
    missLines: {
      either: [
        { text: 'Good guess. Another clue can narrow it down.', needs_clue: true },
        { text: "That one's tricky." },
        { text: 'Take your time. No clock here.' },
        { text: 'Every miss teaches you a word.' },
        { text: "New words take a few tries. That's normal." },
        { text: 'Cross that one off and keep going.' },
      ],
      floyd: [
        { text: 'I always say: read the label first.' },
        { text: "I've seen plenty of words come and go. You'll get this one." },
        { text: 'No rush. Patience is an old habit worth keeping.' },
        { text: 'In my experience, a clue is worth reading.', needs_clue: true },
      ],
    },
    commonWords: ['AI', 'account', 'app', 'bank', 'browser', 'chatbot', 'code', 'email', 'internet', 'link', 'online', 'password', 'phone', 'text', 'website'],
  };
}
