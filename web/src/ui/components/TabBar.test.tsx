// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders Play, Learn, and Me links', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<TabBar active="play" />, root);

    const links = Array.from(root.querySelectorAll('a'));
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Play', 'Learn', 'Me']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/', '#/learn', '#/me']);

    render(null, root);
    root.remove();
  });

  it('marks the active tab with aria-current and the on class', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<TabBar active="learn" />, root);

    const links = Array.from(root.querySelectorAll('a'));
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[1].classList.contains('on')).toBe(true);
    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[2].getAttribute('aria-current')).toBeNull();

    render(null, root);
    root.remove();
  });
});
