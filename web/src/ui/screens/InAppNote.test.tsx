import { describe, expect, it } from 'vitest';
import { inAppNoteShows } from './InAppNote';
import type { SaveState } from '../../engine/types';

const save = { flags: { inAppNoteHidden: false } } as SaveState;
const instagramUserAgent = 'Mozilla/5.0 Instagram 320.0';
const chromeUserAgent = 'Mozilla/5.0 Chrome/120.0.0.0';

describe('inAppNoteShows', () => {
  it('shows for Instagram', () => {
    expect(inAppNoteShows(save, instagramUserAgent)).toBe(true);
  });

  it('hides for a normal browser', () => {
    expect(inAppNoteShows(save, chromeUserAgent)).toBe(false);
  });

  it('hides when the note was dismissed', () => {
    expect(inAppNoteShows({ flags: { inAppNoteHidden: true } } as SaveState, instagramUserAgent)).toBe(false);
  });

  it('hides without a save', () => {
    expect(inAppNoteShows(null, instagramUserAgent)).toBe(false);
  });
});
