// @vitest-environment jsdom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeechBubble } from './SpeechBubble';

function setup() {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.documentElement.classList.remove('reduce-motion');
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('SpeechBubble', () => {
  it('keeps the full text in a visually hidden span', () => {
    const root = setup();
    render(<SpeechBubble text="Hello there" />, root);

    expect(root.querySelector('.visually-hidden')?.textContent).toBe('Hello there');
    expect(root.querySelector('[aria-hidden="true"]')).not.toBeNull();
    render(null, root);
  });

  it('types part of the text before the bubble rest', async () => {
    vi.useFakeTimers();
    const root = setup();
    await act(async () => {
      render(<SpeechBubble text="Hello" speed={10} />, root);
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(root.querySelector('.bubble-rest')?.textContent).toBe('llo');
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe('Hello');
    render(null, root);
  });

  it('finishes typing and reports the typing state', async () => {
    vi.useFakeTimers();
    const typing: boolean[] = [];
    const root = setup();
    await act(async () => {
      render(<SpeechBubble text="Hello" speed={10} onTyping={(value) => typing.push(value)} />, root);
    });

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(root.querySelector('.bubble-rest')?.textContent).toBe('');
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe('Hello');
    expect(typing).toEqual([true, false]);
    render(null, root);
  });

  it('shows the whole line when clicked', async () => {
    vi.useFakeTimers();
    const typing: boolean[] = [];
    const root = setup();
    await act(async () => {
      render(<SpeechBubble text="Hello" speed={10} onTyping={(value) => typing.push(value)} />, root);
    });

    await act(async () => {
      root.querySelector('.bubble')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(root.querySelector('.bubble-rest')?.textContent).toBe('');
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe('Hello');
    expect(typing).toEqual([true, false]);
    render(null, root);
  });

  it('shows all text immediately when reduced motion is enabled', () => {
    document.documentElement.classList.add('reduce-motion');
    const typing: boolean[] = [];
    const root = setup();
    render(<SpeechBubble text="Hello" onTyping={(value) => typing.push(value)} />, root);

    expect(root.querySelector('.bubble-rest')?.textContent).toBe('');
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe('Hello');
    expect(typing).toEqual([]);
    render(null, root);
  });
});
