// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useWide } from './useWide';

function WideText() {
  return <p>{useWide() ? 'wide' : 'narrow'}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWide', () => {
  it('uses matchMedia with addEventListener', async () => {
    let matches = true;
    let change: (() => void) | null = null;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_name: string, listener: () => void) => {
        change = listener;
      },
      removeEventListener: vi.fn(),
    })));
    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(async () => {
      render(<WideText />, root);
    });
    expect(root.textContent).toBe('wide');
    matches = false;
    await act(async () => {
      change!();
    });
    expect(root.textContent).toBe('narrow');

    render(null, root);
    root.remove();
  });

  it('supports old Safari listener methods', async () => {
    let matches = false;
    let change: (() => void) | null = null;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return matches;
      },
      addListener: (listener: () => void) => {
        change = listener;
      },
      removeListener: vi.fn(),
    })));
    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(async () => {
      render(<WideText />, root);
    });
    expect(root.textContent).toBe('narrow');
    matches = true;
    await act(async () => {
      change!();
    });
    expect(root.textContent).toBe('wide');

    render(null, root);
    root.remove();
  });
});
