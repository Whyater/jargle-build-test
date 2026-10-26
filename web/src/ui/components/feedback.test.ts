import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getApp, playSound } = vi.hoisted(() => ({
  playSound: vi.fn(),
  getApp: vi.fn(() => ({ save: { settings: { sound: true } } })),
}));

vi.mock('../../platform/audio', () => ({ playSound }));
vi.mock('../store', () => ({ getApp }));

import { buzz, feedback } from './feedback';

describe('feedback', () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useRealTimers();
    playSound.mockClear();
    getApp.mockReturnValue({ save: { settings: { sound: true } } });
    vibrate = vi.fn();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate } });
  });

  it('plays tap feedback', () => {
    feedback('tap');
    expect(playSound).toHaveBeenCalledWith('tap');
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('plays correct and wrong feedback', () => {
    feedback('correct');
    expect(playSound).toHaveBeenLastCalledWith('chime');
    expect(vibrate).toHaveBeenLastCalledWith(18);
    feedback('wrong');
    expect(playSound).toHaveBeenLastCalledWith('tock');
    expect(vibrate).toHaveBeenLastCalledWith([30, 50, 30]);
  });

  it('plays level-up sounds 180 milliseconds apart', () => {
    vi.useFakeTimers();
    feedback('levelUp');
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([20, 40, 20, 40, 60]);
    vi.advanceTimersByTime(179);
    expect(playSound).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(playSound).toHaveBeenLastCalledWith('ding');
  });

  it('skips sound and haptics when sound is off', () => {
    getApp.mockReturnValue({ save: { settings: { sound: false } } });
    feedback('correct');
    expect(playSound).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when vibration is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    expect(() => feedback('wrong')).not.toThrow();
    expect(playSound).toHaveBeenCalledWith('tock');
  });

  it('buzzes for 8 milliseconds when sound is on', () => {
    buzz();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('does not play a sound when buzzing', () => {
    buzz();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('does not vibrate when sound is off', () => {
    getApp.mockReturnValue({ save: { settings: { sound: false } } });
    buzz();
    expect(vibrate).not.toHaveBeenCalled();
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
