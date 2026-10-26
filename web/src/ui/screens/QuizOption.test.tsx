// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { QuizOption } from './QuizOption';

describe('QuizOption', () => {
  it('always has aria-pressed and only picks the clicked option', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(
      <QuizOption
        options={[{ term: 'lucid', meaning: 'easy to understand' }, { term: 'murky', meaning: 'hard to see through' }]}
        answer="lucid"
      />,
      root,
    );

    const buttons = root.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });
});
