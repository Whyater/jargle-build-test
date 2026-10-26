import { useState } from 'preact/hooks';
import { engine } from '../engine';
import { useApp } from '../store';
import { hrefFor, goBack } from '../router';
import { openRound, openReveal, shortDate } from '../actions';
import { Screen } from '../components/Screen';
import { Announcer } from '../components/BottomBar';
import { Button, LinkButton } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import { Icon } from '../components/Icons';
import { MascotSays } from '../components/MascotSays';
import { buzz } from '../components/feedback';
import { PRACTICE_EMPTY } from '../../engine/api';
import type { ListEntry } from '../../engine/api';
import type { RoundMode } from '../../engine/types';
import '../../styles/screens.css';

/** One word in a Practice or Old Tech list: a status circle, the word or date, and a note. */
export function WordRow({
  entry,
  title,
  note,
  mode,
}: {
  entry: ListEntry;
  title?: string;
  note: string;
  mode: RoundMode;
}) {
  let kind = 'is-open';
  if (entry.finished) kind = 'is-done';
  if (!entry.open) kind = 'is-locked';
  const mark = (
    <span class="word-mark" aria-hidden="true">
      {entry.finished ? <Icon name="check" /> : entry.open ? <GameIcon name="play" size={20} /> : <Icon name="lock" />}
    </span>
  );
  if (!entry.open) {
    return (
      <div class={'word-row ' + kind} aria-disabled="true">
        {mark}
        <span class="word-main">
          <span class="word-title">{title || entry.label}</span>
          <span class="word-note">{note}</span>
        </span>
      </div>
    );
  }
  return (
    <a
      class={'word-row ' + kind}
      href={hrefFor('play', entry.key)}
      onClick={(event) => {
        event.preventDefault();
        buzz();
        if (entry.finished) openReveal(entry.key);
        else openRound(entry.key, entry.itemId, mode);
      }}
    >
      {mark}
      <span class="word-main">
        <span class="word-title">{title || entry.label}</span>
        {note ? <span class="word-note">{note}</span> : null}
      </span>
      {entry.finished ? <span class="visually-hidden">Done</span> : null}
      <span class="word-go" aria-hidden="true">
        <GameIcon name="chevron" size={20} />
      </span>
    </a>
  );
}

export function PracticeScreen() {
  const app = useApp();
  const [message, setMessage] = useState<string | null>(null);
  if (!app.save || !app.content) return null;
  const entries = engine.practiceList(app.save, app.content, app.today);
  function next() {
    const result = engine.nextWord(app.save!, app.content!, 'practice', app.today);
    if ('entry' in result) openRound(result.entry.key, result.entry.itemId, 'practice');
    else setMessage(result.message);
  }
  return (
    <Screen title="Practice">
      <div class="words stack">
        <MascotSays who="bud" pose="wave" text="Pick a past word to play again, or tap Next word." />
        <Button primary big block onClick={next}>
          Next word
        </Button>
        {message ? (
          <div class="soft-note stack-sm">
            <p>{message}</p>
            <Button small onClick={() => goBack()}>
              Back
            </Button>
          </div>
        ) : null}
        {entries.length ? (
          <ul class="word-list">
            {entries.map((entry) => (
              <li key={entry.key}>
                <WordRow
                  entry={entry}
                  mode="practice"
                  note={entry.open ? (entry.date ? shortDate(entry.date) : '') : entry.lockLine || ''}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p class="soft-note">{PRACTICE_EMPTY}</p>
        )}
        <LinkButton block variant="ghost" href={hrefFor('learn')}>
          Back to Learn
        </LinkButton>
      </div>
      <Announcer message={message || ''} />
    </Screen>
  );
}
