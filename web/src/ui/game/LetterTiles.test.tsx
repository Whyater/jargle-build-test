// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LetterTiles } from './LetterTiles';
import type { LetterTilesResult } from './LetterTiles';
import { tileSound } from './tileSounds';

// Record sounds instead of playing them.
vi.mock('./tileSounds', () => ({ tileSound: vi.fn() }));

/** How many times a sound was asked for since the last clear. */
function soundCount(name: string): number {
  const calls = vi.mocked(tileSound).mock.calls;
  let count = 0;
  for (let i = 0; i < calls.length; i++) {
    if (calls[i][0] === name) count++;
  }
  return count;
}

const roots: HTMLElement[] = [];

function mount(node: preact.ComponentChildren) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  roots.push(root);
  act(() => {
    render(node, root);
  });
  return root;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(tileSound).mockClear();
});

afterEach(() => {
  for (const root of roots) {
    render(null, root);
    root.remove();
  }
  roots.length = 0;
  vi.useRealTimers();
});

function trayTiles(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('.lt-tray .lt-tile'));
}

function slotTiles(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('.lt-slots .lt-tile'));
}

/** The letters in the slots, with "_" for an empty one. */
function slotText(root: HTMLElement): string {
  const slots = root.querySelectorAll('.lt-slot');
  let text = '';
  for (let i = 0; i < slots.length; i++) {
    const letter = slots[i].querySelector('.lt-letter');
    text += letter ? letter.textContent : '_';
  }
  return text;
}

function click(button: HTMLElement) {
  act(() => {
    button.click();
  });
}

/** Taps the first loose tray tile with this letter. */
function tapLetter(root: HTMLElement, letter: string) {
  const tiles = trayTiles(root);
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].getAttribute('aria-label') === 'Letter ' + letter) {
      click(tiles[i]);
      return;
    }
  }
  throw new Error('No loose tile ' + letter);
}

