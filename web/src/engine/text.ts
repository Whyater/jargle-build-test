// Small text helpers shared by every screen.

/** "1 bar", "2 bars". Every count uses the singular at 1. */
export function plural(n: number, one: string, many: string): string {
  return n + ' ' + (n === 1 ? one : many);
}

/** A small seeded random number generator, so shuffles are the same for everyone. */
export function seededRandom(seedText: string): () => number {
  // FNV-1a hash of the text gives the starting seed.
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  // Mulberry32: one step per call, returns a number in [0, 1).
  return function next() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle with a fixed seed. Returns a new array. */
export function seededShuffle<T>(list: T[], seedText: string): T[] {
  const result = list.slice();
  const random = seededRandom(seedText);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
