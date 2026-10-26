// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, shareOrCopy } from './share';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shareOrCopy', () => {
  it('returns cancelled when sharing is aborted', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(Object.assign(new Error('closed'), { name: 'AbortError' })),
    });
    expect(await shareOrCopy('hello')).toBe('cancelled');
  });

  it('uses the clipboard when sharing is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    expect(await shareOrCopy('hello')).toBe('copied');
  });

  it('fails when clipboard and execCommand both fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('no clipboard')) },
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) });
    expect(await copyText('hello')).toBe(false);
    expect(await shareOrCopy('hello')).toBe('failed');
  });
});
