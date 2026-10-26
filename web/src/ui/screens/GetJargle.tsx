import { useEffect, useRef, useState } from 'preact/hooks';
import {
  appUrl,
  androidApkUrl,
  macDownloadUrl,
  macInstallCmd,
  winDownloadUrl,
  winInstallCmd,
} from '../../config';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import '../../styles/screens.css';
import { copyText, selectTextOf } from '../../platform/share';
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
let savedInstall: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    savedInstall = event as BeforeInstallPromptEvent;
  });
export function GetJargleScreen() {
  const [canInstall, setCanInstall] = useState(!!savedInstall);
  useEffect(() => setCanInstall(!!savedInstall), []);
  return (
    <Screen title="Get Jargle">
      <div class="get stack">
        <p class="soft-note">Put Jargle on your phone or computer. It works offline once it is installed.</p>
        <section class="about-card stack-sm">
          <h2>iPhone</h2>
          <ol class="get-steps">
            <li>In Safari, tap the Share button.</li>
            <li>Then Add to Home Screen.</li>
            <li>Then Add.</li>
          </ol>
        </section>
        <section class="about-card stack-sm">
          <h2>Android</h2>
          {canInstall ? (
            <Button
              primary
              block
              gameIcon="download"
              onClick={async () => {
                if (savedInstall) {
                  await savedInstall.prompt();
                  setCanInstall(false);
                }
              }}
            >
              Install app
            </Button>
          ) : null}
          <LinkButton block gameIcon="download" href={androidApkUrl} external>
            Download for Android
          </LinkButton>
          <p class="small">Open the file after it downloads, then allow the install.</p>
        </section>
        <section class="about-card stack-sm">
          <h2>Mac</h2>
          <LinkButton block gameIcon="download" href={macDownloadUrl} external>
            Download for Mac
          </LinkButton>
          <CommandBox label="Or paste this into Terminal:" command={macInstallCmd} />
        </section>
        <section class="about-card stack-sm">
          <h2>Windows</h2>
          <LinkButton block gameIcon="download" href={winDownloadUrl} external>
            Download for Windows
          </LinkButton>
          <CommandBox label="Or paste this into PowerShell:" command={winInstallCmd} />
        </section>
        <p class="get-web">
          <GameIcon name="play" size={20} />
          <span>
            Or play in your browser:{' '}
            <a class="link" href={appUrl}>
              {appUrl}
            </a>
          </span>
        </p>
      </div>
    </Screen>
  );
}

/** An install command with a Copy button. Line breaks are allowed after each "/". */
function CommandBox({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLParagraphElement>(null);
  const pieces = command.split('/');
  async function copy() {
    const ok = await copyText(command);
    if (ok) setCopied(true);
    else if (box.current) selectTextOf(box.current);
  }
  return (
    <div class="command stack-sm">
      <p class="small">{label}</p>
      <p class="code-text cmd" ref={box}>
        {pieces.map((piece, i) => (
          <span key={i}>
            {piece}
            {i < pieces.length - 1 ? (
              <>
                /<wbr />
              </>
            ) : null}
          </span>
        ))}
      </p>
      <Button block small icon="copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
