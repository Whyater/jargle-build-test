import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { dateOfDay } from './dates';
import { newState } from './state';
import {
  OLD_TECH_INTRO,
  PRACTICE_EMPTY,
  nextWord,
  oldTechList,
  practiceList,
} from './lists';

describe('practice and old tech lists', function () {
  it('lists practice newest first with labels', function () {
    const content = buildContent({ days: 4 });
    const state = newState();
    state.firstPlayDay = 1;
    state.finishedDays = [2];
    const list = practiceList(state, content, dateOfDay(4));

    expect(
      list.map(function (entry) {
        return entry.day;
      }),
    ).toEqual([3, 2, 1]);
    expect(list[0].label).toBe('Not finished yet');
    expect(list[1].label).toBe(content.items[content.schedule.days[1].term].term);
    expect(list[0].open).toBe(true);
    expect(list[0].topic).toBe(content.items[content.schedule.days[2].term].topic);
    expect(list[0].key).toBe('d:3');
    expect(list[0].date).toBe(dateOfDay(3));
  });

  it('does not show the current daily in practice', function () {
    const content = buildContent({ days: 3 });
    const state = newState();
    state.firstPlayDay = 1;
    const list = practiceList(state, content, dateOfDay(3));

    expect(
      list.map(function (entry) {
        return entry.day;
      }),
    ).toEqual([2, 1]);
  });

  it('returns an empty practice list before first play', function () {
    const state = newState();

    expect(practiceList(state, buildContent(), dateOfDay(3))).toEqual([]);
    expect(PRACTICE_EMPTY).toBe("No words yet. Each day's word appears here the next day.");
    expect(OLD_TECH_INTRO).toBe(
      'Guess the old tech from clues. You might know these better than Bud.',
    );
  });

  it('chooses the oldest unfinished practice entry', function () {
    const content = buildContent({ days: 3 });
    const state = newState();
    state.firstPlayDay = 1;
    state.finishedDays = [1, 2];
    const result = nextWord(state, content, 'practice', dateOfDay(4));

    expect('entry' in result).toBe(true);
    expect('entry' in result && result.entry.day).toBe(3);
  });

  it('returns the practice completion message', function () {
    const content = buildContent({ days: 3 });
    const state = newState();
    state.firstPlayDay = 1;
    state.finishedDays = [1, 2, 3];

    expect(nextWord(state, content, 'practice', dateOfDay(4))).toEqual({
      message: "You've done them all.",
    });
  });

  it('returns the first open unfinished old tech item', function () {
    const content = buildContent();
    const state = newState();
    state.soloDone = [content.oldTech[0]];
    const result = nextWord(state, content, 'oldtech', dateOfDay(1));

    expect('entry' in result).toBe(true);
    expect('entry' in result && result.entry.itemId).toBe(content.oldTech[1]);
  });

  it('returns the next old tech release message when all open items are done', function () {
    const content = buildContent();
    content.items[content.oldTech[1]].release_day = 3;
    const state = newState();
    state.soloDone = content.oldTech.slice(2);
    state.soloDone.push(content.oldTech[0]);

    const result = nextWord(state, content, 'oldtech', dateOfDay(1));

    expect(result).toEqual({ message: 'New old tech opens Tuesday, October 27.' });
  });

  it('returns the old tech completion message', function () {
    const content = buildContent();
    const state = newState();
    state.soloDone = content.oldTech.slice();

    expect(nextWord(state, content, 'oldtech', dateOfDay(1))).toEqual({
      message: "You've done them all.",
    });
  });

  it('locks old tech until its release day', function () {
    const content = buildContent();
    content.items[content.oldTech[1]].release_day = 3;
    const state = newState();
    const list = oldTechList(state, content, dateOfDay(1));

    expect(list[1].open).toBe(false);
    expect(list[1].lockLine).toBe('Opens Tuesday, October 27.');
    expect(nextWord(state, content, 'oldtech', dateOfDay(1))).toEqual({ entry: list[0] });
  });
});
