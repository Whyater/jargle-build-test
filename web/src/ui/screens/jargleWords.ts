// The guess word list. Loaded only by the Daily Jargle screen, so it is its own small download.
import wordsText from '../../../../content/jargle_words.txt?raw';

/**
 * Every word from the list plus `extra` (the daily answers and common words). Each line of the
 * file is front coded: a digit for how many letters it shares with the word before, then the rest.
 */
export function buildWordList(extra: string[]): Set<string> {
  const words = new Set<string>();
  let previous = '';
  for (const line of wordsText.split(/\r?\n/)) {
    if (!line) continue;
    const shared = Number(line[0]);
    const word = previous.slice(0, shared) + line.slice(1).toUpperCase();
    words.add(word);
    previous = word;
  }
  for (const word of extra) {
    if (word) words.add(word.toUpperCase());
  }
  return words;
}

function hasBase(words: Set<string>, word: string): boolean {
  if (word.length < 4) return false;
  if (words.has(word)) return true;
  // A doubled final consonant is removed in words such as STOPPED and RUNNING.
  if (word.length > 4 && word[word.length - 1] === word[word.length - 2]) {
    return words.has(word.slice(0, -1));
  }
  return false;
}

/** True if the guess is listed, or is a listed word plus a common ending (CLOUDS, MAKING, STOPPED). */
export function isKnownWord(words: Set<string>, guess: string): boolean {
  const word = guess.toUpperCase();
  if (words.has(word)) return true;

  const endings = ['IES', 'IED', 'ING', 'ERS', 'ES', 'ED', 'ER', 'LY', 'S', 'D'];
  for (const ending of endings) {
    if (!word.endsWith(ending)) continue;
    const base = word.slice(0, -ending.length);
    if (hasBase(words, base)) return true;
    if (ending === 'ING' && hasBase(words, base + 'E')) return true;
    if ((ending === 'IES' || ending === 'IED') && hasBase(words, base + 'Y')) return true;
  }
  return false;
}
