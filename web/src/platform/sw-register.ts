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
      navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(buildId), { scope: './' }).catch(() => undefined);
    } catch (_error) {
      // Some embedded browsers throw instead of rejecting. The app works without offline mode.
    }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
