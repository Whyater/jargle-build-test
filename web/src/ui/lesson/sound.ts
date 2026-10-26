import { feedback } from '../components/feedback';
import { playLessonComplete, playSound } from '../../platform/audio';

// Lesson sounds go through one place so every step sounds the same.
export type LessonSoundKind = 'tap' | 'correct' | 'wrong' | 'complete';

export function lessonSound(kind: LessonSoundKind): void {
  if (kind === 'complete') {
    playLessonComplete();
    return;
  }
  feedback(kind);
}

/** Every finished lesson gets its chord. A new badge adds the stamp thump on top. */
export function playLessonSounds(newBadgeCount: number): void {
  playLessonComplete();
  if (newBadgeCount > 0) playSound('stamp');
}
