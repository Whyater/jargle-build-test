import { useState } from 'preact/hooks';
import { appUrl } from '../../config';
import { inAppBrowserName } from '../../platform/inapp';
import { Button } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import '../../styles/screens.css';
import { commit, useApp } from '../store';
import type { SaveState } from '../../engine/types';

export function inAppNoteShows(save: SaveState | null, userAgent: string): boolean {
  if (!save || save.flags.inAppNoteHidden) return false;
  return inAppBrowserName(userAgent) !== null;
}

export function InAppNote() {
  const app = useApp();
  const [show, setShow] = useState(false);
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (!inAppNoteShows(app.save, userAgent)) return null;
  const name = inAppBrowserName(userAgent);
  if (!name) return null;
  function hide() {
    commit({ ...app.save!, flags: { ...app.save!.flags, inAppNoteHidden: true } });
  }
  return (
    <aside class="inapp-note stack-sm" aria-label="Browser note">
      <p class="inapp-line">
        <span class="inapp-icon" aria-hidden="true">
          <GameIcon name="info" size={22} />
        </span>
        <span>You're inside {name}. Words you finish here may be lost when you close it.</span>
      </p>
      <div class="row inapp-buttons">
        <Button small onClick={() => setShow(!show)}>
          {show ? 'Hide steps' : 'Show me how'}
        </Button>
        <Button small onClick={hide}>
          Play here instead
        </Button>
      </div>
      {show ? (
        <ol class="get-steps">
          <li>Tap the three dots (top right) or the compass icon.</li>
          <li>Then tap Open in browser (or Open in external browser, or Open in Safari).</li>
          <li>
            Or copy this address into your browser: <span class="code-text">{appUrl}</span>
          </li>
        </ol>
      ) : null}
    </aside>
  );
}
