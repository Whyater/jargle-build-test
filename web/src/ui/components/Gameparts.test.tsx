// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import type { ComponentChildren } from 'preact';
import { Card } from './Card';
import { Confetti } from './Confetti';
import { Hearts } from './Hearts';
import { Pill } from './Pill';
import { Streak } from './XpBadge';
import { XpBadge } from './XpBadge';

const roots: HTMLElement[] = [];

function mount(node: ComponentChildren): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  roots.push(root);
  render(node, root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    render(null, root);
    root.remove();
  }
  roots.length = 0;
  document.documentElement.classList.remove('reduce-motion');
});

describe('Hearts', () => {
  it('labels one heart left and marks the other hearts as lost', () => {
    const root = mount(<Hearts left={1} total={3} />);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('1 heart left');
    expect(root.querySelectorAll('.heart.lost')).toHaveLength(2);
  });
});

describe('XpBadge and Streak', () => {
  it('labels an XP badge with its level', () => {
    const root = mount(<XpBadge level={4} />);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Level 4');
  });

  it('only turns the streak on when it has days', () => {
    const zero = mount(<Streak days={0} />);
    expect(zero.querySelector('.streak-flame')?.classList.contains('on')).toBe(false);

    const three = mount(<Streak days={3} />);
    expect(three.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('3 day streak');
    expect(three.querySelector('.streak-flame')?.classList.contains('on')).toBe(true);
  });
});

describe('Pill', () => {
  it('uses an image role and accessible label when supplied', () => {
    const root = mount(<Pill label="3 day streak">3</Pill>);
    const pill = root.querySelector('.pill');
    expect(pill?.getAttribute('role')).toBe('img');
    expect(pill?.getAttribute('aria-label')).toBe('3 day streak');
  });
});

describe('Confetti', () => {
  it('renders no bits for an empty burst and 18 bits for a burst', () => {
    const empty = mount(<Confetti burst={0} />);
    expect(empty.querySelector('.confetti')).toBeNull();

    const burst = mount(<Confetti burst={1} />);
    expect(burst.querySelectorAll('.bit')).toHaveLength(18);
  });

  it('renders nothing when reduced motion is enabled', () => {
    document.documentElement.classList.add('reduce-motion');
    const root = mount(<Confetti burst={1} />);
    expect(root.querySelector('.confetti')).toBeNull();
  });
});

describe('Card', () => {
  it('renders a pressable link when href is supplied', () => {
    const root = mount(<Card href="#/next">Next</Card>);
    const link = root.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.className).toContain('card-press');
  });

  it('renders a pressable button when onClick is supplied', () => {
    const root = mount(<Card onClick={() => undefined}>Next</Card>);
    const button = root.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('card-press');
  });

  it('renders a plain div when it is not pressable', () => {
    const root = mount(<Card>Next</Card>);
    const card = root.querySelector('.card');
    expect(card?.tagName).toBe('DIV');
    expect(card?.className).not.toContain('card-press');
  });
});
