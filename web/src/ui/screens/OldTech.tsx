import { useState } from 'preact/hooks';
import { engine } from '../engine';
import { useApp } from '../store';
import { hrefFor, goBack } from '../router';
import { openRound, shortDate } from '../actions';
import { Screen } from '../components/Screen';
import { Announcer } from '../components/BottomBar';
import { Button, LinkButton } from '../components/Button';
import { MascotSays } from '../components/MascotSays';
import { OLD_TECH_INTRO } from '../../engine/api';
import { WordRow } from './Practice';
import '../../styles/screens.css';

export function OldTechScreen() {
  const app = useApp();
  const [message, setMessage] = useState<string | null>(null);
  if (!app.save || !app.content) return null;
  const entries = engine.oldTechList(app.save, app.content, app.today);
  function next() {
    const result = engine.nextWord(app.save!, app.content!, 'oldtech', app.today);
    if ('entry' in result) openRound(result.entry.key, result.entry.itemId, 'oldtech');
    else setMessage(result.message);
  }
  return (
    <Screen title="Floyd's Old Tech">
      <div class="words stack">
        <MascotSays who="floyd" pose="wave" text={OLD_TECH_INTRO} />
        <p class="soft-note small">Just for fun: this doesn't change your streak or Days learned.</p>
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
            {entries.map((entry, i) => {
              // A finished word shows its name. An unplayed one shows its number, so the list
              // is not a stack of identical "Not finished yet" rows.
              let title = entry.label;
              let note = 'Old tech ' + (i + 1);
              if (!entry.finished) {
                title = 'Old tech ' + (i + 1);
                note = entry.open ? entry.label : '';
              }
              if (entry.open && entry.date) note += ' · ' + shortDate(entry.date);
              if (!entry.open && entry.lockLine) note = note ? note + ' · ' + entry.lockLine : entry.lockLine;
              return (
                <li key={entry.key}>
                  <WordRow entry={entry} title={title} mode="oldtech" note={note} />
                </li>
              );
            })}
          </ul>
        ) : null}
        <LinkButton block variant="ghost" href={hrefFor('learn')}>
          Back to Learn
        </LinkButton>
      </div>
      <Announcer message={message || ''} />
    </Screen>
  );
}
