import { describe, expect, it } from 'vitest';
import { workerIsForOtherBuild } from './sw-register';

describe('workerIsForOtherBuild', () => {
  it('stays quiet for a worker made for this same build', () => {
    expect(workerIsForOtherBuild('https://whyater.github.io/Jargle/sw.js?v=index-AAA.js', 'index-AAA.js')).toBe(false);
  });

  it('spots a worker from a newer build', () => {
    expect(workerIsForOtherBuild('https://whyater.github.io/Jargle/sw.js?v=index-BBB.js', 'index-AAA.js')).toBe(true);
  });

  it('treats an old worker without a version as another build', () => {
    expect(workerIsForOtherBuild('https://whyater.github.io/Jargle/sw.js', 'index-AAA.js')).toBe(true);
  });
});
