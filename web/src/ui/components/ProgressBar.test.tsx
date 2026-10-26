// @vitest-environment jsdom
import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ProgressBar', () => {
  it('clamps aria-valuenow to the range', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(<ProgressBar value={-2} max={10} label="XP" />, root);
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    render(<ProgressBar value={12} max={10} label="XP" />, root);
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('10');
    render(null, root);
  });

  it('scales the fill between zero and one', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(<ProgressBar value={-1} max={10} label="XP" />, root);
    expect((root.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0)');
    render(<ProgressBar value={15} max={10} label="XP" />, root);
    expect((root.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(1)');
    render(<ProgressBar value={5} max={10} label="XP" />, root);
    expect((root.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0.5)');
    render(null, root);
  });

  it('does not produce NaN when max is zero', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    render(<ProgressBar value={4} max={0} label="XP" />, root);
    expect((root.querySelector('.fill') as HTMLElement).style.transform).toBe('scaleX(0)');
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    render(null, root);
  });
});
