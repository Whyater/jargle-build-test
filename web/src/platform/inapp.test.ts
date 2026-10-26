import { describe, expect, it } from 'vitest';
import { inAppBrowserName } from './inapp';

describe('inAppBrowserName', () => {
  it.each([
    ['FBAN/FBIOS', 'Facebook'],
    ['FBAV/400.0', 'Facebook'],
    ['Instagram 320.0', 'Instagram'],
    ['MessengerForiOS', 'Messenger'],
    ['TikTok 35.0', 'TikTok'],
    ['musical_ly_35.0', 'TikTok'],
    ['Line/13.0', 'LINE'],
    ['Snapchat/12.0', 'Snapchat'],
    ['MicroMessenger/8.0', 'WeChat'],
  ])('%s is %s', (userAgent, expected) => {
    expect(inAppBrowserName(userAgent)).toBe(expected);
  });

  it('returns null for regular browsers', () => {
    expect(inAppBrowserName('Mozilla/5.0 Safari/605.1.15')).toBeNull();
    expect(inAppBrowserName('Mozilla/5.0 Chrome/120.0.0.0')).toBeNull();
  });

  it('checks WeChat before Messenger', () => {
    expect(inAppBrowserName('MicroMessenger/8.0')).toBe('WeChat');
  });
});
