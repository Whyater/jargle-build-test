import type { BadgeId, ContentBundle, Lesson, LocalDate, SaveState } from './types';
import type { LessonStatus as LessonStatusView } from './api';
import { addDays, dateOfDay, longDate } from './dates';
import { copyState } from './state';
import { seededShuffle } from './text';
import { TOPIC_ORDER } from './types';
import { awardBadges } from './badges';
import { xpFor } from './xp';

function orderedLessons(content: ContentBundle): Lesson[] {
  const result: Lesson[] = [];
  for (let t = 0; t < TOPIC_ORDER.length; t++) {
    const topic = TOPIC_ORDER[t];
    const found = content.lessons.filter(function (lesson) {
      return lesson.topic === topic;
    });
    found.sort(function (a, b) {
      return a.number - b.number;
    });
    for (let i = 0; i < found.length; i++) {
      result.push(found[i]);
    }
  }
  return result;
}

export function lessonStatuses(
  state: SaveState,
  content: ContentBundle,
  today: LocalDate,
): LessonStatusView[] {
  const result: LessonStatusView[] = [];
  const lessons = orderedLessons(content);
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const record = state.lessons[lesson.id];
    const done = !!(record && record.finished_on);
    let open = true;
    let lockLine: string | null = null;
    let releaseDay = lesson.number;
    if (lesson.release_day && lesson.release_day > 0) {
      releaseDay = lesson.release_day;
    }
    const release = dateOfDay(releaseDay);
    if (lesson.number > 1) {
      let previous: Lesson | null = null;
      for (let j = 0; j < lessons.length; j++) {
        if (lessons[j].topic === lesson.topic && lessons[j].number === lesson.number - 1) {
          previous = lessons[j];
          break;
        }
      }
      if (!previous) {
        open = false;
        lockLine = 'Finish the earlier lesson first.';
      } else {
        const prevRecord = state.lessons[previous.id];
        if (!prevRecord || !prevRecord.finished_on) {
          open = false;
          lockLine = 'Finish the earlier lesson first.';
        } else {
          const after = addDays(prevRecord.finished_on, 1);
          const opens = after > release ? after : release;
          if (today < opens && !done) {
            open = false;
            lockLine = 'Opens ' + longDate(opens) + '.';
          }
        }
      }
    } else if (today < release && !done) {
      open = false;
      lockLine = 'Opens ' + longDate(release) + '.';
    }
    if (done) {
      open = true;
      lockLine = null;
    }
    result.push({ lesson: lesson, open: open, done: done, lockLine: lockLine });
  }
  return result;
}

export function lessonOptions(lesson: Lesson, checkIndex: number): string[] {
  if (!lesson.checks[checkIndex]) return [];
  return seededShuffle(lesson.checks[checkIndex].options, lesson.id + ':' + checkIndex);
}

export function saveLessonProgress(
  state: SaveState,
  lessonId: string,
  patch: { card?: number; answer?: string },
): SaveState {
  const s = copyState(state);
  if (!s.lessons[lessonId]) {
    s.lessons[lessonId] = { card: 0, answers: [], finished_on: null };
  }
  if (patch.card !== undefined) {
    s.lessons[lessonId].card = patch.card;
  }
  if (patch.answer !== undefined) {
    s.lessons[lessonId].answers.push(patch.answer);
  }
  return s;
}

export function finishLesson(
  state: SaveState,
  content: ContentBundle,
  lessonId: string,
  today: LocalDate,
): { state: SaveState; newBadges: BadgeId[]; xpGained: number } {
  const s = copyState(state);
  if (!s.lessons[lessonId]) {
    s.lessons[lessonId] = { card: 0, answers: [], finished_on: null };
  }
  let xpGained = 0;
  if (!s.lessons[lessonId].finished_on) {
    s.lessons[lessonId].finished_on = today;
    xpGained = xpFor({ type: 'lesson' });
    s.xp = (s.xp || 0) + xpGained;
  }
  const newBadges = awardBadges(s, content, today);
  return { state: s, newBadges: newBadges, xpGained: xpGained };
}

export function todaysLesson(state: SaveState, content: ContentBundle, today: LocalDate): Lesson | null {
  for (const id in state.lessons) {
    if (state.lessons[id].finished_on === today) return null;
  }
  const statuses = lessonStatuses(state, content, today);
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].open && !statuses[i].done) {
      return statuses[i].lesson;
    }
  }
  return null;
}
