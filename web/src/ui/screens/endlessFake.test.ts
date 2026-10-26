import { describe, expect, it } from 'vitest';
import { endlessContent, endlessSave } from './endlessFixture';
import {
  answerEndless,
  comboMultiplier,
  fakeQuestion,
  finishEndless,
  levelFromXp,
  nextEndlessQuestion,
  startEndless,
} from './endlessFake';

function run(seed = 7) {
  return startEndless(endlessSave, endlessContent, '2026-10-26', seed);
}

function right(current: ReturnType<typeof run>, cluesUsed?: number) {
  return answerEndless(current, { choice: current.question!.answer, cluesUsed });
}

describe('fake endless engine', () => {
  it('repeats a question for the same seed', () => {
    const first = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const second = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    expect(first).toEqual(second);
  });

  it('builds the right options for every kind', () => {
    expect(fakeQuestion(endlessContent, 'pixel', 'meaning', 1).options).toHaveLength(4);
    expect(fakeQuestion(endlessContent, 'pixel', 'name', 1).options).toHaveLength(4);
    const truth = fakeQuestion(endlessContent, 'pixel', 'truefalse', 1);
    expect(truth.options).toEqual(['True', 'False']);
    if (truth.kind === 'truefalse') {
      expect((truth.answer === 'True') === (truth.shownMeaning === endlessContent.items.pixel.meaning)).toBe(true);
    }
    expect(fakeQuestion(endlessContent, 'floppy', 'oldnew', 1).answer).toBe('Old tech');
    const clue = fakeQuestion(endlessContent, 'pixel', 'clue', 1);
    if (clue.kind === 'clue') expect(clue.clues).toHaveLength(3);
  });

  it('scores combos and clue points', () => {
    let current = run();
    expect(right(current).points).toBe(10);
    for (let i = 0; i < 2; i++) {
      current = nextEndlessQuestion(right(current).run, endlessContent);
    }
    const third = right(current);
    expect(third.points).toBe(20);
    current = nextEndlessQuestion(third.run, endlessContent);
    for (let i = 0; i < 3; i++) {
      current = nextEndlessQuestion(right(current).run, endlessContent);
    }
    expect(right(current).points).toBe(30);
    expect(comboMultiplier(6)).toBe(3);

    const clue = fakeQuestion(endlessContent, 'pixel', 'clue', 3);
    const clueRun = { ...run(), question: clue };
    expect(answerEndless(clueRun, { choice: clue.answer, cluesUsed: 1 }).points).toBe(30);
    expect(answerEndless(clueRun, { choice: clue.answer, cluesUsed: 2 }).points).toBe(20);
    expect(answerEndless(clueRun, { choice: clue.answer, cluesUsed: 3 }).points).toBe(10);
  });

  it('handles wrong answers, over runs, and repeated answers', () => {
    let current = run();
    const wrong = answerEndless(current, { choice: 'wrong' });
    expect(wrong.run.hearts).toBe(2);
    expect(wrong.run.combo).toBe(0);
    expect(answerEndless(wrong.run, { choice: wrong.run.question!.answer }).run).toEqual(wrong.run);
    current = { ...current, hearts: 1 };
    const over = answerEndless(current, { choice: 'wrong' });
    expect(over.run.over).toBe(true);
    expect(nextEndlessQuestion(over.run, endlessContent)).toEqual(over.run);
  });

  it('finishes and levels up', () => {
    expect(
      finishEndless(
        { ...endlessSave, endlessBest: 20 },
        { ...run(), score: 10, xp: 5 },
        '2026-10-26',
      ).endlessBest,
    ).toBe(20);
    expect(
      finishEndless(
        { ...endlessSave, endlessBest: 20 },
        { ...run(), score: 30, xp: 5 },
        '2026-10-26',
      ).endlessBest,
    ).toBe(30);
    expect(levelFromXp(0)).toEqual({ level: 1, intoLevel: 0, needed: 30 });
    expect(levelFromXp(30)).toEqual({ level: 2, intoLevel: 0, needed: 50 });
    expect(levelFromXp(95)).toEqual({ level: 3, intoLevel: 15, needed: 70 });
  });
});
