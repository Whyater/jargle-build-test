// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { PairsStep } from './PairsStep';
import { BlankStep } from './BlankStep';
import type { BlankStep as BlankData, PairsStep as PairsData } from '../../engine/types';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buttonWithText(root: HTMLElement, text: string): HTMLButtonElement | null {
  const buttons = root.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    if ((buttons[i].textContent || '').trim() === text) return buttons[i];
  }
  return null;
}

function mount(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

const pairs: PairsData = {
  id: 'pairs',
  kind: 'pairs',
  pairs: [
    { itemId: 'a', term: 'Router', meaning: 'Sends Wi-Fi around a home' },
    { itemId: 'b', term: 'Malware', meaning: 'Software made to cause harm' },
    { itemId: 'c', term: 'PIN', meaning: 'A short number code' },
    { itemId: 'd', term: 'Selfie', meaning: 'A photo of yourself' },
  ],
  terms: ['PIN', 'Router', 'Selfie', 'Malware'],
  meanings: ['A photo of yourself', 'Software made to cause harm', 'A short number code', 'Sends Wi-Fi around a home'],
};

const blank: BlankData = {
  id: 'blank:a',
  kind: 'blank',
  itemId: 'a',
  before: 'Restart the ',
  after: ' if the Wi-Fi stops working.',
  options: ['Selfie', 'Router', 'Meme'],
  answer: 'Router',
  why: 'Router: it sends the internet around your home.',
};

describe('PairsStep', () => {
  it('reports right when every pair is matched with no misses', async () => {
    const root = mount();
    const answers: boolean[] = [];
    render(<PairsStep step={pairs} onAnswer={(correct) => answers.push(correct)} />, root);
    for (const pair of pairs.pairs) {
      buttonWithText(root, pair.term)!.click();
      await wait(5);
      buttonWithText(root, pair.meaning)!.click();
      await wait(5);
    }
    expect(answers).toEqual([true]);
    expect(root.querySelectorAll('.ls-tile.is-matched').length).toBe(8);
  });

  it('a wrong pair is not matched, says why, and makes the step count as missed', async () => {
    const root = mount();
    const answers: boolean[] = [];
    let missed: string[] = [];
    render(
      <PairsStep
        step={pairs}
        onAnswer={(correct, _why, ids) => {
          answers.push(correct);
          missed = ids;
        }}
      />,
      root,
    );
    buttonWithText(root, 'Router')!.click();
    await wait(5);
    buttonWithText(root, 'A photo of yourself')!.click();
    await wait(5);
    expect(root.querySelectorAll('.ls-tile.is-matched').length).toBe(0);
    expect(root.textContent).toContain('Router means: Sends Wi-Fi around a home.');
    // Meaning first, then word, works too.
    for (const pair of pairs.pairs) {
      buttonWithText(root, pair.meaning)!.click();
      await wait(5);
      buttonWithText(root, pair.term)!.click();
      await wait(5);
    }
    expect(answers).toEqual([false]);
    // Router and the word that means "A photo of yourself" were mixed up.
    expect(missed).toEqual(['a', 'd']);
  });
});

describe('BlankStep', () => {
  it('fills the blank with the right word', async () => {
    const root = mount();
    const answers: boolean[] = [];
    render(<BlankStep step={blank} onAnswer={(correct) => answers.push(correct)} />, root);
    buttonWithText(root, 'Router')!.click();
    await wait(5);
    expect(answers).toEqual([true]);
    expect(root.querySelector('.ls-slot.is-right')!.textContent).toBe('Router');
  });

  it('a wrong pick shows the right word and answers only once', async () => {
    const root = mount();
    const answers: boolean[] = [];
    render(<BlankStep step={blank} onAnswer={(correct) => answers.push(correct)} />, root);
    buttonWithText(root, 'Meme')!.click();
    await wait(5);
    buttonWithText(root, 'Router')!.click();
    await wait(5);
    expect(answers).toEqual([false]);
    expect(root.querySelector('.ls-slot.is-wrong')!.textContent).toBe('Meme');
    expect(root.querySelector('.ls-slot-fix')!.textContent).toBe('Router');
    expect(buttonWithText(root, 'Router')!.getAttribute('aria-disabled')).toBe('true');
  });
});
