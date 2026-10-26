import { describe, expect, it } from 'vitest';
import { buildContent } from '../../engine/__fixtures__/content';
import { railTips } from './railLogic';

describe('railTips', () => {
  it('uses Floyd with general lines when there is no item', () => {
    const tips = railTips(null, false);

    expect(tips.who).toBe('floyd');
    expect(tips.lines.length).toBeGreaterThan(0);
  });

  it('uses Floyd for old tech and Bud for other items', () => {
    const content = buildContent();
    const oldTech = content.items['rotary-phone'];
    const newTech = content.items['claude'];

    expect(railTips(oldTech, false).who).toBe('floyd');
    expect(railTips(newTech, false).who).toBe('bud');
  });

  it('does not spoil the item before it is finished', () => {
    const content = buildContent();
    const item = content.items['claude'];
    const tips = railTips(item, false);
    const text = tips.lines.join(' ').toLowerCase();

    expect(text).not.toContain(item.term.toLowerCase());
    expect(text).not.toContain(item.meaning.toLowerCase());
  });

  it('names the term and meaning after it is finished', () => {
    const content = buildContent();
    const item = content.items['claude'];
    const tips = railTips(item, true);

    expect(tips.lines[0].toLowerCase()).toContain(item.term.toLowerCase());
    expect(tips.lines[0].toLowerCase()).toContain(item.meaning.toLowerCase());
  });

  it('never uses an em dash in its lines', () => {
    const content = buildContent();
    const items = [null, content.items['claude'], content.items['rotary-phone']];

    for (const item of items) {
      for (const finished of [false, true]) {
        expect(railTips(item, finished).lines.join('')).not.toContain('\u2014');
      }
    }
  });
});
