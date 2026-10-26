import { describe, expect, it } from 'vitest';
import {
  canPlayAgain,
  cheerLine,
  shouldIgnoreNextClue,
  stripTextAfterTap,
  tallestMessage,
} from './roundLogic';
import type { ContentBundle } from '../../engine/types';

function contentWithMissLines(): ContentBundle {
  return {
    version: 1,
    items: {},
    lessons: [],
    oldTech: [],
    ptpExtras: [],
    schedule: { version: 1, days: [] },
    missLines: {
      either: [{ text: 'short' }],
      floyd: [{ text: 'this is the longest miss message in this fixture' }],
    },
    commonWords: [],
  };
}

describe('tallestMessage', () => {
  it('includes miss lines and fixed round messages', () => {
    const value = tallestMessage(contentWithMissLines());
    expect(value).toBe(
      "Clue 2 shown. 2 bars left. After a wrong guess, you can't reach the last clue. " +
        'Careful: a wrong guess now ends the round. It still counts.',
    );
  });

  it('can choose a longer content miss line', () => {
    const content = contentWithMissLines();
    content.missLines.either[0].text = 'x'.repeat(200);
    expect(tallestMessage(content)).toBe(content.missLines.either[0].text);
  });
});

describe('shouldIgnoreNextClue', () => {
  it('ignores taps inside the 700 ms window', () => {
    expect(shouldIgnoreNextClue(1000, 1699)).toBe(true);
    expect(shouldIgnoreNextClue(1000, 1700)).toBe(false);
  });

  it('allows the first tap', () => {
    expect(shouldIgnoreNextClue(null, 1000)).toBe(false);
  });
});

describe('stripTextAfterTap', () => {
  const warning = 'Careful: a wrong guess now ends the round. It still counts.';

  it('uses the result message first', () => {
    expect(stripTextAfterTap('old', 'new', warning, 'check')).toBe('new');
  });

  it('uses the warning when the result has no message', () => {
    expect(stripTextAfterTap('miss line', null, warning, 'check')).toBe(warning);
  });

  it('keeps the previous message when both are empty', () => {
    expect(stripTextAfterTap('miss line', null, null, 'check')).toBe('miss line');
    expect(stripTextAfterTap(null, null, null, 'check')).toBeNull();
  });

  it('uses the warning for a select when it applies', () => {
    expect(stripTextAfterTap('miss line', 'Selected. Now tap Check.', warning, 'select')).toBe(warning);
  });

  it('uses the select message when no warning applies', () => {
    expect(stripTextAfterTap('miss line', 'Selected. Now tap Check.', null, 'select')).toBe(
      'Selected. Now tap Check.',
    );
  });

  it('joins no-pick check message with the warning', () => {
    expect(stripTextAfterTap('miss line', 'Tap a word first.', warning, 'check')).toBe(
      'Tap a word first. ' + warning,
    );
  });

  it('keeps a wrong-check miss line over the warning', () => {
    expect(stripTextAfterTap('miss line', 'Ouch, try again.', warning, 'check')).toBe('Ouch, try again.');
  });

  it('does not add a warning twice to a next clue message', () => {
    const nextClue = 'Clue 2 shown. 2 bars left. ' + warning;
    expect(stripTextAfterTap('miss line', nextClue, warning, 'nextClue')).toBe(nextClue);
  });
});

describe('canPlayAgain', () => {
  it('allows past dailies, practice and old tech words', () => {
    expect(canPlayAgain('d:11', 'daily', 12)).toBe(true);
    expect(canPlayAgain('d:11', 'practice', 12)).toBe(true);
    expect(canPlayAgain('rotary-phone', 'oldtech', 12)).toBe(true);
  });

  it("never allows today's daily or Pass the Phone", () => {
    expect(canPlayAgain('d:12', 'daily', 12)).toBe(false);
    expect(canPlayAgain('ptp:1:2', 'ptp', 12)).toBe(false);
  });
});

describe('cheerLine', () => {
  it('uses the solved message only for solved rounds', () => {
    expect(cheerLine('solved')).toBe('You got it!');
    expect(cheerLine('learned')).toBe('Good try!');
  });
});
