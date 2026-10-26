import { describe, expect, it } from 'vitest';
import { seededRandom } from './text';
import {
  answerGroups, answerLetters, checkTiles, dealTiles, decoyCount, letterPoints, nextHint,
  shuffleTiles, tileScore,
} from './tiles';

describe('letter tiles', () => {
  it('normalizes letters and groups', () => {
    expect(answerLetters('cache')).toEqual(['C', 'A', 'C', 'H', 'E']);
    expect(answerLetters('Wi-Fi')).toEqual(['W', 'I', 'F', 'I']);
    expect(answerLetters('two factor')).toEqual(['T', 'W', 'O', 'F', 'A', 'C', 'T', 'O', 'R']);
    expect(answerLetters(' a-b ')).toEqual(['A', 'B']);
    expect(answerLetters('2FA code')).toEqual(['F', 'A', 'C', 'O', 'D', 'E']);
    expect(answerGroups('two factor')).toEqual([
      { letters: ['T', 'W', 'O'], after: ' ' }, { letters: ['F', 'A', 'C', 'T', 'O', 'R'], after: '' },
    ]);
    expect(answerGroups(' a-b ')).toEqual([{ letters: ['A'], after: '-' }, { letters: ['B'], after: '' }]);
    expect(answerGroups('cache')).toEqual([{ letters: ['C', 'A', 'C', 'H', 'E'], after: '' }]);
    expect(answerGroups('Wi-Fi')).toEqual([{ letters: ['W', 'I'], after: '-' }, { letters: ['F', 'I'], after: '' }]);
    expect(answerGroups('2FA code')).toEqual([{ letters: ['F', 'A'], after: ' ' }, { letters: ['C', 'O', 'D', 'E'], after: '' }]);
  });

  it('deals stable answer and decoy tiles', () => {
    expect(decoyCount(1)).toBe(0);
    expect(decoyCount(2)).toBe(1);
    expect(decoyCount(3)).toBe(2);
    const answer = answerLetters('cache');
    for (let difficulty = 1; difficulty <= 3; difficulty++) {
      const tiles = dealTiles('cache', difficulty, seededRandom('deal'));
      expect(tiles).toHaveLength(answer.length + decoyCount(difficulty));
      expect(tiles.filter((tile) => !tile.decoy).map((tile) => tile.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
      expect(tiles.filter((tile) => !tile.decoy).map((tile) => tile.letter).sort()).toEqual(answer.slice().sort());
      const decoys = tiles.filter((tile) => tile.decoy).map((tile) => tile.letter);
      expect(new Set(decoys).size).toBe(decoys.length);
      for (let i = 0; i < decoys.length; i++) expect(answer).not.toContain(decoys[i]);
    }
    expect(dealTiles('cache', 3, seededRandom('same'))).toEqual(dealTiles('cache', 3, seededRandom('same')));
  });

  it('does not deal a giveaway', () => {
    const stuck = () => 0.9999;
    const cat = dealTiles('cat', 1, stuck);
    expect(cat.filter((tile) => !tile.decoy).map((tile) => tile.letter).join('')).not.toBe('CAT');
    const abab = dealTiles('abab', 3, stuck);
    expect(abab.filter((tile) => !tile.decoy).map((tile) => tile.letter).join('')).not.toBe('ABAB');
    expect(abab.filter((tile) => !tile.decoy).map((tile) => tile.letter).sort()).toEqual(['A', 'A', 'B', 'B']);
    const full = dealTiles('abcdefghijklmnopqrstuvwxyz', 3, stuck);
    expect(full).toHaveLength(26);
    expect(full.every((tile) => tile.letter >= 'A' && tile.letter <= 'Z')).toBe(true);
    const crowded = dealTiles('abcdefghijklmnopqrstuvwxy', 3, seededRandom('z'));
    expect(crowded.every((tile) => tile.letter >= 'A' && tile.letter <= 'Z')).toBe(true);

    for (const answer of ['cat', 'phishing', 'router']) {
      for (let seed = 0; seed < 500; seed++) {
        const tiles = dealTiles(answer, 3, seededRandom(answer + seed));
        expect(tiles.filter((tile) => !tile.decoy).map((tile) => tile.letter).join('')).not.toBe(answer.toUpperCase());
      }
    }
    expect(() => dealTiles('aaa', 3, () => 0)).not.toThrow();
    expect(() => dealTiles('a', 3, () => 0)).not.toThrow();
  });

  it('shuffles tiles without losing objects', () => {
    const stuck = () => 0.9999;
    const mixed = [{ id: 0, letter: 'C', decoy: false }, { id: 1, letter: 'A', decoy: false }, { id: 2, letter: 'T', decoy: false }];
    const moved = shuffleTiles(mixed, stuck);
    expect(moved.map((tile) => tile.letter)).not.toEqual(['C', 'A', 'T']);
    expect(new Set(moved)).toEqual(new Set(mixed));

    const tiles = dealTiles('cat', 1, seededRandom('x'));
    const shuffled = shuffleTiles(tiles, seededRandom('y'));
    expect(shuffled).toHaveLength(tiles.length);
    expect(new Set(shuffled)).toEqual(new Set(tiles));
    expect(shuffled.map((tile) => tile.letter).join('')).not.toBe(tiles.map((tile) => tile.letter).join(''));
    expect(() => shuffleTiles([{ id: 0, letter: 'A', decoy: false }, { id: 1, letter: 'A', decoy: false }], () => 0)).not.toThrow();
  });

  it('checks placements and hints', () => {
    expect(checkTiles('cache', ['C', 'A', 'C', 'H', 'E'])).toBe(true);
    expect(checkTiles('cache', ['c', 'a', 'c', 'h', 'e'])).toBe(true);
    expect(checkTiles('cache', ['C', 'A', null, 'H', 'E'])).toBe(false);
    expect(checkTiles('cache', ['C', 'A', 'X', 'H', 'E'])).toBe(false);
    expect(checkTiles('Wi-Fi', ['W', 'I', 'F', 'I'])).toBe(true);
    expect(nextHint('cache', [null, null, null, null, null])).toEqual({ slot: 0, letter: 'C' });
    expect(nextHint('cache', ['C', 'A', 'X', null, null])).toEqual({ slot: 2, letter: 'C' });
    expect(nextHint('cache', ['C', 'A', 'C', 'H', 'E'])).toBe(null);
  });

  it('scores speed and hints at the boundaries', () => {
    expect(tileScore({ correct: false, ms: 5000, hintsUsed: 0 })).toBe(0);
    expect(tileScore({ correct: true, ms: 5000, hintsUsed: 0 })).toBe(18);
    expect(tileScore({ correct: true, ms: 5000, hintsUsed: 1 })).toBe(15);
    expect(tileScore({ correct: true, ms: 10000, hintsUsed: 0 })).toBe(15);
    expect(tileScore({ correct: true, ms: 20000, hintsUsed: 0 })).toBe(13);
    expect(tileScore({ correct: true, ms: 7999, hintsUsed: 1 })).toBe(15);
    expect(tileScore({ correct: true, ms: 8000, hintsUsed: 1 })).toBe(12);
    expect(tileScore({ correct: true, ms: 14999, hintsUsed: 1 })).toBe(12);
    expect(tileScore({ correct: true, ms: 15000, hintsUsed: 1 })).toBe(10);
    expect(tileScore({ correct: true, ms: NaN, hintsUsed: 0 })).toBe(13);
  });

  it('returns Scrabble points', () => {
    expect(letterPoints('A')).toBe(1);
    expect(letterPoints('q')).toBe(10);
    expect(letterPoints('?')).toBe(0);
  });
});
