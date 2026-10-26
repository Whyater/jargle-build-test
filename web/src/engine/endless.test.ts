import { describe, expect, it } from 'vitest';
import { buildContent, makeItem } from './__fixtures__/content';
import { dateOfDay } from './dates';
import { buildQuestion, canSpell } from './questions';
import { newState } from './state';
import {
  answerEndless,
  comboMultiplier,
  endlessPool,
  finishEndless,
  nextEndlessQuestion,
  startEndless,
} from './endless';

describe('endless mode', () => {
  function questionOf(run: ReturnType<typeof startEndless>) {
    if (!run.question) throw new Error('no question');
    return run.question;
  }

  it('limits the pool to released dailies and extras', () => {
    const content = buildContent({ days: 4 });
    const pool = endlessPool(content, dateOfDay(1));
    expect(pool).toContain('two-factor-login');
    expect(pool).not.toContain('wi-fi');
    expect(pool).toContain('rotary-phone');
  });

  it('adds bank words from day 1 and still never upcoming dailies', () => {
    const content = buildContent({ days: 4 });
    const before = endlessPool(content, dateOfDay(1));
    content.items['bank-modem'] = { ...makeItem('bank-modem', 'how-the-internet-works', 1, false), bank: true };
    content.items['bank-pager'] = { ...makeItem('bank-pager', 'old-tech', 2, true), bank: true };
    const pool = endlessPool(content, dateOfDay(1));
    expect(pool.length).toBe(before.length + 2);
    expect(pool).toContain('bank-modem');
    expect(pool).toContain('bank-pager');
    expect(pool).toContain('two-factor-login');
    expect(pool).not.toContain('wi-fi');
    expect(pool).not.toContain('screenshot');
  });

  it('leaves bank words out before day 1', () => {
    const content = buildContent();
    content.items['bank-modem'] = { ...makeItem('bank-modem', 'how-the-internet-works', 1, false), bank: true };
    expect(endlessPool(content, dateOfDay(0))).not.toContain('bank-modem');
    expect(endlessPool(content, dateOfDay(1))).toContain('bank-modem');
  });

  it('asks bank words in a long run without asking future dailies', () => {
    const content = buildContent({ days: 20 });
    const bankIds = ['bank-modem', 'bank-router', 'bank-pager'];
    content.items['bank-modem'] = { ...makeItem('bank-modem', 'how-the-internet-works', 1, false), bank: true };
    content.items['bank-router'] = { ...makeItem('bank-router', 'how-the-internet-works', 2, false), bank: true };
    content.items['bank-pager'] = { ...makeItem('bank-pager', 'old-tech', 1, true), bank: true };
    const today = dateOfDay(2);
    const future = content.schedule.days
      .filter((entry) => entry.date > today)
      .map((entry) => entry.term);
    let run = startEndless(newState(), content, today, 77);
    const asked: string[] = [];
    for (let i = 0; i < 100; i++) {
      const question = questionOf(run);
      asked.push(question.itemId);
      expect(future).not.toContain(question.itemId);
      run = answerEndless(run, { choice: question.answer }).run;
      if (run.over) run = { ...run, over: false, hearts: 3 };
      run = nextEndlessQuestion(run, content);
    }
    for (const id of bankIds) expect(asked).toContain(id);
  });

  it('is deterministic and avoids an item repeat in one cycle', () => {
    const content = buildContent({ days: 4, oldTechCount: 6 });
    const a = startEndless(newState(), content, dateOfDay(4), 12);
    const b = startEndless(newState(), content, dateOfDay(4), 12);
    expect(a).toEqual(b);
    let run = a;
    const ids: string[] = [];
    for (let i = 0; i < run.pool.length; i++) {
      ids.push(run.question!.itemId);
      run = answerEndless(run, { choice: run.question!.answer }).run;
      run = nextEndlessQuestion(run, content);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scores combos and wrong answers', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(6)).toBe(3);
    const content = buildContent();
    let run = startEndless(newState(), content, dateOfDay(1), 2);
    const first = answerEndless(run, { choice: run.question!.answer });
    expect(first.points).toBeGreaterThan(0);
    run = nextEndlessQuestion(first.run, content);
    const wrong = answerEndless(run, { choice: '__wrong__' });
    expect(wrong.correct).toBe(false);
    expect(wrong.run.combo).toBe(0);
    expect(wrong.run.hearts).toBe(2);
  });

  it('ends after three misses and does not change afterward', () => {
    const content = buildContent();
    let run = startEndless(newState(), content, dateOfDay(1), 7);
    for (let i = 0; i < 3; i++) {
      run = answerEndless(run, { choice: '__wrong__' }).run;
      if (i < 2) run = nextEndlessQuestion(run, content);
    }
    expect(run.over).toBe(true);
    expect(run.hearts).toBe(0);
    expect(nextEndlessQuestion(run, content)).toEqual(run);
    expect(answerEndless(run, { choice: run.question!.answer }).run).toEqual(run);
  });

  it('finishes onto an old-style save', () => {
    const content = buildContent();
    const run = startEndless(newState(), content, dateOfDay(1), 4);
    const scored = answerEndless(run, { choice: run.question!.answer }).run;
    const state = finishEndless(newState(), scored, dateOfDay(1));
    expect(state.endlessGames).toBe(1);
    expect(state.endlessBest).toBe(scored.score);
    expect(state.xp).toBe(scored.xp);
    expect(state.endlessLastDay).toBe(dateOfDay(1));
  });

  it('returns an over run for an empty released pool', () => {
    const content = buildContent();
    content.schedule.days = [];
    content.oldTech = [];
    content.ptpExtras = [];
    const run = startEndless(newState(), content, dateOfDay(0), 1);
    expect(run.over).toBe(true);
    expect(run.question).toBeNull();
  });

  it('keeps inputs unchanged and only raises the saved best', () => {
    const content = buildContent();
    const run = startEndless(newState(), content, dateOfDay(1), 9);
    const before = JSON.stringify(run);
    const answered = answerEndless(run, { choice: run.question!.answer }).run;
    expect(JSON.stringify(run)).toBe(before);
    const old = newState();
    old.endlessBest = answered.score + 100;
    old.endlessGames = 4;
    old.xp = 25;
    const saved = finishEndless(old, answered, dateOfDay(1));
    expect(saved.endlessBest).toBe(old.endlessBest);
    expect(saved.endlessGames).toBe(5);
    expect(saved.xp).toBe(25 + answered.xp);
    expect(old.endlessGames).toBe(4);
  });

  it('moves from easy questions to harder questions after right answers', () => {
    const content = buildContent({ days: 4, oldTechCount: 0 });
    let run = startEndless(newState(), content, dateOfDay(4), 15);
    const difficulties: number[] = [];
    for (let i = 0; i < 10; i++) {
      difficulties.push(run.question!.difficulty);
      run = nextEndlessQuestion(answerEndless(run, { choice: run.question!.answer }).run, content);
    }
    expect(difficulties.slice(0, 3).every((d) => d === 1)).toBe(true);
    expect(difficulties.some((d) => d === 2 || d === 3)).toBe(true);
  });

  it('keeps the five old kinds unchanged when tiles cannot fire', () => {
    const original = buildContent({ days: 20, oldTechCount: 10 });
    const content = { ...original, items: { ...original.items } };
    for (const id of Object.keys(content.items)) {
      content.items[id] = { ...content.items[id], term: content.items[id].term + '-x' };
    }
    let run = startEndless(newState(), content, dateOfDay(5), 44);
    const sequence: string[] = [];
    for (let i = 0; i < 30; i++) {
      const question = questionOf(run);
      sequence.push(question.itemId + ':' + question.kind);
      run = answerEndless(run, { choice: question.answer }).run;
      if (run.over) run = { ...run, over: false, hearts: 3 };
      run = nextEndlessQuestion(run, content);
    }
    expect(sequence).toEqual([
      'dewey-decimal-system:truefalse', 'rotary-phone:name', 'old-7:meaning',
      'phone-book:clue', 'wi-fi:name', 'screenshot:oldnew', 'ptp-1:truefalse',
      'fax-machine:clue', 'old-10:meaning', 'two-factor-login:name', 'old-9:clue',
      'old-8:name', 'emoji:meaning', 'floppy-disk:oldnew', 'cassette-tape:name',
      'ptp-2:clue', 'claude:meaning', 'wi-fi:truefalse', 'old-9:oldnew',
      'floppy-disk:clue', 'phone-book:name', 'two-factor-login:clue',
      'dewey-decimal-system:oldnew', 'fax-machine:truefalse', 'emoji:meaning',
      'cassette-tape:truefalse', 'ptp-2:clue', 'rotary-phone:name',
      'screenshot:meaning', 'old-7:clue',
    ]);
  });

  it('keeps a deterministic sequence and final run for the same seed', () => {
    const content = buildContent({ days: 20, oldTechCount: 10 });
    const play = (seed: number) => {
      let run = startEndless(newState(), content, dateOfDay(5), seed);
      const ids: string[] = [];
      for (let n = 1; n <= 30 && !run.over; n++) {
        const question = questionOf(run);
        ids.push(question.id);
        const right = n % 2 === 0 && n % 4 !== 0;
        const result = answerEndless(run, { choice: right ? question.answer : '__wrong__' });
        run = result.run;
        if (!run.over) run = nextEndlessQuestion(run, content);
      }
      return { ids, run };
    };
    const first = play(44);
    const second = play(44);
    const other = play(45);
    expect(second).toEqual(first);
    expect(other.ids).not.toEqual(first.ids);
  });

  it('never asks a future item during a long run', () => {
    const content = buildContent({ days: 20 });
    const today = dateOfDay(5);
    const pool = endlessPool(content, today);
    const future = content.schedule.days
      .filter((entry) => entry.date > today)
      .map((entry) => entry.term);
    let run = startEndless(newState(), content, today, 91);
    for (let i = 0; i < 200; i++) {
      const question = questionOf(run);
      expect(pool).toContain(question.itemId);
      expect(future).not.toContain(question.itemId);
      run = answerEndless(run, { choice: question.answer }).run;
      if (run.over) {
        run = { ...run, over: false, hearts: 3 };
      }
      run = nextEndlessQuestion(run, content);
    }
  });

  it('does not repeat a question kind in adjacent questions', () => {
    const content = buildContent({ days: 20 });
    let run = startEndless(newState(), content, dateOfDay(5), 92);
    let previous: string | null = null;
    for (let i = 0; i < 200; i++) {
      const question = questionOf(run);
      if (previous) expect(question.kind).not.toBe(previous);
      previous = question.kind;
      run = answerEndless(run, { choice: question.answer }).run;
      if (run.over) run = { ...run, over: false, hearts: 3 };
      run = nextEndlessQuestion(run, content);
    }
  });

  it('uses every pool item once before reusing items', () => {
    const content = buildContent({ days: 5, oldTechCount: 0 });
    const today = dateOfDay(5);
    const pool = endlessPool(content, today);
    let run = startEndless(newState(), content, today, 93);
    const ids: string[] = [];
    for (let i = 0; i < pool.length * 2; i++) {
      ids.push(questionOf(run).itemId);
      run = answerEndless(run, { choice: questionOf(run).answer }).run;
      run = nextEndlessQuestion(run, content);
    }
    expect(new Set(ids.slice(0, pool.length))).toEqual(new Set(pool));
    expect(new Set(ids.slice(0, pool.length)).size).toBe(pool.length);
    if (pool.length > 1) expect(ids[pool.length]).not.toBe(ids[pool.length - 1]);
  });

  it('has the documented combo multiplier boundaries', () => {
    for (const combo of [0, 1, 2]) expect(comboMultiplier(combo)).toBe(1);
    for (const combo of [3, 4, 5]) expect(comboMultiplier(combo)).toBe(2);
    for (const combo of [6, 7, 10]) expect(comboMultiplier(combo)).toBe(3);
  });

  it('scores a seven-answer streak and awards combo XP', () => {
    const content = buildContent();
    let run = startEndless(newState(), content, dateOfDay(1), 94);
    const points: number[] = [];
    const xp: number[] = [];
    for (let i = 0; i < 7; i++) {
      const question = buildQuestion(content, 'two-factor-login', 'meaning', 'streak-' + i);
      run = { ...run, question, answered: false };
      const result = answerEndless(run, { choice: question.answer });
      points.push(result.points);
      xp.push(result.xpGained);
      run = result.run;
    }
    expect(points).toEqual([10, 10, 20, 20, 20, 30, 30]);
    expect(xp).toEqual([10, 10, 15, 15, 15, 15, 15]);
    expect(run.score).toBe(140);
    expect(run.xp).toBe(95);
    expect(run.bestCombo).toBe(7);
  });

  it('clamps clue points to one through three clues', () => {
    const content = buildContent();
    const original = startEndless(newState(), content, dateOfDay(1), 95);
    const expected = [30, 20, 10, 30, 30, 10];
    const clues = [1, 2, 3, undefined, 0, 9];
    for (let i = 0; i < clues.length; i++) {
      const question = buildQuestion(content, 'two-factor-login', 'clue', 'clue-' + i);
      const run = { ...original, question, answered: false, combo: 0, score: 0, xp: 0 };
      const result = answerEndless(run, { choice: question.answer, cluesUsed: clues[i] });
      expect(result.points).toBe(expected[i]);
    }
  });

  it('does nothing when answering the same question twice', () => {
    const content = buildContent();
    const run = startEndless(newState(), content, dateOfDay(1), 96);
    const question = questionOf(run);
    const first = answerEndless(run, { choice: question.answer });
    const second = answerEndless(first.run, { choice: question.answer });
    expect(second.correct).toBe(false);
    expect(second.points).toBe(0);
    expect(second.xpGained).toBe(0);
    expect(second.run).toEqual(first.run);
  });

  it('keeps the last question after a wrong answer loses the last heart', () => {
    const content = buildContent();
    let run = startEndless(newState(), content, dateOfDay(1), 97);
    run = { ...run, hearts: 1 };
    const question = questionOf(run);
    const result = answerEndless(run, { choice: '__wrong__' });
    expect(result.run.over).toBe(true);
    expect(result.run.question).toEqual(question);
  });
  it('skips pool ids that are missing from the content', () => {
    const content = buildContent();
    const run = startEndless(newState(), content, dateOfDay(1), 5);
    const stale = { ...run, pool: ['gone-1', ...run.pool, 'gone-2'], answered: true };
    for (let i = 0; i < 10; i++) {
      const next = nextEndlessQuestion(stale, content);
      if (!next.question) throw new Error('expected a question');
      expect(content.items[next.question.itemId]).toBeDefined();
      stale.asked = stale.asked + 1;
    }
    const empty = nextEndlessQuestion({ ...run, pool: ['gone-1'] }, content);
    expect(empty.over).toBe(true);
  });
  it('mixes spell tiles without adjacent tiles and only uses spellable terms', () => {
    const content = buildContent({ days: 20, oldTechCount: 10 });
    const spellWords = ['cache', 'phone', 'email', 'cloud', 'emoji', 'zelle', 'spam', 'word'];
    const spellPool = endlessPool(content, dateOfDay(5));
    for (let i = 0; i < spellPool.length; i++) content.items[spellPool[i]].term = spellWords[i % spellWords.length];
    let run = startEndless(newState(), content, dateOfDay(5), 1234);
    let tiles = 0;
    let previous: string | null = null;
    for (let i = 0; i < 400; i++) {
      const question = questionOf(run);
      if (question.kind === 'tiles') {
        tiles++;
        expect(canSpell(question.term)).toBe(true);
        expect(previous).not.toBe('tiles');
      } else if (previous !== null) {
        expect(question.kind).not.toBe(previous);
      }
      previous = question.kind;
      run = answerEndless(run, { choice: question.answer }).run;
      if (run.over) run = { ...run, over: false, hearts: 3 };
      run = nextEndlessQuestion(run, content);
    }
    const share = tiles / 400;
    expect(share).toBeGreaterThanOrEqual(0.15);
    expect(share).toBeLessThanOrEqual(0.35);
  });

  it('scores tiles from the reported score and clamps it', () => {
    const content = buildContent();
    const question = buildQuestion(content, 'claude', 'tiles', 'tile-score');
    const original = startEndless(newState(), content, dateOfDay(1), 125);
    const check = (tileScore: number | undefined, combo: number = 0) => {
      const run = { ...original, question, answered: false, combo, score: 0, xp: 0 };
      return answerEndless(run, { choice: question.answer, tileScore });
    };
    expect(check(18).points).toBe(18);
    expect(check(18, 2).points).toBe(36);
    expect(check(undefined).points).toBe(10);
    expect(check(99).points).toBe(18);
    expect(check(3).points).toBe(10);
    const wrong = answerEndless({ ...original, question, answered: false, combo: 4 }, { choice: '__wrong__', tileScore: 18 });
    expect(wrong.correct).toBe(false);
    expect(wrong.points).toBe(0);
    expect(wrong.run.hearts).toBe(2);
    expect(wrong.run.combo).toBe(0);
  });

  it('keeps tile runs deterministic for the same seed', () => {
    const content = buildContent({ days: 20, oldTechCount: 10 });
    const play = () => {
      let run = startEndless(newState(), content, dateOfDay(5), 126);
      const kinds: string[] = [];
      for (let i = 0; i < 80; i++) {
        const question = questionOf(run);
        kinds.push(question.kind);
        run = answerEndless(run, { choice: question.answer }).run;
        if (run.over) run = { ...run, over: false, hearts: 3 };
        run = nextEndlessQuestion(run, content);
      }
      return kinds;
    };
    expect(play()).toEqual(play());
  });

});
