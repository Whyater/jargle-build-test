// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { buildContent } from '../../engine/__fixtures__/content';
import { newState } from '../../engine/state';
import { getApp, setAppForDev } from '../store';
import { JargleScreen } from './Jargle';

vi.mock('./jargleWords', () => ({
  buildWordList: (extra: string[]) => new Set([...extra, 'WIFI', 'HOME']),
  isKnownWord: (words: Set<string>, guess: string) => words.has(guess.toUpperCase()),
}));

const TODAY = '2026-10-25';
let root: HTMLElement;

function contentForTest() {
  const content = buildContent({ schedule: ['wi-fi'] });
  content.items['wi-fi'].puzzle = 'WIFI';
  content.items['wi-fi'].clues = ['First clue', 'Second clue', 'Third clue', 'Fourth clue', 'Fifth clue'];
  return content;
}

function show() {
  setAppForDev({
    status: 'ready',
    content: contentForTest(),
    save: newState(),
    today: TODAY,
    demo: null,
    storageKey: 'jargle:v1',
    canSave: true,
  });
  act(() => render(<JargleScreen />, root));
}

function key(name: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent?.trim() === name || item.getAttribute('aria-label') === name,
  );
  if (!button) throw new Error('No key ' + name);
  return button;
}

async function press(text: string) {
  await act(async () => {
    key(text).click();
    await Promise.resolve();
  });
}

async function typeOnScreen(text: string) {
  for (const letter of text) await press(letter);
}

async function finishTimers() {
  await act(async () => {
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    await Promise.resolve();
    vi.runOnlyPendingTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  document.documentElement.classList.add('reduce-motion');
  root = document.createElement('div');
  document.body.appendChild(root);
  show();
});

afterEach(() => {
  act(() => render(null, root));
  root.remove();
  document.documentElement.classList.remove('reduce-motion');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Daily Jargle', () => {
  it('fills a row with on-screen keys and deletes one letter', async () => {
    await typeOnScreen('WIF');
    expect(root.querySelector('[aria-label="Guess 1 of 6"]')?.textContent).toBe('WIF');
    await press('Delete letter');
    expect(root.querySelector('[aria-label="Guess 1 of 6"]')?.textContent).toBe('WI');
  });

  it('accepts physical keyboard input', async () => {
    for (const pressed of ['w', 'i', 'f', 'Backspace', 'Enter']) {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: pressed }));
        await Promise.resolve();
      });
    }
    expect(root.querySelector('[aria-label="Guess 1 of 6"]')?.textContent).toBe('WI');
    expect(root.textContent).toContain('Not enough letters');
  });

  it('rejects a short guess without using a try', async () => {
    await typeOnScreen('W');
    await press('Enter');
    expect(root.textContent).toContain('Not enough letters');
    expect(root.querySelector('[aria-label="Guess 2 of 6"]')?.textContent).toBe('');
  });

  it('rejects a word that is not in the list', async () => {
    await typeOnScreen('ZZZZ');
    await press('Enter');
    await finishTimers();
    expect(root.textContent).toContain('Not in the word list');
    expect(root.querySelector('[aria-label="Guess 2 of 6"]')?.textContent).toBe('');
  });

  it('colors a wrong guess and unlocks the second clue', async () => {
    await typeOnScreen('HOME');
    await press('Enter');
    await finishTimers();
    const row = root.querySelector('[aria-label="Guess 1 of 6"]')!;
    expect(row.querySelector('[aria-label="H, not in the word"]')).not.toBeNull();
    expect(row.querySelector('[aria-label="O, not in the word"]')).not.toBeNull();
    expect(root.textContent).toContain('Second clue');
  });

  it('wins with the answer and saves the result with XP', async () => {
    await typeOnScreen('WIFI');
    await press('Enter');
    await act(async () => {
      await Promise.resolve();
    });
    await finishTimers();
    expect(root.querySelector('h2')?.textContent || '').toContain('First try');
    expect(getApp().save?.jargle?.['1'].status).toBe('won');
    expect(getApp().save?.xp).toBeGreaterThan(0);
  });
});
