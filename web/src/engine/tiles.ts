// Letter tiles: build a word from shuffled letter tiles, like a Scrabble rack.
// Pure: randomness comes in as a function, so a deal can be replayed from a seed.

/** One letter tile. `id` is stable for the whole game; `decoy` tiles are not part of the answer. */
export interface Tile { id: number; letter: string; decoy: boolean; }

/** A run of letters in the answer plus the text after it. */
export interface TileGroup { letters: string[]; after: string; }

// Scoring: 10 for a right word, +5 under 8 seconds or +2 under 15, +3 with no hint.
export const TILE_BASE = 10;
export const TILE_FAST_MS = 8000;
export const TILE_FAST_BONUS = 5;
export const TILE_QUICK_MS = 15000;
export const TILE_QUICK_BONUS = 2;
export const TILE_NO_HINT_BONUS = 3;

/** Decoy tiles by difficulty: 0 at 1, 1 at 2, 2 at 3. */
export function decoyCount(difficulty: number): number {
  if (difficulty <= 1) return 0;
  if (difficulty === 2) return 1;
  return 2;
}

function isLetter(char: string): boolean {
  return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z');
}

/** The answer's letters, uppercased, A to Z only. "Wi-Fi" gives W, I, F, I. */
export function answerLetters(answer: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < answer.length; i++) {
    if (isLetter(answer[i])) result.push(answer[i].toUpperCase());
  }
  return result;
}

/** The answer split into words, with the text between them (a space or a dash) kept in `after`. */
export function answerGroups(answer: string): TileGroup[] {
  const groups: TileGroup[] = [];
  let i = 0;
  while (i < answer.length) {
    while (i < answer.length && !isLetter(answer[i])) i++;
    if (i >= answer.length) break;
    const letters: string[] = [];
    while (i < answer.length && isLetter(answer[i])) {
      letters.push(answer[i].toUpperCase());
      i++;
    }
    const start = i;
    while (i < answer.length && !isLetter(answer[i])) i++;
    groups.push({ letters, after: i < answer.length ? answer.slice(start, i) : '' });
  }
  return groups;
}

/** Fisher-Yates shuffle: walk from the end, swap each item with a random earlier one. */
function shuffled<T>(items: T[], random: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/** True if the real (non-decoy) tiles, read left to right, already spell the answer. */
function spellsAnswer(tiles: Tile[], letters: string[]): boolean {
  const shown: string[] = [];
  for (let i = 0; i < tiles.length; i++) if (!tiles[i].decoy) shown.push(tiles[i].letter);
  if (shown.length !== letters.length) return false;
  for (let i = 0; i < letters.length; i++) if (shown[i] !== letters[i]) return false;
  return true;
}

/**
 * The tiles for one game: every answer letter plus the decoys, shuffled.
 * A shuffle that gives the answer away is redone; very short or one-letter words cannot avoid it.
 */
export function dealTiles(answer: string, difficulty: number, random: () => number): Tile[] {
  const letters = answerLetters(answer);
  const tiles: Tile[] = [];
  for (let i = 0; i < letters.length; i++) tiles.push({ id: i, letter: letters[i], decoy: false });
  const used: Record<string, boolean> = {};
  for (let i = 0; i < letters.length; i++) used[letters[i]] = true;
  const common = 'ETAOINSRLDCUMPHGBYKW';
  let nextId = letters.length;
  for (let i = 0; i < decoyCount(difficulty); i++) {
    const choices: string[] = [];
    for (let j = 0; j < common.length; j++) if (!used[common[j]]) choices.push(common[j]);
    if (choices.length === 0) {
      for (let j = 0; j < 26; j++) {
        const letter = String.fromCharCode(65 + j);
        if (!used[letter]) choices.push(letter);
      }
    }
    if (choices.length === 0) break;
    const letter = choices[Math.floor(random() * choices.length)];
    used[letter] = true;
    tiles.push({ id: nextId, letter, decoy: true });
    nextId++;
  }
  let result: Tile[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    result = shuffled(tiles, random);
    if (letters.length <= 1 || new Set(letters).size <= 1 || !spellsAnswer(result, letters)) return result;
  }
  if (letters.length > 1 && new Set(letters).size > 1) {
    let first = -1;
    for (let i = 0; i < result.length; i++) {
      if (!result[i].decoy) {
        if (first < 0) first = i;
        else if (result[i].letter !== result[first].letter) {
          const temp = result[first];
          result[first] = result[i];
          result[i] = temp;
          break;
        }
      }
    }
  }
  return result;
}

/** A new order for the tiles that looks different from the old one when it can. */
export function shuffleTiles(tiles: Tile[], random: () => number): Tile[] {
  const different = new Set(tiles.map((tile) => tile.letter)).size >= 2;
  const original = tiles.map((tile) => tile.letter).join('');
  let result = tiles.slice();
  for (let attempt = 0; attempt < 10; attempt++) {
    result = shuffled(tiles, random);
    if (!different || result.map((tile) => tile.letter).join('') !== original) return result;
  }
  if (different && result.length > 1) return result.slice(1).concat(result.slice(0, 1));
  return result;
}

/** True when the placed letters spell the answer. An empty slot is never right. */
export function checkTiles(answer: string, placed: (string | null)[]): boolean {
  const letters = answerLetters(answer);
  if (placed.length !== letters.length) return false;
  for (let i = 0; i < letters.length; i++) if (!placed[i] || placed[i]!.toUpperCase() !== letters[i]) return false;
  return true;
}

/** The first slot that is empty or wrong, and the letter that belongs there. Null when all are right. */
export function nextHint(answer: string, placed: (string | null)[]): { slot: number; letter: string } | null {
  const letters = answerLetters(answer);
  for (let i = 0; i < letters.length; i++) {
    if (!placed[i] || placed[i]!.toUpperCase() !== letters[i]) return { slot: i, letter: letters[i] };
  }
  return null;
}

/** Points for one game: 0 when wrong, else 10 to 18. A broken time (NaN or negative) gets no speed bonus. */
export function tileScore(result: { correct: boolean; ms: number; hintsUsed: number }): number {
  if (!result.correct) return 0;
  let score = TILE_BASE;
  if (Number.isFinite(result.ms) && result.ms >= 0 && result.ms < TILE_FAST_MS) score += TILE_FAST_BONUS;
  else if (Number.isFinite(result.ms) && result.ms >= 0 && result.ms < TILE_QUICK_MS) score += TILE_QUICK_BONUS;
  if (result.hintsUsed === 0) score += TILE_NO_HINT_BONUS;
  return score;
}

// Scrabble letter values, for the little number in each tile's corner.
const POINTS: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export function letterPoints(letter: string): number {
  return POINTS[letter.toUpperCase()] || 0;
}
