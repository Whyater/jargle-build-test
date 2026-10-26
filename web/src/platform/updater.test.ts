// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }));

import {
  CHECK_EVERY_MS,
  FIRST_CHECK_DELAY_MS,
  checkForUpdate,
  dismissUpdate,
  getUpdateState,
  installUpdate,
  isDesktopApp,
  markWebUpdateReady,
  resetUpdaterForTests,
  setReloadForTests,
  startUpdateChecks,
  subscribeUpdate,
} from './updater';

type TestUpdate = {
  version: string;
  downloadAndInstall: (listener: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>;
};
type UpdateListener = Parameters<TestUpdate['downloadAndInstall']>[0];

function setDesktop(value: boolean) {
  if (value) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  } else {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  }
}

function makeUpdate(version: string): TestUpdate {
  return { version, downloadAndInstall: mocks.downloadAndInstall };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetUpdaterForTests();
  setDesktop(false);
});

afterEach(() => {
  vi.useRealTimers();
  setDesktop(false);
});

describe('update checks', () => {
  it('does not check when the app is not desktop', async () => {
    startUpdateChecks();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS + CHECK_EVERY_MS);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it('checks after eight seconds and then every six hours', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(null);
    startUpdateChecks();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS - 1);
    expect(mocks.check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(mocks.check).toHaveBeenCalledTimes(2);
  });

  it('keeps none when no update is available', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(null);
    await checkForUpdate();
    expect(getUpdateState()).toEqual({ kind: 'none' });
  });

  it('shows a returned desktop update', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    await checkForUpdate();
    expect(getUpdateState()).toEqual({ kind: 'ready', source: 'desktop', version: '2.3.0' });
  });

  it('swallows check errors', async () => {
    setDesktop(true);
    mocks.check.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate()).resolves.toBeUndefined();
    expect(getUpdateState()).toEqual({ kind: 'none' });
  });

  it('does not check twice when the first check is still running', async () => {
    setDesktop(true);
    let resolveCheck: (value: null) => void = () => undefined;
    mocks.check.mockReturnValue(new Promise<null>((resolve) => { resolveCheck = resolve; }));
    const first = checkForUpdate();
    const second = checkForUpdate();
    // The plugin loads with a dynamic import, so wait for it before counting.
    await vi.dynamicImportSettled();
    expect(mocks.check).toHaveBeenCalledTimes(1);
    resolveCheck(null);
    await Promise.all([first, second]);
  });

  it('hides the same version after Later', async () => {
    setDesktop(true);
    const update = makeUpdate('2.3.0');
    mocks.check.mockResolvedValue(update);
    await checkForUpdate();
    dismissUpdate();
    await checkForUpdate();
    expect(getUpdateState()).toEqual({ kind: 'none' });
  });

  it('shows a newer version after Later', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    await checkForUpdate();
    dismissUpdate();
    mocks.check.mockResolvedValue(makeUpdate('2.4.0'));
    await checkForUpdate();
    expect(getUpdateState()).toEqual({ kind: 'ready', source: 'desktop', version: '2.4.0' });
  });

  it('does not start checks twice', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(null);
    startUpdateChecks();
    startUpdateChecks();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS);
    expect(mocks.check).toHaveBeenCalledTimes(1);
  });
});

describe('installing updates', () => {
  it('reports download progress and relaunches', async () => {
    setDesktop(true);
    const update = makeUpdate('2.3.0');
    mocks.check.mockResolvedValue(update);
    mocks.downloadAndInstall.mockImplementation(async (listener: UpdateListener) => {
      listener({ event: 'Started', data: { contentLength: 200 } });
      listener({ event: 'Progress', data: { chunkLength: 100 } });
      expect(getUpdateState()).toEqual({ kind: 'downloading', progress: 0.5 });
      listener({ event: 'Finished' });
      expect(getUpdateState()).toEqual({ kind: 'downloading', progress: 1 });
    });
    await checkForUpdate();
    await installUpdate();
    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
  });

  it('uses null progress when the size is unknown', async () => {
    setDesktop(true);
    const update = makeUpdate('2.3.0');
    mocks.check.mockResolvedValue(update);
    mocks.downloadAndInstall.mockImplementation(async (listener: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => {
      listener({ event: 'Started' });
      expect(getUpdateState()).toEqual({ kind: 'downloading', progress: null });
    });
    await checkForUpdate();
    await installUpdate();
  });

  it('sets failed when downloading throws', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    mocks.downloadAndInstall.mockRejectedValue(new Error('download failed'));
    await checkForUpdate();
    await installUpdate();
    expect(getUpdateState()).toEqual({ kind: 'failed' });
  });

  it('retries a failed install with the kept update', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    mocks.downloadAndInstall.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined);
    await checkForUpdate();
    await installUpdate();
    await installUpdate();
    expect(mocks.downloadAndInstall).toHaveBeenCalledTimes(2);
  });

  it('reloads for a web update', async () => {
    const reload = vi.fn();
    setReloadForTests(reload);
    markWebUpdateReady();
    expect(getUpdateState()).toEqual({ kind: 'ready', source: 'web', version: '' });
    await installUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not replace a desktop update with a web update', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    await checkForUpdate();
    markWebUpdateReady();
    expect(getUpdateState()).toEqual({ kind: 'ready', source: 'desktop', version: '2.3.0' });
  });
});

describe('store listeners', () => {
  it('subscribes and unsubscribes listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUpdate(listener);
    markWebUpdateReady();
    expect(listener).toHaveBeenCalledWith({ kind: 'ready', source: 'web', version: '' });
    unsubscribe();
    dismissUpdate();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports whether the app is desktop', () => {
    expect(isDesktopApp()).toBe(false);
    setDesktop(true);
    expect(isDesktopApp()).toBe(true);
  });
});

describe('a check that finishes during a download', () => {
  it('keeps showing the progress bar', async () => {
    setDesktop(true);
    mocks.check.mockResolvedValue(makeUpdate('2.3.0'));
    await checkForUpdate();
    // The download never finishes in this test, so the state stays on downloading.
    mocks.downloadAndInstall.mockReturnValue(new Promise<void>(() => undefined));
    void installUpdate();
    expect(getUpdateState().kind).toBe('downloading');
    mocks.check.mockResolvedValue(makeUpdate('2.4.0'));
    await checkForUpdate();
    expect(getUpdateState().kind).toBe('downloading');
  });
});
