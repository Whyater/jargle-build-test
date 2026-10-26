import { describe, expect, it } from 'vitest';
import { currentLessonIndex, pathOffset, roundSummaryLine, topicName } from './listLogic';

describe('list helpers', () => {
  it('names topics', () => expect(topicName('locks-and-keys')).toBe('Locks and Keys'));
  it('summarizes solved and learned rounds', () => {
    expect(roundSummaryLine({ itemId: 'x', term: 'X', solved: true, bars: 1 })).toBe(
      'Solved with 1 bar left',
    );
    expect(roundSummaryLine({ itemId: 'x', term: 'X', solved: false, bars: 0 })).toBe('Learned it');
  });
});

describe('pathOffset', () => {
  it('uses the repeating eight-node pattern', () => {
    expect(pathOffset(0)).toBe(0);
    expect(pathOffset(1)).toBe(44);
    expect(pathOffset(2)).toBe(64);
    expect(pathOffset(3)).toBe(44);
    expect(pathOffset(4)).toBe(0);
    expect(pathOffset(5)).toBe(-44);
    expect(pathOffset(6)).toBe(-64);
    expect(pathOffset(7)).toBe(-44);
  });

  it('repeats after eight nodes', () => {
    expect(pathOffset(8)).toBe(pathOffset(0));
  });
});

describe('currentLessonIndex', () => {
  it('returns the first open lesson that is not done', () => {
    expect(
      currentLessonIndex([
        { open: true, done: true },
        { open: true, done: false },
        { open: true, done: false },
      ]),
    ).toBe(1);
  });

  it('returns -1 for an empty list and a list where every lesson is done', () => {
    expect(currentLessonIndex([])).toBe(-1);
    expect(
      currentLessonIndex([
        { open: true, done: true },
        { open: false, done: true },
      ]),
    ).toBe(-1);
  });

  it('skips a locked lesson that is not done', () => {
    expect(
      currentLessonIndex([
        { open: false, done: false },
        { open: true, done: false },
      ]),
    ).toBe(1);
  });
});
