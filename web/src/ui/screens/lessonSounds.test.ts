// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

const audio = vi.hoisted(() => ({
  playLessonComplete: vi.fn(),
  playSound: vi.fn(),
}));

vi.mock('../../platform/audio', () => audio);

import { playLessonSounds } from './Lesson';

describe('playLessonSounds', () => {
  it('plays the lesson complete chord with no new badges', () => {
    audio.playLessonComplete.mockClear();
    audio.playSound.mockClear();
    playLessonSounds(0);
    expect(audio.playLessonComplete).toHaveBeenCalledTimes(1);
    expect(audio.playSound).not.toHaveBeenCalled();
  });

  it('still plays the chord when a badge is earned, plus the stamp', () => {
    audio.playLessonComplete.mockClear();
    audio.playSound.mockClear();
    playLessonSounds(2);
    expect(audio.playLessonComplete).toHaveBeenCalledTimes(1);
    expect(audio.playSound).toHaveBeenCalledWith('stamp');
  });
});
