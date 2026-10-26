import { describe, expect, it } from 'vitest';
import { buildWordList, isKnownWord } from './jargleWords';

describe('jargle word list', () => {
  const words = buildWordList(['WIFI', 'EMOJI']);

  it('accepts common words and inflections', () => {
    for (const word of ['CLOUD', 'HOUSE', 'PLANT', 'TREES', 'MAKING', 'STOPPED', 'CITIES']) {
      expect(isKnownWord(words, word)).toBe(true);
    }
  });

  it('accepts puzzle extras and ignores case', () => {
    expect(isKnownWord(words, 'wifi')).toBe(true);
    expect(isKnownWord(words, 'emoji')).toBe(true);
  });

  it('rejects junk', () => {
    for (const word of ['QZXVK', 'AAAAA', 'ASDFG']) {
      expect(isKnownWord(words, word)).toBe(false);
    }
  });
});
