// @vitest-environment jsdom

import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Mascot, TALK_FRAME_MS } from './Mascot';

function renderMascot(props: Parameters<typeof Mascot>[0]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => render(<Mascot {...props} />, container));
  return container;
}

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove('reduce-motion');
  document.body.innerHTML = '';
});

describe('Mascot sprites', () => {
  it('uses the expected src and srcset for Floyd and Bud', () => {
    for (const who of ['floyd', 'bud'] as const) {
      const image = renderMascot({ who }).querySelector('img[data-frame="idle"]');
      expect(image?.getAttribute('src')).toBe(`/mascots/${who}-idle.webp`);
      expect(image?.getAttribute('srcset')).toBe(
        `/mascots/${who}-idle@1x.webp 192w, /mascots/${who}-idle.webp 384w`,
      );
    }
  });

  it('adds a blink layer only for idle when not talking', () => {
    expect(renderMascot({ who: 'floyd' }).querySelector('img[data-frame="blink"]')).not.toBeNull();
    expect(renderMascot({ who: 'floyd', pose: 'happy' }).querySelector('img[data-frame="blink"]')).toBeNull();
    expect(renderMascot({ who: 'floyd', talking: true }).querySelector('img[data-frame="blink"]')).toBeNull();
  });

  it('toggles mascot-off on the talk layer every 140 ms', () => {
    vi.useFakeTimers();
    const container = renderMascot({ who: 'bud', talking: true });
    const talk = container.querySelector('img[data-frame="talk"]');
    expect(talk?.classList.contains('mascot-off')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(TALK_FRAME_MS);
    });
    expect(talk?.classList.contains('mascot-off')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(TALK_FRAME_MS);
    });
    expect(talk?.classList.contains('mascot-off')).toBe(true);
  });

  it('stops alternating after unmount', () => {
    vi.useFakeTimers();
    const container = renderMascot({ who: 'floyd', talking: true });
    const talk = container.querySelector('img[data-frame="talk"]');
    render(null, container);
    act(() => {
      vi.advanceTimersByTime(TALK_FRAME_MS * 2);
    });
    expect(talk?.classList.contains('mascot-off')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not toggle when reduced motion is enabled', () => {
    vi.useFakeTimers();
    document.documentElement.classList.add('reduce-motion');
    const talk = renderMascot({ who: 'bud', talking: true }).querySelector('img[data-frame="talk"]');
    expect(talk?.classList.contains('mascot-off')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(TALK_FRAME_MS * 2);
    });
    expect(talk?.classList.contains('mascot-off')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
