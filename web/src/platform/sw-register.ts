import { markWebUpdateReady } from './updater';

/** True when a service worker was made for a different build than the page that is running. */
export function workerIsForOtherBuild(scriptURL: string, buildId: string): boolean {
  return scriptURL.indexOf('v=' + encodeURIComponent(buildId)) < 0;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof location === 'undefined' || (location.protocol !== 'https:' && location.protocol !== 'http:')) return;
  // The desktop app ships its own files, so a service worker would only serve stale copies there.
  if ((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return;
  let buildId = 'dev';
  try {
    const parts = import.meta.url.split('/');
    const file = parts[parts.length - 1];
    if (file) buildId = file.split('?')[0] || 'dev';
  } catch (_error) {
    buildId = 'dev';
  }
  const register = () => {
    try {
      // sw.js takes over open pages right away. If the new worker belongs to a newer build than
      // this page (for example a deploy while this tab stayed open), ask the player to refresh.
      // A worker for this same build (first visit, or the page already loaded the new files) stays quiet.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        const worker = navigator.serviceWorker.controller;
        if (worker && workerIsForOtherBuild(worker.scriptURL, buildId)) markWebUpdateReady();
      });
      navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(buildId), { scope: './' }).catch(() => undefined);
    } catch (_error) {
      // Some embedded browsers throw instead of rejecting. The app works without offline mode.
    }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
