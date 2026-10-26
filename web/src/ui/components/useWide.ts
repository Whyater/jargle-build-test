import { useEffect, useState } from 'preact/hooks';

// 56.25em is 900 px at the browser's default font size. desktop.css uses the same number,
// so the side nav and rail only mount when the CSS has room for them.
export const WIDE_QUERY = '(min-width: 56.25em)';

function matches(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(WIDE_QUERY).matches;
}

/** True on a wide screen (900 px or more), where the side nav and right rail show. */
export function useWide(): boolean {
  const [wide, setWide] = useState(matches);

  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(list.matches);
    // Old Safari only has addListener, so use it when addEventListener is missing.
    if (list.addEventListener) list.addEventListener('change', update);
    else list.addListener(update);
    update();
    return () => {
      if (list.removeEventListener) list.removeEventListener('change', update);
      else list.removeListener(update);
    };
  }, []);

  return wide;
}
