// Web addresses the app shows or fetches. Real values come from VITE_* variables at build time;
// the defaults below are the real launch addresses, so a plain `npm run build` works.

const env = import.meta.env;

function pick(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

/** The public web address of the app, used in share lines and install steps. */
export const appUrl = pick(env.VITE_APP_URL, 'https://whyater.github.io/Jargle/');

/** Splits "a, b" into ["a", "b"], or uses the fallback list when the value is empty. */
function pickList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const list: string[] = [];
  const parts = value.split(',');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.length > 0) list.push(part);
  }
  return list.length > 0 ? list : fallback;
}

/** Where the native apps look for newer content, in order. They always start with their bundled copy. */
export const contentUrls = pickList(env.VITE_CONTENT_URLS, [
  'https://jargle.161-153-13-14.sslip.io/content/bundle.json',
  'https://whyater.github.io/Jargle/content/bundle.json',
]);

/** Base of the latest release downloads, with no slash at the end. */
export const releasesBase = pick(
  env.VITE_RELEASES_BASE,
  'https://github.com/Whyater/Jargle/releases/latest/download',
);

/** Adds a file name to the downloads base, with exactly one slash between them. */
export function releaseFile(name: string): string {
  let base = releasesBase;
  while (base.length > 0 && base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
  return base + '/' + name;
}

export const macInstallCmd = pick(
  env.VITE_MAC_INSTALL_CMD,
  'curl -fsSL https://whyater.github.io/Jargle/install.sh | bash',
);

export const winInstallCmd = pick(
  env.VITE_WIN_INSTALL_CMD,
  'irm https://whyater.github.io/Jargle/install.ps1 | iex',
);

export const macDownloadUrl = pick(env.VITE_MAC_DOWNLOAD_URL, releaseFile('Jargle-mac.dmg'));
export const winDownloadUrl = pick(env.VITE_WIN_DOWNLOAD_URL, releaseFile('Jargle-windows-setup.exe'));
export const androidApkUrl = pick(env.VITE_ANDROID_APK_URL, releaseFile('Jargle-android.apk'));

/** Optional address for "Something wrong? Tell us". Without it, the link opens a GitHub issue. */
export const feedbackEmail = pick(env.VITE_FEEDBACK_EMAIL, '');

/** Link for "Something wrong? Tell us" about one item. */
export function feedbackLink(itemId: string): string {
  const title = 'Problem with ' + itemId;
  if (feedbackEmail) return 'mailto:' + feedbackEmail + '?subject=' + encodeURIComponent('Jargle: ' + title);
  const body = 'Word: ' + itemId + '\n\nWhat looks wrong:\n\nWhere you saw it (a clue, a card, the meaning, a source):\n';
  return (
    'https://github.com/Whyater/Jargle/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body)
  );
}

/** Source code link for the About page. */
export const sourceUrl = pick(env.VITE_SOURCE_URL, 'https://github.com/Whyater/Jargle');

/** Judging runs until the district winner is announced; turn off with VITE_SHOW_JUDGES_LINE=0. */
export const showJudgesLine = env.VITE_SHOW_JUDGES_LINE !== '0';
