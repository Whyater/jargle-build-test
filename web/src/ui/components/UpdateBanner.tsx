import { useEffect, useState } from 'preact/hooks';
import { Mascot as MascotArt } from '../art';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import {
  dismissUpdate,
  getUpdateState,
  installUpdate,
  startUpdateChecks,
  subscribeUpdate,
} from '../../platform/updater';
import type { UpdateState } from '../../platform/updater';
import './update-banner.css';

/** Put once in the app. Shows Bud with a "new version" card when an update is waiting. */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>(getUpdateState());

  useEffect(() => {
    const stop = subscribeUpdate(setState);
    // Only does anything inside the desktop app. The web version hears from the service worker.
    startUpdateChecks();
    return stop;
  }, []);

  // The live region stays mounted even with no update, so screen readers hear the title when it appears.
  const announcer = (
    <div class="visually-hidden" role="status" aria-live="polite">
      {state.kind === 'none' ? '' : bannerTitle(state)}
    </div>
  );
  // Both returns start with the same live region, so Preact keeps that one element in place.
  if (state.kind === 'none') return <>{announcer}</>;

  const title = bannerTitle(state);
  let note = 'It only takes a moment.';
  let pose: 'wave' | 'happy' | 'think' | 'oops' = 'wave';
  if (state.kind === 'ready' && state.source === 'web') {
    note = 'Your progress stays saved.';
  } else if (state.kind === 'ready' && state.version) {
    note = 'Version ' + state.version + ' has new things to play.';
  } else if (state.kind === 'downloading') {
    note = 'Jargle will restart by itself when it is done.';
    pose = 'think';
  } else if (state.kind === 'failed') {
    note = 'Check your internet, then try again.';
    pose = 'oops';
  }

  return (
    <>
      {announcer}
      <section class={'update-banner update-' + state.kind} aria-label="Update">
        <div class="update-bud" aria-hidden="true">
          <MascotArt who="bud" size={56} pose={pose} />
        </div>
        <div class="update-body">
          <p class="update-title">{title}</p>
          <p class="update-note">{note}</p>
          {state.kind === 'downloading' ? <DownloadBar progress={state.progress} /> : null}
          {state.kind !== 'downloading' ? (
            <div class="update-actions">
              <Button variant="mint" small onClick={() => installUpdate()}>
                {buttonText(state)}
              </Button>
              <Button variant="ghost" small onClick={() => dismissUpdate()}>
                Later
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function bannerTitle(state: UpdateState): string {
  if (state.kind === 'ready' && state.source === 'web') return 'New version ready, tap to refresh';
  if (state.kind === 'downloading') return 'Getting the new Jargle...';
  if (state.kind === 'failed') return "The update didn't finish";
  return 'A new Jargle is ready!';
}

function buttonText(state: UpdateState): string {
  if (state.kind === 'failed') return 'Try again';
  if (state.kind === 'ready' && state.source === 'web') return 'Refresh';
  return 'Update now';
}

/** A real bar once the size is known; before that, a soft moving stripe so it never looks stuck. */
function DownloadBar({ progress }: { progress: number | null }) {
  if (progress === null) {
    return (
      <div class="update-wait" role="progressbar" aria-label="Downloading the update">
        <span />
      </div>
    );
  }
  const percent = Math.round(progress * 100);
  return <ProgressBar value={percent} max={100} tone="mint" label={'Downloading the update: ' + percent + '%'} />;
}
