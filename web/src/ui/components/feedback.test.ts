import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getApp, audio } = vi.hoisted(() => ({
  audio: {
    playTap: vi.fn(),
    playCorrect: vi.fn(),
    playWrong: vi.fn(),
    playCombo: vi.fn(),
    playHeartLost: vi.fn(),
    playLevelUp: vi.fn(),
  },
  getApp: vi.fn(() => ({ save: { settings: { sound: true } } })),
}));

vi.mock('../../platform/audio', () => audio);

// Counts every sound call, whichever sound it was.
function soundCalls(): number {
  let total = 0;
  for (const mock of Object.values(audio)) total += mock.mock.calls.length;
  return total;
}
vi.mock('../store', () => ({ getApp }));

import { buzz, feedback } from './feedback';

describe('feedback', () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useRealTimers();
    for (const mock of Object.values(audio)) mock.mockClear();
    getApp.mockReturnValue({ save: { settings: { sound: true } } });
    vibrate = vi.fn();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate } });
  });

  it('plays tap feedback', () => {
    feedback('tap');
    expect(audio.playTap).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('plays correct and wrong feedback', () => {
    feedback('correct');
    expect(audio.playCorrect).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith(18);
    feedback('wrong');
    expect(audio.playWrong).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith([30, 50, 30]);
  });

  it('plays one level-up fanfare', () => {
    feedback('levelUp');
    expect(audio.playLevelUp).toHaveBeenCalledTimes(1);
    expect(soundCalls()).toBe(1);
    expect(vibrate).toHaveBeenCalledWith([20, 40, 20, 40, 60]);
  });

  it('passes the combo level to the combo sound', () => {
    feedback('combo', 4);
    expect(audio.playCombo).toHaveBeenCalledWith(4);
    expect(vibrate).toHaveBeenCalledWith(18);
  });

  it('plays the lost heart sound', () => {
    feedback('heartLost');
    expect(audio.playHeartLost).toHaveBeenCalledTimes(1);
    expect(soundCalls()).toBe(1);
  });

  it('skips sound and haptics when sound is off', () => {
    getApp.mockReturnValue({ save: { settings: { sound: false } } });
    feedback('correct');
    expect(soundCalls()).toBe(0);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when vibration is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    expect(() => feedback('wrong')).not.toThrow();
    expect(audio.playWrong).toHaveBeenCalledTimes(1);
  });

  it('buzzes for 8 milliseconds when sound is on', () => {
    buzz();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('plays only the soft tap sound when buzzing', () => {
    buzz();
    expect(audio.playTap).toHaveBeenCalledTimes(1);
    expect(soundCalls()).toBe(1);
  });

  it('does not vibrate or play when sound is off', () => {
    getApp.mockReturnValue({ save: { settings: { sound: false } } });
    buzz();
    expect(vibrate).not.toHaveBeenCalled();
    expect(soundCalls()).toBe(0);
  });

  it('does not throw when buzz vibration is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    expect(() => buzz()).not.toThrow();
  });

  it('does not throw when buzz vibration fails', () => {
    vibrate.mockImplementation(() => {
      throw new Error('vibration failed');
    });
    expect(() => buzz()).not.toThrow();
  });
});
