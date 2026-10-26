import { RowLink } from '../components/RowLink';
import { Screen } from '../components/Screen';
import { commit, useApp } from '../store';
import { hrefFor } from '../router';
import type { SaveState, TextSize } from '../../engine/types';

/** Text size, sound and motion choices. Used on this screen and folded into the Me tab. */
export function SettingsControls({ save }: { save: SaveState }) {
  function setSize(textSize: TextSize) {
    commit({ ...save, settings: { ...save.settings, textSize } });
  }
  function setSound(sound: boolean) {
    commit({ ...save, settings: { ...save.settings, sound } });
  }
  function setMotion(reducedMotion: boolean) {
    commit({ ...save, settings: { ...save.settings, reducedMotion } });
  }
  return (
    <div class="stack-lg">
      <fieldset>
        <legend>Text size</legend>
        <div class="choice-row">
          {(['normal', 'large', 'largest'] as TextSize[]).map((size) => (
            <button
              type="button"
              class="choice"
              aria-pressed={save.settings.textSize === size ? 'true' : 'false'}
              key={size}
              onClick={() => setSize(size)}
            >
              {size[0].toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Sound and buzz</legend>
        <div class="choice-row">
          <button
            type="button"
            class="choice"
            aria-pressed={save.settings.sound ? 'true' : 'false'}
            onClick={() => setSound(true)}
          >
            On
          </button>
          <button
            type="button"
            class="choice"
            aria-pressed={!save.settings.sound ? 'true' : 'false'}
            onClick={() => setSound(false)}
          >
            Off
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Reduced motion</legend>
        <div class="choice-row">
          <button
            type="button"
            class="choice"
            aria-pressed={save.settings.reducedMotion ? 'true' : 'false'}
            onClick={() => setMotion(true)}
          >
            On
          </button>
          <button
            type="button"
            class="choice"
            aria-pressed={!save.settings.reducedMotion ? 'true' : 'false'}
            onClick={() => setMotion(false)}
          >
            Off
          </button>
        </div>
        <p class="small">Shows the final frame of each animation. Sounds still play.</p>
      </fieldset>
    </div>
  );
}

export function SettingsScreen() {
  const app = useApp();
  if (!app.save)
    return (
      <Screen title="Settings">
        <p>Loading...</p>
      </Screen>
    );
  return (
    <Screen title="Settings">
      <div class="stack-lg">
        <SettingsControls save={app.save} />
        <ul class="rows">
          <li>
            <RowLink href={hrefFor('code')} title="Get a progress code" />
          </li>
          <li>
            <RowLink href={hrefFor('codeUse')} title="Use a progress code" />
          </li>
          <li>
            <RowLink href={hrefFor('how')} title="How to play" />
          </li>
          <li>
            <RowLink href="?demo=judge" title="Try the demo: 8 days already learned" />
          </li>
          <li>
            <RowLink href={hrefFor('about')} title="About this app and how it was made" />
          </li>
        </ul>
      </div>
    </Screen>
  );
}
