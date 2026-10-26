// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { UpdateState } from '../../platform/updater';

// A fake updater store, so each test can pick the state the banner sees.
let fakeState: UpdateState = { kind: 'none' };
let fakeListener: ((state: UpdateState) => void) | null = null;
const installUpdate = vi.fn(() => Promise.resolve());
const dismissUpdate = vi.fn();

vi.mock('../../platform/updater', () => ({
  getUpdateState: () => fakeState,
  subscribeUpdate: (listener: (state: UpdateState) => void) => {
    fakeListener = listener;
    return () => {
      fakeListener = null;
    };
  },
  startUpdateChecks: () => undefined,
  installUpdate: () => installUpdate(),
  dismissUpdate: () => dismissUpdate(),
}));

import { UpdateBanner } from './UpdateBanner';

function show(state: UpdateState): HTMLElement {
  fakeState = state;
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => {
    render(<UpdateBanner />, root);
  });
  return root;
}

function buttonNamed(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(root.querySelectorAll('button'));
  return buttons.find((b) => b.textContent === text);
}

afterEach(() => {
  document.body.innerHTML = '';
  installUpdate.mockClear();
  dismissUpdate.mockClear();
});

describe('UpdateBanner', () => {
  it('shows nothing when there is no update', () => {
    const root = show({ kind: 'none' });
    expect(root.querySelector('.update-banner')).toBeNull();
  });

  it('shows the desktop update with Update now and Later', () => {
    const root = show({ kind: 'ready', source: 'desktop', version: '2.1.0' });
    expect(root.textContent).toContain('A new Jargle is ready!');
    expect(root.textContent).toContain('Version 2.1.0');
    const update = buttonNamed(root, 'Update now');
    const later = buttonNamed(root, 'Later');
    expect(update).toBeTruthy();
    expect(later).toBeTruthy();
    act(() => update!.click());
    expect(installUpdate).toHaveBeenCalledTimes(1);
    act(() => later!.click());
    expect(dismissUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows the web refresh text', () => {
    const root = show({ kind: 'ready', source: 'web', version: '' });
    expect(root.textContent).toContain('New version ready, tap to refresh');
    expect(buttonNamed(root, 'Refresh')).toBeTruthy();
  });

  it('shows a progress bar and no buttons while downloading', () => {
    const root = show({ kind: 'downloading', progress: 0.5 });
    const bar = root.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('50');
    expect(root.querySelectorAll('button').length).toBe(0);
  });

  it('shows a waiting stripe when the size is unknown', () => {
    const root = show({ kind: 'downloading', progress: null });
    expect(root.querySelector('.update-wait')).toBeTruthy();
  });

  it('offers Try again after a failed update', () => {
    const root = show({ kind: 'failed' });
    expect(root.textContent).toContain("The update didn't finish");
    expect(buttonNamed(root, 'Try again')).toBeTruthy();
  });

  it('follows the store when the state changes', () => {
    const root = show({ kind: 'none' });
    act(() => fakeListener!({ kind: 'ready', source: 'desktop', version: '2.2.0' }));
    expect(root.textContent).toContain('A new Jargle is ready!');
    act(() => fakeListener!({ kind: 'none' }));
    expect(root.querySelector('.update-banner')).toBeNull();
  });

  it('keeps one live region and fills it when an update shows up', () => {
    const root = show({ kind: 'none' });
    const region = root.querySelector('[role="status"]');
    expect(region).toBeTruthy();
    expect(region!.textContent).toBe('');
    act(() => fakeListener!({ kind: 'ready', source: 'desktop', version: '2.2.0' }));
    // Same element as before, so screen readers announce the new text.
    expect(root.querySelector('[role="status"]')).toBe(region);
    expect(region!.textContent).toBe('A new Jargle is ready!');
  });
});
