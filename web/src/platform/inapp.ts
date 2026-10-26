export function inAppBrowserName(userAgent: string): string | null {
  const tokens: Array<[string, string]> = [
    ['MicroMessenger', 'WeChat'],
    ['Messenger', 'Messenger'],
    ['FBAN', 'Facebook'],
    ['FBAV', 'Facebook'],
    ['Instagram', 'Instagram'],
    ['TikTok', 'TikTok'],
    ['musical_ly', 'TikTok'],
    ['Line/', 'LINE'],
    ['Snapchat', 'Snapchat'],
  ];

  for (const [token, name] of tokens) {
    if (userAgent.indexOf(token) !== -1) return name;
  }
  return null;
}
