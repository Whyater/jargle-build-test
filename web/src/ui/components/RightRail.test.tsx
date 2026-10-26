// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { devContent, devSave } from '../__dev__/content';
import { setAppForDev } from '../store';
import { RightRail } from './RightRail';

const TODAY = '2026-11-06';
let root: HTMLElement;

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  document.documentElement.classList.add('reduce-motion');
});

afterEach(() => {
  render(null, root);
  root.remove();
  document.documentElement.classList.remove('reduce-motion');
  setAppForDev({ status: 'loading', content: null, save: null, today: '' });
});

describe('RightRail', () => {
  it('renders the goals, level, week, and next lesson sections', () => {
    setAppForDev({ status: 'ready', content: devContent, save: devSave, today: TODAY });
    render(<RightRail screen="settings" />, root);

    expect(root.querySelector('aside')?.getAttribute('aria-label')).toBe('Your day');
    expect(root.textContent).toContain("Today's goals");
    expect(root.textContent).toContain('This week');
    expect(root.textContent).toContain('Next up');
    expect(root.textContent).toContain('Level 1');
    expect(Array.from(root.querySelectorAll('.rail-goal-label')).map((label) => label.textContent?.trim())).toEqual([
      'Daily Jargle',
      'One lesson',
      'An Endless run',
    ]);
    expect(root.querySelectorAll('.rail-week li')).toHaveLength(7);
  });

  it('marks Endless done and shows its completed count', () => {
    setAppForDev({
      status: 'ready',
      content: devContent,
      save: { ...devSave, endlessLastDay: TODAY },
      today: TODAY,
    });
    render(<RightRail screen="settings" />, root);

    const endless = Array.from(root.querySelectorAll('.rail-goal')).find((link) => link.textContent?.includes('An Endless run'));
    expect(endless?.classList.contains('done')).toBe(true);
    expect(root.querySelector('.rail-count')?.textContent?.trim()).toBe('1 of 3');
  });

  it('renders nothing when the save is not loaded', () => {
    setAppForDev({ status: 'ready', content: devContent, save: null, today: TODAY });
    render(<RightRail screen="settings" />, root);

    expect(root.innerHTML).toBe('');
  });

  it('leaves out Next up on Play and Learn, and the level card on Me', () => {
    setAppForDev({ status: 'ready', content: devContent, save: devSave, today: TODAY });
    render(<RightRail screen="home" />, root);
    expect(root.textContent).not.toContain('Next up');
    expect(root.textContent).toContain('Level 1');

    render(<RightRail screen="learn" />, root);
    expect(root.textContent).not.toContain('Next up');

    render(<RightRail screen="me" />, root);
    expect(root.textContent).toContain('Next up');
    expect(root.querySelector('.rail-level')).toBeNull();
  });

  it('stops changing the tip as soon as Reduce motion is turned on', () => {
    vi.useFakeTimers();
    document.documentElement.classList.remove('reduce-motion');
    const calm = { ...devSave, settings: { ...devSave.settings, reducedMotion: true } };
    const moving = { ...devSave, settings: { ...devSave.settings, reducedMotion: false } };

    // Other parts (the mascot's blink, the typing bubble) have timers too, so count them first
    // with Reduce motion on, after the typing is done.
    setAppForDev({ status: 'ready', content: devContent, save: calm, today: TODAY });
    act(() => {
      render(<RightRail screen="settings" />, root);
    });
    vi.advanceTimersByTime(60000);
    const baseline = vi.getTimerCount();
    act(() => {
      render(null, root);
    });

    // With motion allowed there are more timers, one of them the timer that shows the next tip.
    setAppForDev({ status: 'ready', content: devContent, save: moving, today: TODAY });
    act(() => {
      render(<RightRail screen="settings" />, root);
    });
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBeGreaterThan(baseline);

    // Turning Reduce motion on removes the tip timer right away (before, it kept running).
    setAppForDev({ status: 'ready', content: devContent, save: calm, today: TODAY });
    act(() => {
      render(<RightRail screen="settings" />, root);
    });
    vi.advanceTimersByTime(60000);
    expect(vi.getTimerCount()).toBe(baseline);
    vi.useRealTimers();
  });
});
