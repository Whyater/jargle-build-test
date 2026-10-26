// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { setAppForDev } from '../store';
import { Screen } from './Screen';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Screen', () => {
  it('focuses the heading again when focusKey changes', async () => {
    window.scrollTo = () => undefined;
    setAppForDev({ status: 'ready' });
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(
      <Screen title="Pass the Phone" focusKey="start">
        <p>Ready?</p>
      </Screen>,
      root,
    );
    await wait(100);

    const heading = root.querySelector('h1');
    expect(document.activeElement).toBe(heading);
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).not.toBe(heading);

    render(
      <Screen title="Pass the Phone" focusKey="round-1">
        <p>Ready?</p>
      </Screen>,
      root,
    );
    await wait(100);
    expect(document.activeElement).toBe(heading);
  });
});