function spell(root: HTMLElement, word: string) {
  for (let i = 0; i < word.length; i++) tapLetter(root, word[i]);
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

function toolButton(root: HTMLElement, name: string): HTMLButtonElement {
  const buttons = root.querySelectorAll<HTMLButtonElement>('.lt-tool');
  for (let i = 0; i < buttons.length; i++) {
    if ((buttons[i].textContent || '').indexOf(name) !== -1) return buttons[i];
  }
  throw new Error('No tool ' + name);
}

describe('LetterTiles', () => {
  it('shows one slot per letter and adds decoys at higher difficulty', () => {
    const easy = mount(<LetterTiles answer="byte" prompt="A small piece of data." difficulty={1} onDone={() => {}} />);
    expect(easy.querySelectorAll('.lt-slot').length).toBe(4);
    expect(trayTiles(easy).length).toBe(4);
    const hard = mount(<LetterTiles answer="byte" prompt="A small piece of data." difficulty={3} onDone={() => {}} />);
    expect(trayTiles(hard).length).toBe(6);
    expect(hard.textContent).toContain('A small piece of data.');
  });

  it('places a tapped tile in the next slot and sends it back when tapped again', () => {
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={() => {}} />);
    tapLetter(root, 'T');
    expect(slotText(root)).toBe('T___');
    // Its spot in the tray stays as a hole.
    expect(trayTiles(root).length).toBe(3);
    expect(root.querySelectorAll('.lt-tray .lt-hole').length).toBe(1);
    tapLetter(root, 'B');
    expect(slotText(root)).toBe('TB__');
    click(slotTiles(root)[0]);
    expect(slotText(root)).toBe('_B__');
    expect(trayTiles(root).length).toBe(3);
    // The next tile fills the first empty slot.
    tapLetter(root, 'Y');
    expect(slotText(root)).toBe('YB__');
  });

  it('reports a right word with the full score', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={2} onDone={done} />);
    spell(root, 'BYTE');
    expect(done).not.toHaveBeenCalled();
    wait(400);
    expect(done).toHaveBeenCalledTimes(1);
    const result: LetterTilesResult = done.mock.calls[0][0];
    expect(result.correct).toBe(true);
    expect(result.hintsUsed).toBe(0);
    expect(result.score).toBe(18);
    expect(root.querySelector('.lt.is-right')).not.toBeNull();
  });

  it('gives one more try after a wrong word, then shows the answer', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={done} />);
    spell(root, 'YBTE');
    wait(400);
    expect(root.querySelector('.lt.is-wrong')).not.toBeNull();
    expect(done).not.toHaveBeenCalled();
    wait(700);
    // Tiles slid back to the tray.
    expect(slotText(root)).toBe('____');
    expect(trayTiles(root).length).toBe(4);
    expect(root.textContent).toContain('Last try');

    spell(root, 'ETYB');
    wait(400);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].correct).toBe(false);
    expect(done.mock.calls[0][0].score).toBe(0);
    expect(slotText(root)).toBe('BYTE');
    expect(root.textContent).toContain('Here is the word');
    // Nothing more happens after the end.
    wait(2000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('counts a right word on the second try', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={done} />);
    spell(root, 'YBTE');
    wait(1200);
    spell(root, 'BYTE');
    wait(400);
    expect(done.mock.calls[0][0].correct).toBe(true);
  });

  it('a hint places the next right letter, locks it and costs the no-hint bonus', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={done} />);
    tapLetter(root, 'Y');
    click(toolButton(root, 'Hint'));
    // The wrong Y went back and B is now in slot 1, from the hint.
    expect(slotText(root)).toBe('B___');
    expect(slotTiles(root)[0].getAttribute('aria-disabled')).toBe('true');
    click(slotTiles(root)[0]);
    expect(slotText(root)).toBe('B___');
    spell(root, 'YTE');
    wait(400);
    const result: LetterTilesResult = done.mock.calls[0][0];
    expect(result.correct).toBe(true);
    expect(result.hintsUsed).toBe(1);
    expect(result.score).toBe(15);
  });

  it('types letters from the keyboard and Backspace sends the last one back', () => {
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={() => {}} />);
    pressKey('b');
    pressKey('Y');
    expect(slotText(root)).toBe('BY__');
    pressKey('q');
    expect(slotText(root)).toBe('BY__');
    pressKey('Backspace');
    expect(slotText(root)).toBe('B___');
  });

  it('keeps typing working after a wrong try slides the tiles back', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={done} />);
    for (const key of 'YBTE') pressKey(key);
    wait(1200);
    expect(slotText(root)).toBe('____');
    for (const key of 'BYTE') pressKey(key);
    wait(400);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0].correct).toBe(true);
  });

  it('plays one wrong sound per miss: its own on the first, none on the last when the host plays it', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} resultSound={false} onDone={done} />);
    spell(root, 'YBTE');
    wait(1200);
    // First miss: the host has not heard anything yet, so the tiles make the sound.
    expect(soundCount('wrong')).toBe(1);
    spell(root, 'ETYB');
    wait(400);
    // Last miss: onDone fires and the host plays the wrong sound, so the tiles stay quiet.
    expect(done).toHaveBeenCalledTimes(1);
    expect(soundCount('wrong')).toBe(1);
  });

  it('plays the right sound only when resultSound is on', () => {
    const quiet = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} resultSound={false} onDone={() => {}} />);
    spell(quiet, 'BYTE');
    wait(400);
    expect(soundCount('correct')).toBe(0);
    const loud = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={() => {}} />);
    spell(loud, 'BYTE');
    wait(400);
    expect(soundCount('correct')).toBe(1);
  });

  it('hints the right copy of a repeated letter', () => {
    const done = vi.fn();
    const root = mount(<LetterTiles answer="cache" prompt="Clue" difficulty={1} onDone={done} />);
    // C and A are right, then H lands in slot 3 by mistake.
    spell(root, 'CAH');
    click(toolButton(root, 'Hint'));
    // Slot 3 needed the second C: the hint moves the wrong H back and puts a C there.
    expect(slotText(root)).toBe('CAC__');
    spell(root, 'HE');
    wait(400);
    expect(done.mock.calls[0][0].correct).toBe(true);
    expect(done.mock.calls[0][0].hintsUsed).toBe(1);
  });

  it('ignores the keyboard when keysOn is false', () => {
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} keysOn={false} onDone={() => {}} />);
    pressKey('b');
    expect(slotText(root)).toBe('____');
  });

  it('shuffle keeps the same tiles in a new order', () => {
    const root = mount(<LetterTiles answer="router" prompt="Clue" difficulty={1} onDone={() => {}} />);
    const before = trayTiles(root).map((tile) => tile.getAttribute('aria-label'));
    click(toolButton(root, 'Shuffle'));
    const after = trayTiles(root).map((tile) => tile.getAttribute('aria-label'));
    expect(after.slice().sort()).toEqual(before.slice().sort());
    expect(after.join(',')).not.toBe(before.join(','));
  });

  it('shows gaps for multi-word answers and only makes tiles from letters', () => {
    const root = mount(<LetterTiles answer="Wi-Fi" prompt="Clue" difficulty={1} onDone={() => {}} />);
    expect(root.querySelectorAll('.lt-word').length).toBe(2);
    expect(root.querySelector('.lt-sep')!.textContent).toBe('-');
    expect(trayTiles(root).length).toBe(4);
  });

  it('labels tiles and empty slots for screen readers', () => {
    const root = mount(<LetterTiles answer="byte" prompt="Clue" difficulty={1} onDone={() => {}} />);
    expect(trayTiles(root)[0].getAttribute('aria-label')).toMatch(/^Letter [BYTE]$/);
    expect(root.querySelector('.lt-slots')!.getAttribute('aria-label')).toBe('Your word, 4 letters');
    expect(root.textContent).toContain('Slot 1, empty');
    tapLetter(root, 'B');
    expect(slotTiles(root)[0].getAttribute('aria-label')).toBe('Slot 1: B. Send back');
    expect(root.querySelector('[role="status"]')!.textContent).toBe('B in slot 1. 3 left.');
  });
});
