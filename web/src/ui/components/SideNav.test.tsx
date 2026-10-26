// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { devContent, devSave } from '../__dev__/content';
import { setAppForDev } from '../store';
import { SideNav } from './SideNav';

const root = document.createElement('div');

afterEach(() => {
  render(null, root);
  root.remove();
  setAppForDev({ status: 'loading', content: null, save: null, today: '' });
});

describe('SideNav', () => {
  it('renders the main tab links and help link', () => {
    document.body.appendChild(root);
    render(<SideNav active="play" />, root);

    const nav = root.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main');
    const links = Array.from(root.querySelectorAll('.sidenav-links a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Play', 'Learn', 'Me']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/', '#/learn', '#/me']);
    expect(root.querySelector('.sidenav-help')?.getAttribute('href')).toBe('#/how');
  });

  it('marks only the active tab as the current page', () => {
    document.body.appendChild(root);
    render(<SideNav active="learn" />, root);

    const links = Array.from(root.querySelectorAll('.sidenav-links a'));
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[1].classList.contains('on')).toBe(true);
    expect(links[0].getAttribute('aria-current')).toBeNull();
    expect(links[2].getAttribute('aria-current')).toBeNull();
    expect(links[0].classList.contains('on')).toBe(false);
    expect(links[2].classList.contains('on')).toBe(false);
  });

  it('shows level and streak stats when the app is loaded', () => {
    setAppForDev({ status: 'ready', content: devContent, save: devSave, today: '2026-11-06' });
    document.body.appendChild(root);
    render(<SideNav active="me" />, root);

    const stats = root.querySelector('.sidenav-stats');
    expect(stats?.getAttribute('href')).toBe('#/me');
    expect(stats?.querySelector('.visually-hidden')?.textContent?.startsWith('Level ')).toBe(true);
  });
});
