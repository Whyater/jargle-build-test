import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { leaveDemoHref, restartDemo, useApp } from '../store';
import { goBack, useRoute } from '../router';
import { Button } from './Button';
import { GameIcon } from './GameIcon';
import { buzz } from './feedback';

interface ScreenProps {
  title: string;
  children: ComponentChildren;
  focusKey?: string;
  isHome?: boolean;
  /** The sheet's header line, for example "No. 12 · Fri, Oct 30". */
  runhead?: string;
  /** Optional right side of the header line, for example "Card 2 of 3". */
  runheadRight?: string;
  /** Hide the visible h1 (the heading is still there for screen readers). */
  quietTitle?: boolean;
}

// The first screen of each tab. These show a big title and no back button.
const tabRoots = ['home', 'learn', 'me'];

/**
 * Frame for every screen: the back button (or a big title on a tab's first screen), the demo
 * strip, the running head, and the heading that takes focus when the screen opens.
 */
export function Screen({ title, children, focusKey, isHome, runhead, runheadRight, quietTitle }: ScreenProps) {
  const app = useApp();
  const heading = useRef<HTMLHeadingElement>(null);
  const route = useRoute();
  const isRoot = isHome || tabRoots.indexOf(route.name) !== -1;

  useEffect(() => {
    document.title = isHome ? 'Jargle' : title + ' | Jargle';
    // Move focus to the heading so screen readers start at the top of the new screen.
    if (heading.current) heading.current.focus();
    window.scrollTo(0, 0);
  }, [title, focusKey]);

  return (
    <div class="sheet">
      {isRoot ? null : (
        <div class="screen-head">
          <button
            type="button"
            class="icon-btn"
            aria-label="Back"
            onClick={() => {
              buzz();
              goBack();
            }}
          >
            <GameIcon name="back" />
          </button>
          <h1 class="screen-title" tabIndex={-1} ref={heading}>
            {title}
          </h1>
        </div>
      )}
      {app.demo ? <DemoStrip full={!!isHome && app.demo === 'new'} /> : null}
      {app.status !== 'ready' || app.canSave ? null : (
        <p class="note-box small" style={{ marginTop: '0.5rem' }}>
          Progress can't be saved in this window.
        </p>
      )}
      {runhead ? (
        <p class="runhead">
          <span>{runhead}</span>
          {runheadRight ? <span>{runheadRight}</span> : null}
        </p>
      ) : null}
      {isRoot ? (
        <h1 class={quietTitle ? 'screen-title visually-hidden' : 'screen-title big'} tabIndex={-1} ref={heading}>
          {title}
        </h1>
      ) : null}
      <main>{children}</main>
    </div>
  );
}

/**
 * The new-player Home spells out which demo this is (the judge Home has its own longer line).
 * Other screens keep it to one short row to save space.
 */
function DemoStrip({ full }: { full: boolean }) {
  let label = 'Demo';
  if (full) label = 'Demo: a new player.';
  return (
    <div class={full ? 'demo-strip' : 'demo-strip compact'}>
      <div class="row">
        <p class="label">{label}</p>
        <Button small onClick={() => restartDemo()}>
          Restart demo
        </Button>
        <a class="btn btn-small" href={leaveDemoHref()}>
          <span>Leave demo</span>
        </a>
      </div>
    </div>
  );
}
