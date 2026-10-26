// Builds content/jargle_words.txt, the list of words Daily Jargle accepts as guesses.
// Usage: node scripts/build-jargle-words.mjs <path to SCOWL's final folder>
// SCOWL: http://wordlist.aspell.net/ (see CREDITS.md for its license).

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node scripts/build-jargle-words.mjs <scowl-final-folder>');
  process.exit(1);
}

// Size 35 is SCOWL's "common words" level. Bigger levels add rare words and blow the size budget.
const MAX_LEVEL = 35;

const dir = resolve(sourceDir);
const words = new Set();
for (const name of readdirSync(dir)) {
  const match = /^(english|american)-words\.(\d+)$/.exec(name);
  if (!match || Number(match[2]) > MAX_LEVEL) continue;
  const text = readFileSync(join(dir, name), 'latin1');
  for (const line of text.split(/\r?\n/)) {
    if (/^[a-z]{4,7}$/.test(line)) words.add(line.toUpperCase());
  }
}

// The game also accepts a word when cutting a common ending leaves a listed word
// (see isKnownWord in web/src/ui/screens/jargleWords.ts, keep the two in step).
// So CLOUDS, MAKING and STOPPED don't need their own lines, which keeps the file small.
const ENDINGS = ['IES', 'IED', 'ING', 'ERS', 'ES', 'ED', 'ER', 'LY', 'S', 'D'];

function hasBase(base) {
  if (base.length < 4) return false;
  if (words.has(base)) return true;
  // A doubled last letter is dropped in words like STOPPED and RUNNING.
  if (base.length > 4 && base[base.length - 1] === base[base.length - 2]) {
    return words.has(base.slice(0, -1));
  }
  return false;
}

function coveredByEnding(word) {
  for (const ending of ENDINGS) {
    if (!word.endsWith(ending)) continue;
    const base = word.slice(0, -ending.length);
    if (hasBase(base)) return true;
    if (ending === 'ING' && hasBase(base + 'E')) return true;
    if ((ending === 'IES' || ending === 'IED') && hasBase(base + 'Y')) return true;
  }
  return false;
}

const kept = [];
for (const word of words) {
  if (!coveredByEnding(word)) kept.push(word);
}
kept.sort();

// Front coding: each line starts with how many letters it shares with the line before,
// then the rest. ABOUT after ABOUND is "4T". Sorted words share a lot, so this saves a third.
const lines = [];
let previous = '';
for (const word of kept) {
  let shared = 0;
  while (shared < previous.length && shared < word.length && previous[shared] === word[shared]) shared++;
  lines.push(shared + word.slice(shared));
  previous = word;
}
const output = lines.join('\n') + '\n';
writeFileSync(new URL('../content/jargle_words.txt', import.meta.url), output);
console.log(`Wrote ${kept.length} words (${words.size} before endings), ${gzipSync(output).length} bytes gzip`);
