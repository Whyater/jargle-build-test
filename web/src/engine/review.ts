import type { ContentBundle, LocalDate, SaveState } from './types';
import type { ReviewQuestion } from './api';
import { addDays } from './dates';
import { copyState } from './state';
import { seededShuffle, plural } from './text';

/** "A tool. It helps." becomes "A tool. It helps?" so the prompt never ends in ".?". */
function questionText(meaning: string): string {
  let text = meaning.trim();
  while (text.length > 0 && (text.charAt(text.length - 1) === '.' || text.charAt(text.length - 1) === '?')) {
    text = text.slice(0, -1);
  }
  return text + '?';
}

export function reviewDueCount(state: SaveState, today: LocalDate): number {
  let count = 0;
  for (const id in state.review) {
    const dates = state.review[id] || [];
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] <= today) {
        count++;
        break;
      }
    }
  }
  return count;
}

export function reviewSession(state: SaveState, content: ContentBundle, today: LocalDate): ReviewQuestion[] {
  const due: { id: string; date: string; order: number }[] = [];
  const keys = Object.keys(state.review);
  for (let order = 0; order < keys.length; order++) {
    const id = keys[order];
    if (state.reviewSeen[id] === today || !content.items[id]) {
      continue;
    }
    const dates = state.review[id] || [];
    let earliest: string | null = null;
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] <= today && (earliest === null || dates[i] < earliest)) {
        earliest = dates[i];
      }
    }
    if (earliest !== null) {
      due.push({ id: id, date: earliest, order: order });
    }
  }
  due.sort(function (a, b) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.order - b.order;
  });
  const result: ReviewQuestion[] = [];
  for (let i = 0; i < due.length && i < 5; i++) {
    const item = content.items[due[i].id];
    const decoys = seededShuffle(item.decoys.slice(), item.id + today).slice(0, 2);
    const options = [{ term: item.term, meaning: item.meaning }];
    for (let j = 0; j < decoys.length; j++) {
      options.push({ term: decoys[j].term, meaning: decoys[j].meaning });
    }
    result.push({
      itemId: item.id,
      prompt: 'Which one means: ' + questionText(item.meaning),
      options: seededShuffle(options, item.id + today),
      answer: item.term,
    });
  }
  return result;
}

export function answerReview(
  state: SaveState,
  itemId: string,
  correct: boolean,
  today: LocalDate,
): SaveState {
  const s = copyState(state);
  const old = s.review[itemId] || [];
  const keep: LocalDate[] = [];
  for (let i = 0; i < old.length; i++) {
    if (old[i] > today) keep.push(old[i]);
  }
  if (!correct) {
    const tomorrow = addDays(today, 1);
    if (keep.indexOf(tomorrow) === -1) {
      keep.push(tomorrow);
    }
  }
  keep.sort();
  s.review[itemId] = keep;
  s.reviewSeen[itemId] = today;
  return s;
}

export function reviewLinkText(n: number): string {
  if (n === 0) return 'Review: nothing due today.';
  return 'Review: ' + plural(n, 'word to practice', 'words to practice');
}

export function reviewDoneLine(n: number): string {
  return 'You reviewed ' + plural(n, 'word', 'words') + '.';
}
