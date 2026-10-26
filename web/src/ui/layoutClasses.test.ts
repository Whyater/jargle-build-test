// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setLayoutClasses } from './layoutClasses';

afterEach(() => {
  document.body.className = '';
  document.documentElement.className = '';
});

describe('setLayoutClasses', () => {
  it('marks a tab screen with has-tabs and no focus mode', () => {
    setLayoutClasses(true);
    expect(document.body.classList.contains('has-tabs')).toBe(true);
    expect(document.body.classList.contains('focus-mode')).toBe(false);
    expect(document.documentElement.classList.contains('focus-mode')).toBe(false);
  });

  it('marks a game screen with focus mode on body and html', () => {
    setLayoutClasses(false);
    expect(document.body.classList.contains('has-tabs')).toBe(false);
    expect(document.body.classList.contains('focus-mode')).toBe(true);
    expect(document.documentElement.classList.contains('focus-mode')).toBe(true);
  });

  it('switches back when leaving a game', () => {
    setLayoutClasses(false);
    setLayoutClasses(true);
    expect(document.body.classList.contains('focus-mode')).toBe(false);
    expect(document.documentElement.classList.contains('focus-mode')).toBe(false);
  });
});
