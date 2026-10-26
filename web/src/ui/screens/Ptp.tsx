import { engine } from '../engine';
import { commit, useApp } from '../store';
import { navigate } from '../router';
import { openRound } from '../actions';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Mascot } from '../components/Mascot';
import { MascotSays } from '../components/MascotSays';
import { GameIcon } from '../components/GameIcon';
import { Icon } from '../components/Icons';
import { newBadgesByRound } from './roundLogic';
import { roundSummaryLine } from './listLogic';
import { NewBadge } from './RoundAfter';
import '../../styles/screens.css';
import type { ContentBundle, PtpSet, SaveState } from '../../engine/types';
import { ptpRoundCardLines, ptpTotalLine, ptpBestLine } from '../../engine/api';

function ptpKey(set: PtpSet, r: number): string {
  return 'ptp:' + set.id + ':' + r;
}

function isEnded(save: SaveState, key: string): boolean {
  const record = save.rounds[key];
  return !!record && record.status !== 'playing';
}

export function PtpScreen() {
  const app = useApp();
  if (!app.save || !app.content) return null;
  const save = app.save;
  const content = app.content;
  const today = app.today;
  const set = save.ptpSet;

  function startSet() {
    commit(engine.startPtpSet(save, content, today));
  }

  if (!set) return <StartCard onStart={startSet} />;
  if (set.done || (set.r === set.rounds.length && isEnded(save, ptpKey(set, set.rounds.length)))) {
    return <Summary save={save} content={content} today={today} set={set} onStart={startSet} />;
  }

  // A round that ended without the reveal moving the set on (for example after a reload).
  let r = set.r;
  if (isEnded(save, ptpKey(set, r)) && r < set.rounds.length) {
    r = r + 1;
  }
  const key = ptpKey(set, r);
  const itemId = engine.ptpRoundItem(save, r);
  if (!itemId) return <StartCard onStart={startSet} />;
  const roundItemId = itemId;
  const record = save.rounds[key];

  if (record && record.status === 'playing') {
    return (
      <Screen title="Pass the Phone" focusKey="continue">
        <div class="ptp stack">
          <RoundPips r={r} total={set.rounds.length} />
          <p class="ptp-round">Round {r} of {set.rounds.length}.</p>
          <Button primary big block onClick={() => navigate('play', key)}>
            Continue
          </Button>
        </div>
      </Screen>
    );
  }

  function beReader() {
    if (r !== set!.r) commit(engine.advancePtp(save));
    openRound(key, roundItemId, 'ptp');
  }

  const item = content.items[itemId];
  const oldTech = Boolean(item && item.old_tech);
  const cardLines = ptpRoundCardLines(r, oldTech);
  cardLines[2] = 'Round ' + r + ' of ' + set.rounds.length + '.';
  return (
    <Screen title="Pass the Phone" focusKey={'round-' + r}>
      <div class="ptp stack">
        <RoundPips r={r} total={set.rounds.length} />
        <p class="ptp-round">{cardLines[2]}</p>
        {/* Floyd introduces old tech rounds, Bud the modern ones. */}
        <MascotSays who={oldTech ? 'floyd' : 'bud'} pose="talk" text={cardLines[4]} />
        <p class="soft-note">{cardLines[5]}</p>
        <Button primary big block onClick={beReader}>
          I'm the reader.
        </Button>
        <PtpSteps lines={cardLines} />
      </div>
    </Screen>
  );
}

/** Four dots for the four rounds: done, now, and still to come. */
function RoundPips({ r, total }: { r: number; total: number }) {
  const pips = [];
  for (let i = 1; i <= total; i++) {
    let className = 'ptp-pip';
    if (i < r) className += ' done';
    if (i === r) className += ' now';
    pips.push(<span key={i} class={className} />);
  }
  return (
    <div class="ptp-pips" aria-hidden="true">
      {pips}
    </div>
  );
}

/** How Pass the Phone works, in three short steps. */
function PtpSteps({ lines }: { lines: string[] }) {
  return (
    <ol class="steps">
      <li>
        <span class="step-icon" aria-hidden="true">
          <GameIcon name="people" size={24} />
        </span>
        <span>
          <strong>{lines[0]}</strong>
        </span>
      </li>
      <li>
        <span class="step-icon" aria-hidden="true">
          <GameIcon name="cards" size={24} />
        </span>
        <span>{lines[1]}</span>
      </li>
      <li>
        <span class="step-icon" aria-hidden="true">
          <GameIcon name="heart" size={24} />
        </span>
        <span>{lines[3]}</span>
      </li>
    </ol>
  );
}

function StartCard({ onStart }: { onStart: () => void }) {
  return (
    <Screen title="Pass the Phone" focusKey="start">
      <div class="ptp stack">
        <div class="ptp-hero">
          <Mascot who="floyd" size={88} pose="wave" />
          <span class="ptp-hero-phone" aria-hidden="true">
            <GameIcon name="people" size={34} />
          </span>
          <Mascot who="bud" size={88} pose="wave" />
        </div>
        <PtpSteps lines={ptpRoundCardLines(1, false)} />
        <Button primary big block onClick={onStart}>
          Start a set
        </Button>
      </div>
    </Screen>
  );
}

interface SummaryProps {
  save: SaveState;
  content: ContentBundle;
  today: string;
  set: PtpSet;
  onStart: () => void;
}

function Summary({ save, content, today, set, onStart }: SummaryProps) {
  const summary = engine.ptpSummary(save, content);
  // Taught Someone is earned by the last round finish, so its badge is kept under that round.
  const badgeIds = newBadgesByRound.get(ptpKey(set, set.rounds.length)) || [];
  const badgeNames = engine.badgeViews(save, content, today);
  return (
    <Screen title="Pass the Phone" focusKey="summary">
      <div class="ptp stack-lg">
        <div class="win-card is-solved">
          <div class="win-mascots">
            <Mascot who="floyd" size={72} pose="happy" />
            <Mascot who="bud" size={72} pose="happy" />
          </div>
          <p class="win-shout">Set done!</p>
          <p class="result-line">{ptpTotalLine(summary.total)}</p>
          <p class="win-note">{ptpBestLine(summary.best)}</p>
        </div>
        <ol class="ptp-summary">
          {summary.rounds.map((round, index) => (
            <li key={round.itemId} class={round.solved ? 'summary-row is-solved' : 'summary-row'}>
              <span class="word-mark" aria-hidden="true">
                {round.solved ? <Icon name="check" /> : <GameIcon name="learn" size={20} />}
              </span>
              <span class="word-main">
                <span class="title">
                  Round {index + 1}: {round.term}
                </span>
                <span class="note">{roundSummaryLine(round)}</span>
              </span>
            </li>
          ))}
        </ol>
        {badgeIds.map((id) => {
          let name: string = id;
          for (const view of badgeNames) {
            if (view.id === id) name = view.name;
          }
          return <NewBadge key={id} id={id} name={name} />;
        })}
        <div class="stack-sm">
          <Button primary big block onClick={() => navigate('home')}>
            Done
          </Button>
          <Button block onClick={onStart}>
            Start a new set
          </Button>
        </div>
      </div>
    </Screen>
  );
}
