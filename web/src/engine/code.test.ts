import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { dateOfDay } from './dates';
import { newState } from './state';
import { decodeProgressCode, encodeProgressCode } from './code';
import { dealPtpSet } from './ptp';

function makeState() {
  const state = newState();
  state.countedDays = [1, 3, 30];
  state.finishedDays = [1, 2, 30];
  state.soloDone = ['rotary-phone', 'floppy-disk'];
  state.lessons['make-a-strong-password'] = { card: 0, answers: [], finished_on: dateOfDay(4) };
  state.ptpTotal = 9;
  state.ptpBest = 3;
  state.firstPlayDay = 2;
  state.badges['taught-someone'] = dateOfDay(5);
  return state;
}

describe('restore progress codes', () => {
  it('restores each finished daily with its real finish date', () => {
    const content = buildContent({ days: 10 });
    const source = newState();
    source.finishedDays = [1, 3];
    const code = encodeProgressCode(source, content, dateOfDay(10));
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const loaded = decoded.apply(newState(), content, dateOfDay(10));
    expect(loaded.lastFinished).toEqual({
      'two-factor-login': dateOfDay(1),
      screenshot: dateOfDay(3),
    });
  });

  it('restores finished words for Pass the Phone picking', () => {
    const content = buildContent();
    const source = newState();
    source.finishedDays = [1];
    source.soloDone = ['rotary-phone'];
    const code = encodeProgressCode(source, content, dateOfDay(2));
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const loaded = decoded.apply(newState(), content, dateOfDay(2));
    expect(loaded.finishedDays).toEqual([1]);
    expect(loaded.lastFinished).toEqual({
      'two-factor-login': dateOfDay(1),
      'rotary-phone': dateOfDay(1),
    });
    expect(dealPtpSet(loaded, content, dateOfDay(2))).toEqual([
      'two-factor-login',
      'cassette-tape',
      'ptp-1',
      'dewey-decimal-system',
    ]);
  });

  it('round trips progress and merges into a fresh state', () => {
    const content = buildContent({ days: 30 });
    const original = makeState();
    const code = encodeProgressCode(original, content, dateOfDay(30));
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const loaded = decoded.apply(newState(), content, dateOfDay(30));
    expect(loaded.countedDays).toEqual(
      expect.arrayContaining(original.countedDays || []),
    );
    expect(loaded.finishedDays).toEqual(
      expect.arrayContaining(original.finishedDays || []),
    );
    expect(loaded.soloDone).toEqual(
      expect.arrayContaining(original.soloDone || []),
    );
    expect(loaded.lessons['make-a-strong-password'].finished_on).toBe(dateOfDay(29));
    expect(loaded.ptpTotal).toBe(9);
    expect(loaded.ptpBest).toBe(3);
    expect(loaded.firstPlayDay).toBe(2);
    expect(loaded.badges['taught-someone']).toBe(dateOfDay(30));
  });

  it('round trips on the launch day and a later capped day', () => {
    const content = buildContent({ days: 120, oldTechCount: 20, allLessons: true });
    const source = makeState();
    source.countedDays = [1, 30, 120];
    source.finishedDays = [2, 30, 120];
    source.soloDone = content.oldTech.slice(0, 20);
    source.lessons['make-a-strong-password'] = {
      card: 2,
      answers: ['Right one'],
      finished_on: dateOfDay(10),
    };
    source.lessons['turn-on-two-factor-login'] = {
      card: 1,
      answers: [],
      finished_on: dateOfDay(11),
    };

    for (const day of [1, 120]) {
      const code = encodeProgressCode(source, content, dateOfDay(day));
      const decoded = decodeProgressCode(code);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) continue;
      const loaded = decoded.apply(newState(), content, dateOfDay(day));
      const countedThroughDay = (source.countedDays || []).filter((n) => n <= day);
      const finishedThroughDay = (source.finishedDays || []).filter((n) => n <= day);
      expect(loaded.countedDays).toEqual(
        expect.arrayContaining(countedThroughDay),
      );
      expect(loaded.finishedDays).toEqual(
        expect.arrayContaining(finishedThroughDay),
      );
      expect(loaded.soloDone).toEqual(
        expect.arrayContaining(source.soloDone || []),
      );
      expect(loaded.ptpTotal).toBe(source.ptpTotal);
      expect(loaded.ptpBest).toBe(source.ptpBest);
      expect(loaded.firstPlayDay).toBe(source.firstPlayDay);
      expect(loaded.badges['taught-someone']).toBe(dateOfDay(day));
    }
  });

  it('uses the specified body lengths and groups', () => {
    const content = buildContent({ days: 120 });
    const state = newState();
    for (const day of [1, 30, 120]) {
      const code = encodeProgressCode(state, content, dateOfDay(day));
      const body = code.slice(5).replace(/-/g, '');
      const expected = day === 1 ? 18 : day === 30 ? 30 : 66;
      expect(body.length).toBe(expected);
      expect(
        code.slice(5).split('-').every((group) => group.length === 4 || group.length === 2),
      ).toBe(true);
    }
  });

  it('reads case, spaces, hyphens, and Crockford aliases', () => {
    const content = buildContent({ days: 30 });
    const code = encodeProgressCode(makeState(), content, dateOfDay(30));
    const altered = code
      .toLowerCase()
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/-/g, ' - ');
    const result = decodeProgressCode(altered);
    expect(result.ok).toBe(true);
  });

  it('reports format, newer, and typo errors', () => {
    expect(decodeProgressCode('hello')).toEqual({ ok: false, error: 'format' });
    expect(decodeProgressCode('JRG2-0000')).toEqual({ ok: false, error: 'newer' });
    expect(decodeProgressCode('JRG1-0000')).toEqual({ ok: false, error: 'typo' });
    expect(decodeProgressCode('JRG1-U000')).toEqual({ ok: false, error: 'typo' });
  });

  it('merges without mutating the source state and keeps settings and review', () => {
    const content = buildContent({ days: 30, allLessons: true });
    const source = makeState();
    source.settings.textSize = 'large';
    source.review['rotary-phone'] = [dateOfDay(40)];
    const before = JSON.stringify(source);
    const code = encodeProgressCode(source, content, dateOfDay(30));
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const target = newState();
    target.firstPlayDay = 1;
    target.review['existing'] = [dateOfDay(31)];
    const merged = decoded.apply(target, content, dateOfDay(30));
    expect(JSON.stringify(source)).toBe(before);
    expect(merged.settings.textSize).toBe('normal');
    expect(merged.firstPlayDay).toBe(1);
    expect(merged.review.existing).toEqual([dateOfDay(31)]);
    expect(merged.review['two-factor-login']).toEqual([dateOfDay(30)]);
  });

  it('does not alias a lesson numbered five into the next topic', () => {
    const content = buildContent({ days: 30, allLessons: true });
    const lessonFive = { ...content.lessons[0], id: 'locks-and-keys-five', number: 5 };
    content.lessons.push(lessonFive);
    const source = newState();
    source.lessons[lessonFive.id] = {
      card: 0,
      answers: [],
      finished_on: dateOfDay(5),
    };
    const code = encodeProgressCode(source, content, dateOfDay(30));
    const decoded = decodeProgressCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const loaded = decoded.apply(newState(), content, dateOfDay(30));
    expect(loaded.lessons[lessonFive.id]).toBeUndefined();
  });

  it('catches nearly every one-character body typo', () => {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const content = buildContent({ days: 120 });
    const expected = { 1: 99.46, 30: 98.39, 120: 99.27 } as Record<number, number>;
    for (const day of [1, 30, 120]) {
      const code = encodeProgressCode(newState(), content, dateOfDay(day));
      const body = code.slice(5).replace(/-/g, '');
      let caught = 0;
      let total = 0;
      for (let i = 0; i < body.length; i++) {
        for (let j = 0; j < alphabet.length; j++) {
          if (alphabet[j] === body[i]) continue;
          total++;
          const changed = body.slice(0, i) + alphabet[j] + body.slice(i + 1);
          const result = decodeProgressCode('JRG1-' + changed);
          if (!result.ok && result.error === 'typo') caught++;
        }
      }
      const rate = (caught / total) * 100;
      expect(Math.abs(rate - expected[day])).toBeLessThanOrEqual(0.1);
    }
  });
});
