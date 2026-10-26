import { useState } from 'preact/hooks';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { Announcer } from '../components/BottomBar';
import { GameIcon } from '../components/GameIcon';
import '../../styles/screens.css';
import { copyText, selectTextOf } from '../../platform/share';
import { engine } from '../engine';
import { commit, useApp } from '../store';
import { hrefFor } from '../router';
let beforeLoad: any = null;
export function GetCodeScreen() {
  const app = useApp();
  const [message, setMessage] = useState('');
  if (!app.save || !app.content)
    return (
      <Screen title="Get a progress code">
        <p>Loading...</p>
      </Screen>
    );
  const code = engine.encodeProgressCode(app.save, app.content, app.today);
  async function copy() {
    if (await copyText(code)) setMessage('Copied.');
    else {
      const el = document.getElementById('progress-code');
      if (el) selectTextOf(el);
      setMessage('Select the code to copy it.');
    }
  }
  return (
    <Screen title="Get a progress code">
      <div class="code-screen stack">
        <div class="key-card">
          <span class="key-card-icon" aria-hidden="true">
            <GameIcon name="key" size={26} />
          </span>
          <p id="progress-code" class="code-text">
          {/* Line breaks only after a dash, so no group of 4 is split when someone copies it by hand. */}
          {code.split('-').map((group, i) => (
            <span key={i}>
              {i > 0 ? '-' : ''}
              <wbr />
              <span class="nowrap">{group}</span>
            </span>
          ))}
          </p>
        </div>
        <Button primary big block onClick={copy} icon="copy">
          Copy
        </Button>
        {message ? <p class="code-message">{message}</p> : null}
        <p class="soft-note">
          Save a picture of your screen or write this down. On a new phone, open Settings, then "Use a progress
          code," and type or paste it in.
        </p>
        <Announcer message={message} />
      </div>
    </Screen>
  );
}
export function UseCodeScreen() {
  const app = useApp();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState(false);
  if (!app.save || !app.content)
    return (
      <Screen title="Use a progress code">
        <p>Loading...</p>
      </Screen>
    );
  const save = app.save;
  const content = app.content;
  function submit(e: Event) {
    e.preventDefault();
    const r = engine.decodeProgressCode(text);
    if (!r.ok) {
      setMessage(
        r.error === 'typo'
          ? 'That code has a typo. Check each character and try again.'
          : r.error === 'newer'
            ? 'This code is from a newer version. Close Jargle, open it again, then try once more.'
            : "That doesn't look like a progress code. It starts with JRG1.",
      );
      return;
    }
    beforeLoad = save;
    commit(r.apply(save, content, app.today));
    setUndo(true);
    setMessage('Code loaded. Your progress is back.');
  }
  function undoLoad() {
    if (beforeLoad) commit(beforeLoad);
    setUndo(false);
    setMessage('Undone.');
  }
  return (
    <Screen title="Use a progress code">
      <form class="code-screen stack" onSubmit={submit}>
        <label class="field-label" for="progress-input">
          Your progress code
        </label>
        <textarea
          id="progress-input"
          class="field"
          value={text}
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
          autocapitalize="characters"
          autocomplete="off"
          spellcheck={false}
        />
        <Button primary big block onClick={() => submit(new Event('submit'))}>
          Use this code
        </Button>
        {message ? <p class="code-message">{message}</p> : null}
        {undo ? <Button block onClick={undoLoad}>Undo</Button> : null}
        <LinkButton block variant="ghost" href={hrefFor('me')}>
          Back to Me
        </LinkButton>
        <Announcer message={message} />
      </form>
    </Screen>
  );
}
