// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { setAppForDev, useApp } from './store';

function Status() {
  const app = useApp();
  return <p>{app.status}</p>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useApp', () => {
  it('shows a change that happens before the screen has subscribed', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<Status />, root);
    // Content can load from the service worker cache before effects run.
    setAppForDev({ status: 'ready' });
    await wait(50);
    expect(root.textContent).toBe('ready');
  });
});
