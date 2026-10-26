import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { buildQuestion, canSpell, isCorrect } from './questions';

const content = buildContent();
const item = content.items['two-factor-login'];

describe('buildQuestion', () => {
  it('builds each question kind with the expected shape', () => {
    const meaning = buildQuestion(content, item.id, 'meaning', 'a');
    if (meaning.kind !== 'meaning') throw new Error('expected a meaning question');
    expect(meaning.term).toBe(item.term);
    expect(meaning.options).toHaveLength(4);
    expect(meaning.options).toEqual(expect.arrayContaining([item.meaning, ...item.decoys.map((d) => d.meaning)]));
    expect(meaning.answer).toBe(item.meaning);

    const name = buildQuestion(content, item.id, 'name', 'b');
    if (name.kind !== 'name') throw new Error('expected a name question');
    expect(name.meaning).toBe(item.meaning);
    expect(name.options).toHaveLength(4);
    expect(name.options).toEqual(expect.arrayContaining([item.term, ...item.decoys.map((d) => d.term)]));
    expect(name.answer).toBe(item.term);

    const clue = buildQuestion(content, item.id, 'clue', 'c');
    if (clue.kind !== 'clue') throw new Error('expected a clue question');
    expect(clue.clues).toEqual(item.clues.slice(0, 3));
    expect(clue.options).toHaveLength(4);
    expect(clue.answer).toBe(item.term);

    const oldnew = buildQuestion(content, item.id, 'oldnew', 'd');
    expect(oldnew.options).toEqual(['Old tech', "Today's tech"]);
    expect(oldnew.answer).toBe("Today's tech");

    const tiles = buildQuestion(content, 'claude', 'tiles', 'e');
    if (tiles.kind !== 'tiles') throw new Error('expected a tiles question');
    expect(tiles.meaning).toBe(content.items.claude.meaning);
    expect(tiles.term).toBe('Claude');
    expect(tiles.options).toEqual(['Claude']);
    expect(tiles.answer).toBe('Claude');

    for (const question of [meaning, name, clue, oldnew]) {
      expect(question.options).toContain(question.answer);
      expect(question.why).toBe(item.term + ': ' + item.meaning);
    }
    expect(tiles.why).toBe('Claude: ' + content.items.claude.meaning);
  });

  it('is deterministic for a seed and shuffles options across seeds', () => {
    expect(buildQuestion(content, item.id, 'name', 'same')).toEqual(buildQuestion(content, item.id, 'name', 'same'));
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(buildQuestion(content, item.id, 'meaning', 'seed-' + i).options.join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('makes both true and false questions', () => {
    let sawTrue = false;
    let sawFalse = false;
    for (let i = 0; i < 40; i++) {
      const question = buildQuestion(content, item.id, 'truefalse', 'tf-' + i);
      if (question.kind !== 'truefalse') throw new Error('expected a truefalse question');
      if (question.answer === 'True') {
        sawTrue = true;
        expect(question.shownMeaning).toBe(item.meaning);
      } else {
        sawFalse = true;
        expect(item.decoys.map((d) => d.meaning)).toContain(question.shownMeaning);
      }
    }
    expect(sawTrue).toBe(true);
    expect(sawFalse).toBe(true);
  });

  it('follows old_tech and checks answers', () => {
    const oldItem = content.items['rotary-phone'];
    const question = buildQuestion(content, oldItem.id, 'oldnew', 'old');
    expect(question.answer).toBe('Old tech');
    expect(isCorrect(question, question.answer)).toBe(true);
    expect(isCorrect(question, 'wrong')).toBe(false);
  });

  it('checks tile answers by letters and keeps other kinds exact', () => {
    const tiles = buildQuestion(content, 'claude', 'tiles', 'letters');
    expect(isCorrect(tiles, 'CLAUDE')).toBe(true);
    expect(isCorrect(tiles, '')).toBe(false);
    expect(isCorrect(tiles, '   ')).toBe(false);
    const wifi = buildQuestion(content, 'wi-fi', 'tiles', 'punctuation');
    expect(isCorrect(wifi, 'WI FI')).toBe(true);
    expect(isCorrect(wifi, 'Wi-Fi')).toBe(true);
    expect(isCorrect(tiles, 'clad')).toBe(false);
    const name = buildQuestion(content, item.id, 'name', 'exact');
    expect(isCorrect(name, item.term.toUpperCase())).toBe(false);
    expect(isCorrect(name, item.term)).toBe(true);
  });

  it('accepts only short single words for tiles', () => {
    expect(canSpell('cache')).toBe(true);
    expect(canSpell('Wi-Fi')).toBe(false);
    expect(canSpell('two factor')).toBe(false);
    expect(canSpell('ab')).toBe(false);
    expect(canSpell('abcdefghi')).toBe(true);
    expect(canSpell('abcdefghij')).toBe(false);
    expect(canSpell('2fa')).toBe(false);
  });

  it('throws for an unknown item', () => {
    expect(() => buildQuestion(content, 'missing-item', 'name', 'x')).toThrow();
  });

  it('uses exactly the item and three decoys for meaning, name, and clue', () => {
    for (const kind of ['meaning', 'name', 'clue'] as const) {
      for (let i = 0; i < 10; i++) {
        const question = buildQuestion(content, item.id, kind, 'exact-' + kind + '-' + i);
        const expected = kind === 'meaning'
          ? [item.meaning, ...item.decoys.map((decoy) => decoy.meaning)]
          : [item.term, ...item.decoys.map((decoy) => decoy.term)];
        expect(new Set(question.options)).toEqual(new Set(expected));
        expect(question.options).toContain(question.answer);
      }
    }
  });

  it('makes both true and false truefalse questions with the right shown meaning', () => {
    let sawTrue = false;
    let sawFalse = false;
    const decoyMeanings = item.decoys.map((decoy) => decoy.meaning);
    for (let i = 0; i < 40; i++) {
      const question = buildQuestion(content, item.id, 'truefalse', 'many-' + i);
      if (question.kind !== 'truefalse') throw new Error('expected a truefalse question');
      if (question.answer === 'True') {
        sawTrue = true;
        expect(question.shownMeaning).toBe(item.meaning);
      } else {
        sawFalse = true;
        expect(decoyMeanings).toContain(question.shownMeaning);
      }
    }
    expect(sawTrue).toBe(true);
    expect(sawFalse).toBe(true);
  });

  it('gives every question the expected id and why line', () => {
    for (const kind of ['meaning', 'name', 'truefalse', 'oldnew', 'clue'] as const) {
      for (let i = 0; i < 10; i++) {
        const seed = 'identity-' + kind + '-' + i;
        const question = buildQuestion(content, item.id, kind, seed);
        expect(question.id).toBe(kind + ':' + item.id + ':' + seed);
        expect(question.why).toBe(item.term + ': ' + item.meaning);
      }
    }
  });
});
