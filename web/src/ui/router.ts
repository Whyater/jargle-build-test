import { useEffect, useState } from 'preact/hooks';

export interface Route {
  name: string;
  param: string | null;
}

type RouteName =
  | 'home'
  | 'play'
  | 'review'
  | 'learn'
  | 'lesson'
  | 'practice'
  | 'oldtech'
  | 'ptp'
  | 'badges'
  | 'settings'
  | 'how'
  | 'about'
  | 'code'
  | 'codeUse'
  | 'get'
  | 'gallery'
  | 'me'
  | 'endless';

const simplePaths: Record<string, RouteName> = {
  review: 'review',
  learn: 'learn',
  practice: 'practice',
  oldtech: 'oldtech',
  ptp: 'ptp',
  badges: 'badges',
  settings: 'settings',
  how: 'how',
  about: 'about',
  code: 'code',
  get: 'get',
  gallery: 'gallery',
  me: 'me',
  endless: 'endless',
};

const listeners = new Set<() => void>();

const depthKey = 'jargleDepth';
let currentDepth = 0;

function getDepth(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null;
  const depth = (state as { jargleDepth?: unknown })[depthKey];
  return typeof depth === 'number' && Number.isFinite(depth) && depth >= 0 ? depth : null;
}

function setDepth(depth: number): void {
  window.history.replaceState({ jargleDepth: depth }, '', window.location.href);
  currentDepth = depth;
}

if (getDepth(window.history.state) === null) setDepth(0);
else currentDepth = getDepth(window.history.state) as number;

window.addEventListener('popstate', () => {
  const depth = getDepth(window.history.state);
  if (depth !== null) currentDepth = depth;
});

window.addEventListener('hashchange', () => {
  const depth = getDepth(window.history.state);
  if (depth === null) setDepth(currentDepth + 1);
  else currentDepth = depth;
});

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function parseHash(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/') {
    return { name: 'home', param: null };
  }

  if (hash.indexOf('#/') !== 0) {
    return { name: 'notFound', param: null };
  }

  const path = hash.slice(2);
  if (path === 'code/use') {
    return { name: 'codeUse', param: null };
  }

  const parts = path.split('/');
  if (parts.length === 1 && Object.prototype.hasOwnProperty.call(simplePaths, parts[0])) {
    return { name: simplePaths[parts[0]], param: null };
  }

  if (parts.length === 2 && (parts[0] === 'play' || parts[0] === 'lesson') && parts[1] !== '') {
    try {
      return { name: parts[0], param: decodeURIComponent(parts[1]) };
    } catch (_error) {
      return { name: 'notFound', param: null };
    }
  }

  return { name: 'notFound', param: null };
}

export function hrefFor(name: string, param?: string): string {
  if (name === 'home') return '#/';
  if (name === 'play' && param !== undefined) return `#/play/${encodeURIComponent(param)}`;
  if (name === 'lesson' && param !== undefined) return `#/lesson/${encodeURIComponent(param)}`;
  if (name === 'codeUse') return '#/code/use';
  if (name in simplePaths) return `#/${name}`;
  return '#/';
}

export type TabName = 'play' | 'learn' | 'me';

export function tabForRoute(name: string): TabName | null {
  if (name === 'home' || name === 'review' || name === 'practice' || name === 'oldtech') {
    return 'play';
  }
  if (name === 'learn') return 'learn';
  if (name === 'me' || name === 'settings' || name === 'badges' || name === 'about' || name === 'how' || name === 'code' || name === 'codeUse' || name === 'get') {
    return 'me';
  }
  return null;
}

export function navigate(name: string, param?: string): void {
  window.location.hash = hrefFor(name, param);
}

export function replaceRoute(name: string, param?: string): void {
  const href = hrefFor(name, param);
  window.history.replaceState({ jargleDepth: currentDepth }, '', href);
  notify();
}

export function goBack(): void {
  if (currentDepth > 0) {
    window.history.back();
  } else {
    replaceRoute('home');
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const update = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', update);
    listeners.add(update);
    return () => {
      window.removeEventListener('hashchange', update);
      listeners.delete(update);
    };
  }, []);

  return route;
}
