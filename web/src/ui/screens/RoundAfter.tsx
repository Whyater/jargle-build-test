import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RoundView } from '../../engine/api';
import type { BadgeId, ExchangeLine, Source } from '../../engine/types';
import { engine } from '../engine';
import { useApp, commit } from '../store';
import { goBack, hrefFor, navigate } from '../router';
import { openRound } from '../actions';
import { appUrl, feedbackEmail, feedbackLink } from '../../config';
import { shareOrCopy, selectTextOf } from '../../platform/share';
import { playSound } from '../../platform/audio';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { AnswerCard } from '../components/AnswerCard';
import { Battery } from '../components/Battery';
import { Counter } from '../components/Counter';
import { Badge } from '../components/art';
import { Confetti } from '../components/Confetti';
import { XpFloat } from '../components/Toast';
import { Pill } from '../components/Pill';
import { GameIcon } from '../components/GameIcon';
import type { GameIconName } from '../components/GameIcon';
import { Mascot } from '../components/Mascot';
import { MascotSays } from '../components/MascotSays';
import { canPlayAgain, cheerLine, justEnded, newBadgesByRound, xpByRound } from './roundLogic';
import type { MascotPose } from '../art';
import { Announcer } from '../components/BottomBar';
import './round.css';

/** The energy meter: a bolt, the six bars, the number left, the battery line, and Bud reacting. */
export function EnergyMeter({
  view,
  pose,
  lightUp,
  children,
}: {
  view: RoundView;
  pose: MascotPose;
  lightUp?: boolean;
  children?: ComponentChildren;
}) {
  return (
    <div class="energy-row">
      <div class={view.bars <= 3 ? 'battery-wrap energy is-low' : 'battery-wrap energy'}>
        <div class="energy-top">
          <span class="energy-bolt" aria-hidden="true">
            <GameIcon name="bolt" size={22} />
          </span>
          <Battery bars={view.bars} lightUp={lightUp} />
          <span class="energy-count" aria-hidden="true">
            {view.bars}
          </span>
        </div>
        <p class="energy-line">{view.batteryLine}</p>
        {children}
      </div>
      <div class="energy-buddy">
        <Mascot who="bud" size={56} pose={pose} />
      </div>
    </div>
  );
}

/** Floyd and Bud talking about the word, Floyd on the left and Bud on the right. */
export function ChatLines({ lines, budPose = 'idle' }: { lines: ExchangeLine[]; budPose?: MascotPose }) {
  return (
    <ul class="chat">
      {lines.map((line, i) => (
        <li key={i}>
          <MascotSays
            who={line.speaker}
            text={line.text}
            size={60}
            flip={line.speaker === 'bud'}
            pose={line.speaker === 'bud' ? budPose : 'talk'}
          />
        </li>
      ))}
    </ul>
  );
}

/** A freshly earned badge, stamped in. */
export function NewBadge({ id, name }: { id: BadgeId; name: string }) {
  return (
    <div class="new-badge stamp">
      <span class="new-badge-art">
        <Badge id={id} earned size={72} />
      </span>
      <p class="new-badge-line">
        New badge: <strong>{name}</strong>
      </p>
    </div>
  );
}

