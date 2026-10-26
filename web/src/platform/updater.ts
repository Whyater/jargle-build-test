export const FIRST_CHECK_DELAY_MS = 8_000;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1_000;

export type UpdateState =
  | { kind: 'none' }
  | { kind: 'ready'; source: 'desktop' | 'web'; version: string }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'failed' };

type UpdateEvent = {
  event: string;
  data?: { contentLength?: number; chunkLength?: number };
};

type DesktopUpdate = {
  version: string;
  downloadAndInstall: (handler: (event: UpdateEvent) => void) => Promise<void>;
};

let state: UpdateState = { kind: 'none' };
let pendingUpdate: DesktopUpdate | null = null;
let dismissedVersion: string | null = null;
let checking = false;
let downloading = false;
let started = false;
let firstTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(state: UpdateState) => void>();
// Kept in a variable so tests can swap it (the browser won't let them replace location.reload).
let reloadPage = () => window.location.reload();

function setState(next: UpdateState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: (state: UpdateState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export function startUpdateChecks(): void {
  if (!isDesktopApp() || started) return;
  started = true;
  firstTimer = setTimeout(() => {
    firstTimer = null;
    void checkForUpdate();
    intervalTimer = setInterval(() => {
      void checkForUpdate();
    }, CHECK_EVERY_MS);
  }, FIRST_CHECK_DELAY_MS);
}

export async function checkForUpdate(): Promise<void> {
  if (!isDesktopApp() || checking || downloading) return;
  checking = true;
  try {
    const updater = await import('@tauri-apps/plugin-updater');
    const update = await updater.check();
    // A check that finishes after the player tapped Update must not reset the progress bar.
    if (update && !downloading) {
      const next = update as DesktopUpdate;
      if (dismissedVersion !== next.version) {
        pendingUpdate = next;
        setState({ kind: 'ready', source: 'desktop', version: next.version });
      }
    }
  } catch (_error) {
    // Updates are optional, so network and metadata errors stay quiet.
  } finally {
    checking = false;
  }
}

export async function installUpdate(): Promise<void> {
  if (state.kind === 'ready' && state.source === 'web') {
    if (typeof window !== 'undefined') reloadPage();
    return;
  }
  if (!pendingUpdate || downloading) return;
  downloading = true;
  setState({ kind: 'downloading', progress: null });
  let downloaded = 0;
  let contentLength: number | undefined;
  try {
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        contentLength = event.data?.contentLength;
        downloaded = 0;
        setState({ kind: 'downloading', progress: null });
      } else if (event.event === 'Progress') {
        downloaded += event.data?.chunkLength ?? 0;
        const progress = contentLength && contentLength > 0
          ? Math.max(0, Math.min(1, downloaded / contentLength))
          : null;
        setState({ kind: 'downloading', progress });
      } else if (event.event === 'Finished') {
        setState({ kind: 'downloading', progress: 1 });
      }
    });
    const process = await import('@tauri-apps/plugin-process');
    await process.relaunch();
  } catch (_error) {
    setState({ kind: 'failed' });
  } finally {
    downloading = false;
  }
}

export function dismissUpdate(): void {
  if (state.kind === 'ready' && state.source === 'desktop') dismissedVersion = state.version;
  setState({ kind: 'none' });
}

export function markWebUpdateReady(): void {
  if (state.kind === 'ready' || state.kind === 'downloading') return;
  setState({ kind: 'ready', source: 'web', version: '' });
}

// Test helper: use a fake reload.
export function setReloadForTests(fake: () => void): void {
  reloadPage = fake;
}

// Test helper: clear all updater state and timers.
export function resetUpdaterForTests(): void {
  if (firstTimer) clearTimeout(firstTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  state = { kind: 'none' };
  pendingUpdate = null;
  dismissedVersion = null;
  checking = false;
  downloading = false;
  started = false;
  firstTimer = null;
  intervalTimer = null;
  listeners.clear();
}
