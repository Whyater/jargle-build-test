// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { BuildStep } from './BuildStep';
import type { BuildStep as BuildData } from '../../engine/types';

// Record sounds instead of playing them.
vi.mock('../game/tileSounds', () => ({ tileSound: vi.fn() }));

const step: BuildData = {
  id: 'build',
  kind: 'build',
  itemId: 'byte',
  clue: 'A small unit of computer data.',
  answer: 'byte',
  why: 'byte: a small unit of data',
};

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  render(null, root);
  root.remove();
  vi.useRealTimers();
});

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('BuildStep', () => {
  it('shows letter tiles, not a text box', () => {
    act(() => {
      render(<BuildStep step={step} onAnswer={() => {}} />, root);
    });
    expect(root.querySelector('input')).toBeNull();
    // 4 answer tiles plus 1 decoy at difficulty 2.
    expect(root.querySelectorAll('.lt-tray .lt-tile').length).toBe(5);
    expect(root.textContent).toContain('A small unit of computer data.');
    // No points in lessons, so Hint shows no cost.
    expect(root.querySelector('.lt-cost')).toBeNull();
  });

  it('answers right once the word is spelled', () => {
    const onAnswer = vi.fn();
    act(() => {
      render(<BuildStep step={step} onAnswer={onAnswer} />, root);
    });
    for (const key of 'BYTE') pressKey(key);
    wait(400);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('answers wrong after two misses', () => {
    const onAnswer = vi.fn();
    act(() => {
      render(<BuildStep step={step} onAnswer={onAnswer} />, root);
    });
    for (const key of 'YBTE') pressKey(key);
    wait(1200);
    expect(onAnswer).not.toHaveBeenCalled();
    for (const key of 'ETYB') pressKey(key);
    wait(1200);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});