/** "Where this comes from": the sources for a word or lesson. */
export function Sources({ sources, children }: { sources: Source[]; children?: ComponentChildren }) {
  return (
    <section class="sources">
      <h2>Where this comes from</h2>
      <ul class="plain-list">
        {sources.map((source) => (
          <li key={source.url}>
            <a class="link" href={source.url} target="_blank" rel="noopener">
              {source.name}
            </a>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

function answerCardOf(view: RoundView) {
  const item = view.item;
  return (
    view.cards.filter((card) => card.state === 'answer')[0] || {
      term: item.term,
      state: 'answer' as const,
      selected: false,
      meaning: item.meaning,
    }
  );
}

export function RoundAfter({ roundKey, view }: { roundKey: string; view: RoundView }) {
  const app = useApp();
  const [step, setStep] = useState(view.record.post_step);
  useEffect(() => setStep(view.record.post_step), [view.record.post_step]);
  function move(next: number) {
    const result = engine.applyRound(
      app.save!,
      app.content!,
      roundKey,
      { type: 'postStep', step: next },
      app.today,
    );
    commit(result.state);
    setStep(next);
  }
  if (view.mode === 'ptp') return <PtpAfter roundKey={roundKey} view={view} />;
  // Only a counted daily has a share step; other rounds go straight to the end.
  const shares = view.record.mode === 'daily' && view.record.counted_day !== undefined;
  if (step === 0)
    return (
      <Reveal
        roundKey={roundKey}
        view={view}
        shares={shares}
        onContinue={() => move(shares ? 1 : 2)}
        onSkip={() => move(2)}
        onReplay={
          canPlayAgain(roundKey, view.record.mode, engine.dayNumber(app.today))
            ? () => {
                commit(engine.replayRound(app.save!, app.content!, roundKey, app.today));
              }
            : undefined
        }
      />
    );
  if (step === 1) return <ShareStep roundKey={roundKey} onFinish={() => move(2)} />;
  return <DoneStep view={view} />;
}

/** The happy (or kind) top of the reveal: mascots, the cheer, the result line, bars and XP. */
function WinCard({ roundKey, view }: { roundKey: string; view: RoundView }) {
  const solved = view.record.status === 'solved';
  // Confetti and the XP float play once, right after the round ends, not when it is reopened later.
  const [fresh] = useState(() => justEnded.has(roundKey));
  useEffect(() => {
    justEnded.delete(roundKey);
  }, [roundKey]);
  const xp = xpByRound.get(roundKey) || 0;
  return (
    <div class={solved ? 'win-card is-solved' : 'win-card is-learned'}>
      <Confetti burst={fresh && solved ? 1 : 0} />
      <div class="win-mascots">
        <Mascot who="floyd" size={76} pose={solved ? 'happy' : 'wave'} />
        <Mascot who="bud" size={76} pose={solved ? 'happy' : 'oops'} />
      </div>
      <p class="win-shout" aria-hidden="true">
        {cheerLine(view.record.status)}
      </p>
      <p class="result-line">{view.resultLine}</p>
      {view.resultNote ? <p class="win-note">{view.resultNote}</p> : null}
      <div class="win-stats">
        <Battery bars={view.bars} lightUp={fresh && solved} small />
        {xp ? (
          <span class="win-xp">
            <Pill tone="sunny" icon="star">
              +{xp} XP
            </Pill>
            <XpFloat amount={xp} burst={fresh ? 1 : 0} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Reveal({
  roundKey,
  view,
  shares,
  onContinue,
  onSkip,
  onReplay,
}: {
  roundKey: string;
  view: RoundView;
  shares: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onReplay?: () => void;
}) {
  const item = view.item;
  const solved = view.record.status === 'solved';
  return (
    <Screen title="What it means">
      <div class="after stack">
        <WinCard roundKey={roundKey} view={view} />
        <div class="word-card cards play-cards">
          <AnswerCard card={answerCardOf(view)} index={1} onPick={() => undefined} />
        </div>
        <ChatLines lines={item.exchange} budPose={solved ? 'happy' : 'oops'} />
        {/* Continue stays in reach at the bottom while Floyd and Bud talk above it. */}
        <div class="after-actions">
          <Button primary big block onClick={onContinue}>
            Continue
          </Button>
        </div>
        <div class="stack-sm">
          {onReplay ? (
            <Button block onClick={onReplay}>
              Play again
            </Button>
          ) : null}
          {shares ? (
            <Button block variant="ghost" onClick={onSkip}>
              Skip sharing
            </Button>
          ) : null}
        </div>
        <Sources sources={item.sources}>
          <p class="feedback-line">
            <a class="link" href={feedbackLink(item.id)} target={feedbackEmail ? undefined : '_blank'} rel="noopener">
              Something wrong? Tell us
            </a>
          </p>
        </Sources>
      </div>
    </Screen>
  );
}

function ShareStep({ roundKey, onFinish }: { roundKey: string; onFinish: () => void }) {
  const app = useApp();
  const preview = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  useEffect(() => {
    setText(engine.shareText(app.save!, app.content!, roundKey, { appUrl, demo: app.demo !== null }));
  }, [roundKey, app.save, app.content, app.demo]);
  async function share() {
    const result = await shareOrCopy(text);
    if (result === 'copied') setNotice('Copied. Paste it into a text or email.');
    if (result === 'failed') {
      if (preview.current) selectTextOf(preview.current);
      setNotice('Press and hold the text to copy it.');
    }
  }
  return (
    <Screen title="Share">
      <div class="after stack">
        <MascotSays who="bud" pose="wave" text="Send your score to a friend. It never gives away the word." />
        <div class="share-card">
          <p class="share-card-brand" aria-hidden="true">
            Jargle
          </p>
          <div class="share-preview" ref={preview}>
            {text}
          </div>
        </div>
        <Button primary big block onClick={share}>
          Send to someone
        </Button>
        {notice ? <p class="share-notice">{notice}</p> : null}
        <Button block onClick={onFinish}>
          Finish
        </Button>
        <Announcer message={notice} />
      </div>
    </Screen>
  );
}

/** One big "what next" choice. */
function NextCard({
  href,
  onClick,
  tone,
  icon,
  title,
  note,
}: {
  href?: string;
  onClick?: () => void;
  tone: 'grape' | 'mint' | 'sunny' | 'coral' | 'plain';
  icon: GameIconName;
  title: string;
  note?: string;
}) {
  return (
    <Card href={href} onClick={onClick} tone={tone} class="next-card">
      <span class="next-icon" aria-hidden="true">
        <GameIcon name={icon} size={28} />
      </span>
      <span class="next-text">
        <span class="next-title">{title}</span>
        {note ? <span class="next-note">{note}</span> : null}
      </span>
      <span class="next-go" aria-hidden="true">
        <GameIcon name="chevron" size={22} />
      </span>
    </Card>
  );
}

function DoneStep({ view }: { view: RoundView }) {
  const app = useApp();
  const home = engine.homeView(app.save!, app.content!, app.today);
  const badgeIds = newBadgesByRound.get(view.key) || [];
  const badges = engine
    .badgeViews(app.save!, app.content!, app.today)
    .filter((badge) => badgeIds.indexOf(badge.id) >= 0);
  const [nextMessage, setNextMessage] = useState('');
  useEffect(() => {
    if (badges.length) playSound('stamp');
  }, []);
  function next() {
    const result = engine.nextWord(
      app.save!,
      app.content!,
      view.record.mode === 'oldtech' ? 'oldtech' : 'practice',
      app.today,
    );
    if ('message' in result) setNextMessage(result.message);
    else openRound(result.entry.key, result.entry.itemId, view.record.mode);
  }
  const counted = view.record.mode === 'daily' && view.record.counted_day !== undefined;
  // A grace finish counts for yesterday; today's word may still be waiting.
  const graceful =
    counted && view.record.counted_day !== engine.dayNumber(app.today) && home.today && !home.today.finished;
  function openToday() {
    let itemId = '';
    for (const day of app.content!.schedule.days) {
      if (day.date === app.today) itemId = day.term;
    }
    if (home.today && itemId) openRound(home.today.key, itemId, 'daily');
  }
  return (
    // The card already says "Done for today.", so the heading is for screen readers only.
    <Screen title={counted ? 'Done for today' : 'Done'} quietTitle={counted && !graceful}>
      <div class="after done stack-lg">
        <div class="done-hero">
          <div class="win-mascots">
            <Mascot who="floyd" size={72} pose="wave" />
            <Mascot who="bud" size={72} pose="happy" />
          </div>
          {counted && !graceful ? <p class="done-line">See you tomorrow!</p> : null}
          {counted ? <Counter value={home.daysLearned} from={home.daysLearned - 1} label="Days learned" /> : null}
        </div>
        {badges.map((badge) => (
          <NewBadge key={badge.id} id={badge.id} name={badge.name} />
        ))}
        {graceful ? (
          <Button primary big block onClick={openToday}>
            {home.today && home.today.started ? 'Continue' : "Play today's word"}
          </Button>
        ) : null}
        {nextMessage ? (
          <div class="stack-sm">
            <p class="result-line">{nextMessage}</p>
            <Button block onClick={goBack}>
              Back
            </Button>
          </div>
        ) : null}
        {!counted && !nextMessage ? (
          <Button primary big block onClick={next}>
            Next word
          </Button>
        ) : null}
        <section class="next-up stack-sm">
          <h2>What next?</h2>
          <NextCard
            href={hrefFor('endless')}
            tone="grape"
            icon="infinity"
            title="Play Endless"
            note="Keep going as long as you like."
          />
          {counted && home.todaysLesson && !graceful ? (
            <NextCard
              href={hrefFor('lesson', home.todaysLesson.id)}
              tone="mint"
              icon="learn"
              title={"Today's lesson: " + home.todaysLesson.title}
            />
          ) : (
            <NextCard href={hrefFor('learn')} tone="mint" icon="learn" title="Learn" note="Lessons, one step at a time." />
          )}
          {counted ? <NextCard href={hrefFor('review')} tone="sunny" icon="cards" title={home.reviewLink} /> : null}
          {!counted && !nextMessage ? (
            <Button block variant="ghost" onClick={goBack}>
              Back
            </Button>
          ) : null}
        </section>
        <Announcer message={nextMessage} />
      </div>
    </Screen>
  );
}

function PtpAfter({ roundKey, view }: { roundKey: string; view: RoundView }) {
  const app = useApp();
  const [prompt, setPrompt] = useState(true);
  const r = Number(roundKey.split(':')[2]);
  const item = view.item;
  const solved = view.record.status === 'solved';

  function nextRound() {
    const save = app.save!;
    const set = save.ptpSet;
    if (set && r < set.rounds.length) commit(engine.advancePtp(save));
    navigate('ptp');
  }

  return (
    <Screen title="What it means">
      <div class="after stack">
        <p class="turn-note">
          <GameIcon name="people" size={22} />
          <strong>Turn the screen so you both can see.</strong>
        </p>
        <WinCard roundKey={roundKey} view={view} />
        <div class="word-card cards play-cards">
          <AnswerCard card={answerCardOf(view)} index={1} onPick={() => undefined} />
        </div>
        <ChatLines lines={item.exchange} budPose={solved ? 'happy' : 'oops'} />
        {prompt ? (
          <div class="reader-prompt stack-sm">
            <p>
              {item.old_tech
                ? 'Reader, tell them what you remember.'
                : "Reader, tell them how you've seen it used, or how you use it."}
            </p>
            <Button small onClick={() => setPrompt(false)}>
              Skip
            </Button>
          </div>
        ) : null}
        <Button primary big block onClick={nextRound}>
          {app.save && app.save.ptpSet && r < app.save.ptpSet.rounds.length ? 'Next round' : 'See the summary'}
        </Button>
      </div>
    </Screen>
  );
}
