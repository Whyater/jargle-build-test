// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { goBack, hrefFor, navigate, parseHash, replaceRoute, tabForRoute } from './router';

describe('parseHash', () => {
  it('uses home for an empty hash', () => {
    expect(parseHash('').name).toBe('home');
    expect(parseHash('#').name).toBe('home');
    expect(parseHash('#/')).toEqual({ name: 'home', param: null });
  });

  it('parses simple routes', () => {
    const routes: [string, string][] = [
      ['#/review', 'review'],
      ['#/learn', 'learn'],
      ['#/practice', 'practice'],
      ['#/oldtech', 'oldtech'],
      ['#/ptp', 'ptp'],
      ['#/badges', 'badges'],
      ['#/settings', 'settings'],
      ['#/how', 'how'],
      ['#/about', 'about'],
      ['#/code', 'code'],
      ['#/code/use', 'codeUse'],
      ['#/get', 'get'],
      ['#/gallery', 'gallery'],
      ['#/me', 'me'],
      ['#/endless', 'endless'],
    ];
    routes.forEach(([hash, name]) => expect(parseHash(hash)).toEqual({ name, param: null }));
  });

  it('parses encoded play and lesson params', () => {
    expect(parseHash('#/play/d%3A12')).toEqual({ name: 'play', param: 'd:12' });
    expect(parseHash('#/play/rotary-phone')).toEqual({ name: 'play', param: 'rotary-phone' });
    expect(parseHash('#/play/ptp%3A3%3A1')).toEqual({ name: 'play', param: 'ptp:3:1' });
    expect(parseHash('#/lesson/first%20lesson')).toEqual({ name: 'lesson', param: 'first lesson' });
  });

  it('returns notFound for unknown paths', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'notFound', param: null });
    expect(parseHash('#/play')).toEqual({ name: 'notFound', param: null });
    expect(parseHash('#/play/a/b')).toEqual({ name: 'notFound', param: null });
  });
});

describe('hrefFor', () => {
  it('round trips every route', () => {
    const simple = ['home', 'review', 'learn', 'practice', 'oldtech', 'ptp', 'badges', 'settings', 'how', 'about', 'code', 'codeUse', 'get', 'gallery', 'me', 'endless'];
    simple.forEach((name) => {
      const route = parseHash(hrefFor(name));
      expect(route.name).toBe(name);
      expect(route.param).toBeNull();
    });
    expect(parseHash(hrefFor('play', 'd:12'))).toEqual({ name: 'play', param: 'd:12' });
    expect(parseHash(hrefFor('lesson', 'lesson 1'))).toEqual({ name: 'lesson', param: 'lesson 1' });
  });
});

describe('tabForRoute', () => {
  it('maps routes to their tabs', () => {
    ['home', 'review', 'practice', 'oldtech'].forEach((name) => expect(tabForRoute(name)).toBe('play'));
    expect(tabForRoute('learn')).toBe('learn');
    ['me', 'settings', 'badges', 'about', 'how', 'code', 'codeUse', 'get'].forEach((name) => expect(tabForRoute(name)).toBe('me'));
  });

  it('hides the tab bar for focused and unknown routes', () => {
    ['play', 'lesson', 'ptp', 'endless', 'gallery', 'notFound', 'bogus'].forEach((name) => expect(tabForRoute(name)).toBeNull());
  });
});

describe('old route compatibility', () => {
  it('keeps existing hashes parsing the same way', () => {
    expect(parseHash('#/')).toEqual({ name: 'home', param: null });
    expect(parseHash('#/play/abc')).toEqual({ name: 'play', param: 'abc' });
    expect(parseHash('#/lesson/x')).toEqual({ name: 'lesson', param: 'x' });
    expect(parseHash('#/code/use')).toEqual({ name: 'codeUse', param: null });
    expect(parseHash('#/settings')).toEqual({ name: 'settings', param: null });
    expect(parseHash('#/bogus')).toEqual({ name: 'notFound', param: null });
  });
});

describe('history depth', () => {
  it('does not leave the app when a direct visit is at depth zero', () => {
    window.history.replaceState({ jargleDepth: 0 }, '', '#/play/direct');
    window.dispatchEvent(new PopStateEvent('popstate'));
    const back = vi.spyOn(window.history, 'back');

    goBack();

    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/');
    back.mockRestore();
  });

  it('goes back after navigating to a new route', async () => {
    window.history.replaceState({ jargleDepth: 0 }, '', '#/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    replaceRoute('home');
    navigate('play', 'next');
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.history.state).toEqual({ jargleDepth: 1 });
    const back = vi.spyOn(window.history, 'back');

    goBack();

    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
