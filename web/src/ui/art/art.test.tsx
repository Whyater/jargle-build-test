// @vitest-environment jsdom

import { render } from 'preact';
import type { ComponentChildren } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge, Bud, Floyd } from './index';
import type { BudMood } from './index';

const badgeIds = [
  'first-word',
  'week-one',
  'days-30',
  'days-60',
  'first-lesson',
  'floyds-student',
  'taught-someone',
] as const;

function renderArt(node: ComponentChildren) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(node, container);
  return container;
}

function renderSvg(node: ComponentChildren) {
  const container = renderArt(node);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Floyd', () => {
  it('uses a default size of 96 and accepts a custom size', () => {
    const defaultContainer = renderArt(<Floyd />);
    const defaultMascot = defaultContainer.querySelector('.mascot');
    const defaultImg = defaultContainer.querySelector('.mascot-img');
    expect(defaultMascot?.getAttribute('style')).toContain('width: 96px');
    expect(defaultMascot?.getAttribute('style')).toContain('height: 96px');
    expect(defaultImg?.getAttribute('width')).toBe('96');
    expect(defaultImg?.getAttribute('height')).toBe('96');

    const customContainer = renderArt(<Floyd size={128} />);
    const customMascot = customContainer.querySelector('.mascot');
    const customImg = customContainer.querySelector('.mascot-img');
    expect(customMascot?.getAttribute('style')).toContain('width: 128px');
    expect(customMascot?.getAttribute('style')).toContain('height: 128px');
    expect(customImg?.getAttribute('width')).toBe('128');
    expect(customImg?.getAttribute('height')).toBe('128');
  });

  it('handles title, aria, and wiggle state', () => {
    const titled = renderArt(<Floyd title="Floyd" wiggle />).querySelector('.mascot');
    expect(titled?.getAttribute('role')).toBe('img');
    expect(titled?.getAttribute('aria-label')).toBe('Floyd');
    expect(titled?.hasAttribute('aria-hidden')).toBe(false);
    expect(titled?.classList.contains('art-wiggle')).toBe(true);

    const plain = renderArt(<Floyd />).querySelector('.mascot');
    expect(plain?.getAttribute('aria-hidden')).toBe('true');
    expect(plain?.hasAttribute('role')).toBe(false);
    expect(plain?.classList.contains('art-wiggle')).toBe(false);
  });
});

describe('Bud', () => {
  it('uses a default size of 96 and accepts a custom size', () => {
    const defaultContainer = renderArt(<Bud />);
    const defaultMascot = defaultContainer.querySelector('.mascot');
    const defaultImg = defaultContainer.querySelector('.mascot-img');
    expect(defaultMascot?.getAttribute('style')).toContain('width: 96px');
    expect(defaultMascot?.getAttribute('style')).toContain('height: 96px');
    expect(defaultImg?.getAttribute('width')).toBe('96');
    expect(defaultImg?.getAttribute('height')).toBe('96');

    const customContainer = renderArt(<Bud size={128} />);
    const customMascot = customContainer.querySelector('.mascot');
    const customImg = customContainer.querySelector('.mascot-img');
    expect(customMascot?.getAttribute('style')).toContain('width: 128px');
    expect(customMascot?.getAttribute('style')).toContain('height: 128px');
    expect(customImg?.getAttribute('width')).toBe('128');
    expect(customImg?.getAttribute('height')).toBe('128');
  });

  it('handles title, aria, and wiggle state', () => {
    const titled = renderArt(<Bud title="Bud" wiggle />).querySelector('.mascot');
    expect(titled?.getAttribute('role')).toBe('img');
    expect(titled?.getAttribute('aria-label')).toBe('Bud');
    expect(titled?.hasAttribute('aria-hidden')).toBe(false);
    expect(titled?.classList.contains('art-wiggle')).toBe(true);

    const plain = renderArt(<Bud />).querySelector('.mascot');
    expect(plain?.getAttribute('aria-hidden')).toBe('true');
    expect(plain?.hasAttribute('role')).toBe(false);
    expect(plain?.classList.contains('art-wiggle')).toBe(false);
  });

  it.each([
    ['idle', 'idle'],
    ['happy', 'happy'],
    ['sympathetic', 'oops'],
  ] as const)('maps the %s mood to the %s pose', (mood, pose) => {
    const image = renderArt(<Bud mood={mood as BudMood} />).querySelector('.mascot-img');
    expect(image?.getAttribute('data-frame')).toBe(pose);
  });

  it('lets an explicit pose override the mood', () => {
    const image = renderArt(<Bud mood="happy" pose="think" />).querySelector('.mascot-img');
    expect(image?.getAttribute('data-frame')).toBe('think');
  });
});

describe('Badge', () => {
  it.each(badgeIds)('%s renders earned and locked variants', (id) => {
    const earnedSvg = renderSvg(<Badge id={id} earned />);
    const lockedSvg = renderSvg(<Badge id={id} earned={false} />);

    expect(earnedSvg.getAttribute('viewBox')).toBe('0 0 96 96');
    expect(lockedSvg.getAttribute('viewBox')).toBe('0 0 96 96');
    expect(earnedSvg.classList.contains('art-badge-earned')).toBe(true);
    expect(lockedSvg.classList.contains('art-badge-earned')).toBe(false);
    expect(lockedSvg.outerHTML).not.toMatch(/#(FFD23F|E08A1E|FFFFFF)/i);
  });

  it('has the same title and aria behavior as the other art', () => {
    const titledSvg = renderSvg(<Badge id="first-word" earned title="First word" />);
    expect(titledSvg.getAttribute('role')).toBe('img');
    expect(titledSvg.hasAttribute('aria-hidden')).toBe(false);
    expect(titledSvg.querySelector('title')?.textContent).toBe('First word');

    const plainSvg = renderSvg(<Badge id="first-word" earned={false} />);
    expect(plainSvg.getAttribute('aria-hidden')).toBe('true');
    expect(plainSvg.hasAttribute('role')).toBe(false);
  });
});

describe('Badge SVGs', () => {
  it('contain no filters, gradients, or text elements', () => {
    for (const id of badgeIds) {
      for (const earned of [true, false]) {
        const svg = renderSvg(<Badge id={id} earned={earned} />);
        expect(svg.querySelector('filter, linearGradient, radialGradient, text')).toBeNull();
      }
    }
  });
});
