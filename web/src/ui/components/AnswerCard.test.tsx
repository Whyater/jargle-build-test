// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import type { CardView } from '../../engine/api';
import { AnswerCard } from './AnswerCard';

function card(state: CardView['state'], selected = false): CardView {
  return { term: 'lucid', state, selected, meaning: 'easy to understand' };
}

describe('AnswerCard', () => {
  it('shows false for an unselected live card and true for a selected card', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<AnswerCard card={card('live')} index={1} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');

    render(<AnswerCard card={card('live', true)} index={1} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps aria-pressed on answer and missed cards', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<AnswerCard card={card('answer')} index={1} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');

    render(<AnswerCard card={card('missed')} index={2} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('labels an answer and a missed card', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<AnswerCard card={card('answer')} index={1} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.textContent?.startsWith('Right answer: lucid')).toBe(true);

    render(<AnswerCard card={card('missed')} index={2} onPick={() => undefined} />, root);
    expect(root.querySelector('button')?.textContent).toContain('Not this one');
  });
});
