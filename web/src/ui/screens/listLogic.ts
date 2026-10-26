import type { PtpSummary } from '../../engine/api';
import type { TopicId } from '../../engine/types';

const names: Record<string, string> = {
  'locks-and-keys': 'Locks and Keys',
  'talking-computers': 'Talking Computers',
  'scams-and-fakes': 'Scams and Fakes',
  'your-phone': 'Your Phone',
  'internet-talk': 'Internet Talk',
  'how-the-internet-works': 'How the Internet Works',
  'money-on-your-phone': 'Money on Your Phone',
  'old-tech': 'Old Tech',
};
export function topicName(id: TopicId | string): string {
  return names[id] || id;
}
export function roundSummaryLine(round: PtpSummary['rounds'][number]): string {
  if (!round.solved) return 'Learned it';
  return 'Solved with ' + round.bars + (round.bars === 1 ? ' bar left' : ' bars left');
}
export function pluralText(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// How far each lesson node sits from the middle of the path, in px. The pattern repeats
// every 8 nodes, so the path winds right, back to the middle, left, and back again.
const PATH_SWAY = [0, 44, 64, 44, 0, -44, -64, -44];

/** Sideways offset of the lesson node at this position on the Learn path. */
export function pathOffset(index: number): number {
  return PATH_SWAY[index % PATH_SWAY.length];
}

/** The lesson to do next: the first open one that is not done, or -1 when there is none. */
export function currentLessonIndex(lessons: { open: boolean; done: boolean }[]): number {
  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].open && !lessons[i].done) return i;
  }
  return -1;
}
