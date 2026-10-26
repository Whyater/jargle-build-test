import { useEffect, useRef, useState } from 'preact/hooks';
import type { RoundAction, RoundView } from '../../engine/api';
import { engine } from '../engine';
import { useApp, commit } from '../store';
import { goBack } from '../router';
import { playSound } from '../../platform/audio';
import { feedback } from '../components/feedback';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { AnswerCard } from '../components/AnswerCard';
import { BottomBar, InlineStrip, Announcer, usePinned } from '../components/BottomBar';
import { EnergyMeter, RoundAfter } from './RoundAfter';
import {
  justEnded,
  newBadgesByRound,
  shouldIgnoreNextClue,
  stripTextAfterTap,
  tallestMessage,
  xpByRound,
} from './roundLogic';
import { MascotSays } from '../components/MascotSays';
import { poseForMood } from '../art';
import { levelReached, markSeenLevel, readXp } from './homeLogic';
import type { MascotPose } from '../art';
import './round.css';

/** "No. 12" for a daily round key like "d:12"; other rounds have no number. */
function catalogNumber(roundKey: string): string | undefined {
  if (roundKey.indexOf('d:') !== 0) return undefined;
  return 'No. ' + roundKey.slice(2);
}

export function RoundScreen({ roundKey }: { roundKey: string }) {
  const app = useApp();
  if (app.status !== 'ready' || !app.save || !app.content) return null;
  let view: RoundView;
  try {
    view = engine.roundView(app.save, app.content, roundKey, app.today);
  } catch {
    return (
      <Screen title="Word not found">
        <Button primary block onClick={goBack}>
          Back
        </Button>
      </Screen>
    );
  }
  if (!app.save.rounds[roundKey]) {
    return (
      <Screen title="Word not found">
        <Button primary block onClick={goBack}>
          Back
        </Button>
      </Screen>
    );
  }
  if (view.ended && view.record.post_step > 0) {
    return <RoundAfter roundKey={roundKey} view={view} />;
  }
  if (view.ended) {
    if (
      view.record.status === 'learned' &&
      view.cards.some((card) => card.state === 'missed') &&
      view.cards.some((card) => card.state === 'answer')
    ) {
      return <EndedMissBoard roundKey={roundKey} view={view} />;
    }
    return <RoundAfter roundKey={roundKey} view={view} />;
  }
  return <PlayingRound roundKey={roundKey} view={view} />;
}

function EndedMissBoard({ roundKey, view }: { roundKey: string; view: RoundView }) {
  const [open, setOpen] = useState(false);
  // Bring the right answer into view, since the banner points to it. It waits a moment
  // because the screen frame scrolls to the top when it opens.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const answer = document.querySelector('.answer-card.is-answer');
      if (!answer) return;
      const box = answer.getBoundingClientRect();
      const bar = document.querySelector('.after-actions');
      const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      if (box.bottom > bottom) window.scrollBy(0, box.bottom - bottom + 16);
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);
  if (open) return <RoundAfter roundKey={roundKey} view={view} />;
  return (
    <Screen title={view.title} runhead={catalogNumber(roundKey)}>
      <div class="round play-screen stack">
        <EnergyMeter view={view} />
        <div class="miss-banner">
          <MascotSays who="bud" pose="oops" size={64} text="Here's the answer. A miss still teaches you a word." />
        </div>
        <ul class="cards play-cards">
          {view.cards.map((card, i) => (
            <li key={card.term}>
              <AnswerCard card={card} index={i + 1} onPick={() => undefined} />
            </li>
          ))}
        </ul>
        <div class="after-actions">
          <Button primary big block onClick={() => setOpen(true)}>
            See what it means
          </Button>
        </div>
        <Announcer message="" />
      </div>
    </Screen>
  );
}

function PlayingRound({ roundKey, view }: { roundKey: string; view: RoundView }) {
  const app = useApp();
  const save = app.save!;
  const content = app.content!;
  // A miss line is saved with the round, so it comes back after a reload.
  const [message, setMessage] = useState(view.missLine || view.warning || '');
  const [anchor, setAnchor] = useState<'card' | 'clue' | 'button' | 'flip'>('button');
  const [confirm, setConfirm] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [pose, setPose] = useState<MascotPose>(poseForMood(view.budMood));
  // Index of the clue that was just added, so only that one flips in.
  const [flipClue, setFlipClue] = useState(-1);
  const [peek, setPeek] = useState(false);
  const [reveal, setReveal] = useState<{ kind: 'card' | 'clue' } | null>(null);
  const cardList = useRef<HTMLUListElement>(null);
  const clueList = useRef<HTMLOListElement>(null);
  const [firstTap, setFirstTap] = useState(false);
  const [largestScroll, setLargestScroll] = useState(false);
  const [firstCheck, setFirstCheck] = useState(false);
  const [lastClueTap, setLastClueTap] = useState(0);
  const firstCard = useRef<HTMLButtonElement | null>(null);
  const inlineRef = useRef<HTMLDivElement | null>(null);
  const checkRef = useRef<HTMLButtonElement | null>(null);
  const { barRef, pinned, measuring } = usePinned(save.settings.textSize);
  const tallest = tallestMessage(content);

  useEffect(() => {
    const measure = () => {
      let visibleBottom = window.innerHeight;
      const bar = barRef.current || document.querySelector('.bottom-bar');
      if (bar) {
        const style = window.getComputedStyle(bar);
        if (bar.classList.contains('pinned') || style.position === 'fixed') {
          visibleBottom = bar.getBoundingClientRect().top;
        }
      }
      if (
        firstCard.current &&
        (firstCard.current.getBoundingClientRect().top >= window.innerHeight ||
          firstCard.current.getBoundingClientRect().top >= visibleBottom)
      )
        setLargestScroll(true);
      if (save.settings.textSize === 'largest') setLargestScroll(true);
    };
    measure();
  }, [save.settings.textSize, pinned]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        const card = view.cards[index];
        if (card && card.state === 'live') {
          event.preventDefault();
          tap({ type: 'select', term: card.term }, 'card');
        }
      } else if (
        event.key === 'Enter' &&
        document.activeElement &&
        (document.activeElement.classList.contains('answer-card') ||
          document.activeElement === checkRef.current)
      ) {
        event.preventDefault();
        tap({ type: 'check' }, 'button');
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  useEffect(() => {
    if (confirm) {
      setConfirmReady(false);
      const timer = window.setTimeout(() => setConfirmReady(true), 700);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [confirm]);

  useEffect(() => {
    if (!pinned && message && inlineRef.current) {
      try {
        inlineRef.current.scrollIntoView({ block: 'nearest' });
      } catch {
        inlineRef.current.scrollIntoView(false);
      }
    }
  }, [message, pinned]);

  // With the bar pinned, the newest clue or a flipped wrong card can end up hidden behind it,
  // so scroll it into the space above the bar. That is what the player needs to read next.
  useEffect(() => {
    if (!pinned || !reveal || !barRef.current) return;
    const list = reveal.kind === 'card' ? cardList.current : clueList.current;
    if (!list || list.children.length === 0) return;
    const target = list.children[list.children.length - 1] as HTMLElement;
    const visibleBottom = window.innerHeight - barRef.current.offsetHeight;
    const overlap = target.getBoundingClientRect().bottom - visibleBottom;
    if (overlap > 0) window.scrollBy(0, overlap + 8);
  }, [reveal]);

  function tap(action: RoundAction, nextAnchor: 'card' | 'clue' | 'button' | 'flip') {
    if (action.type !== 'showAnswer') setConfirm(false);
    if (action.type === 'nextClue') {
      const now = Date.now();
      if (shouldIgnoreNextClue(lastClueTap, now)) return;
      setLastClueTap(now);
    }
    const result = engine.applyRound(save, content, roundKey, action, app.today);
    commit(result.state);
    const nextView = engine.roundView(result.state, content, roundKey, app.today);
    const resultMessage =
      action.type === 'check' && result.outcome === 'wrong' && nextView.missLine
        ? nextView.missLine
        : result.message;
    setMessage(
      stripTextAfterTap(
        message,
        resultMessage,
        nextView.warning,
        action.type,
      ) || '',
    );
    // A wrong card flips and moves to the end of the list, so the strip goes under the cards.
    setAnchor(result.outcome === 'wrong' ? 'flip' : nextAnchor);
    // A new object each time, so the scroll effect runs again even for the same kind.
    if (result.outcome === 'wrong') setReveal({ kind: 'card' });
    else if (action.type === 'nextClue') setReveal({ kind: 'clue' });
    if (action.type === 'nextClue' && nextView.clues.length > view.clues.length) {
      setFlipClue(nextView.clues.length - 1);
    }
    // Bud looks worried after a miss and thinks while you pick.
    let nextPose = poseForMood(nextView.budMood);
    if (nextPose === 'idle' && action.type === 'select') nextPose = 'think';
    setPose(nextPose);
    if (action.type === 'select') {
      setFirstTap(true);
      playSound('tap');
    }
    if (action.type === 'nextClue') playSound('flick');
    // A round that ends by crossing into a new level plays the level-up sound instead of the
    // usual one, so the player hears one cheer, not two stacked chimes.
    const xpAfter = readXp(result.state);
    const crossed = levelReached(xpAfter - (result.xpGained || 0), xpAfter);
    // Mark it now, not only on the reveal: the player can leave from the miss board, and Play
    // would then cheer the same level a second time.
    if (crossed) markSeenLevel(crossed);
    if (action.type === 'check') {
      setFirstCheck(true);
      if (result.outcome === 'wrong') {
        feedback('wrong');
        checkRef.current?.focus();
      }
      if (result.outcome === 'solved') feedback(crossed ? 'levelUp' : 'correct');
      if (result.outcome === 'learned') {
        if (crossed) feedback('levelUp');
        else playSound('twoNotes');
      }
    }
    if (action.type === 'showAnswer') {
      if (crossed) feedback('levelUp');
      else playSound('twoNotes');
    }
    const record = result.state.rounds[roundKey];
    if (record && record.status !== 'playing') {
      justEnded.add(roundKey);
      newBadgesByRound.set(roundKey, result.newBadges);
      // The engine adds the XP when the round ends; the reveal shows how much.
      xpByRound.set(roundKey, result.xpGained);
    }
  }

  const line = message || '';
  let pickPrompt = 'Which word is it?';
  if (view.firstRound && largestScroll && !firstCheck) {
    pickPrompt = 'Scroll down for all four words.';
  } else if (view.firstRound && !firstTap) {
    pickPrompt = 'Pick a word, then tap Check.';
  } else if (pose === 'oops') {
    pickPrompt = 'Not that one. Pick again!';
  }
  const inline =
    !pinned && line ? (
      <InlineStrip
        message={line}
        stripRef={(el) => {
          inlineRef.current = el;
        }}
      />
    ) : null;

  return (
    <Screen title={view.title} runhead={catalogNumber(roundKey)}>
      <div class="round stack">
        <EnergyMeter view={view}>
          {view.justForFun ? <p class="energy-note">{view.justForFun}</p> : null}
        </EnergyMeter>
        {view.mode === 'ptp' ? <p class="round-hint">Reader: add your own hint if you like.</p> : null}
        {view.mode === 'ptp' ? (
          <div class="choice-row">
            <button
              type="button"
              class="choice"
              aria-pressed={peek ? 'true' : 'false'}
              onClick={() => setPeek(!peek)}
            >
              Peek at the answer
            </button>
            {peek ? <div class="note-box">Answer: {view.item.term}</div> : null}
          </div>
        ) : null}
        <p class="climb-label">
          <span>Clues</span>
          <span class="climb-pips" aria-hidden="true">
            {view.item.clues.map((_clue, i) => (
              <span key={i} class={i < view.clues.length ? 'pip on' : 'pip'} />
            ))}
          </span>
          <span class="climb-count">
            {view.clues.length} of {view.item.clues.length}
          </span>
        </p>
        <ol class="clues clue-stack" ref={clueList}>
          {view.clues.map((clue, i) => (
            // Only a clue added on this visit flips in; the ones already there just sit still.
            <li key={i} class={i === view.clues.length - 1 ? 'clue newest' + (flipClue === i ? ' flip-in' : '') : 'clue'}>
              <span class="n" aria-hidden="true">
                {i + 1}
              </span>
              <span class="visually-hidden">Clue {i + 1}: </span>
              <span class="clue-text">{clue}</span>
            </li>
          ))}
        </ol>
        {inline && anchor === 'clue' ? inline : null}
        {/* Bud asks the question. On the first round he also explains the controls. */}
        <div class="pick-row">
          <MascotSays who="bud" pose={pose} size={76} text={pickPrompt} lines={BUD_TIPS} />
        </div>
        <ul class="cards play-cards" ref={cardList}>
          {view.cards.map((card, i) => (
            <li key={card.term}>
              <AnswerCard
                card={card}
                index={i + 1}
                cardRef={
                  i === 0
                    ? (el) => {
                        firstCard.current = el;
                      }
                    : undefined
                }
                onPick={(term) => tap({ type: 'select', term }, 'card')}
              />
            </li>
          ))}
        </ul>
        {inline && (anchor === 'card' || anchor === 'flip') ? inline : null}
        {view.mode !== 'ptp' ? <p class="desktop-tip">Tip: press 1 to 4 to pick, Enter to check.</p> : null}
        {confirm ? (
          <div class="confirm stack-sm">
            <p>
              <strong>Show the answer now?</strong>
            </p>
            <Button block variant="mint" onClick={() => setConfirm(false)}>
              Keep playing
            </Button>
            <Button
              block
              disabled={!confirmReady}
              onClick={() => tap({ type: 'showAnswer' }, 'button')}
            >
              {confirmReady ? 'Yes, show it' : 'Yes, show it (wait a moment)'}
            </Button>
          </div>
        ) : view.canShowAnswer ? (
          <Button
            block
            variant="ghost"
            onClick={() => {
              setConfirm(true);
              setAnchor('button');
            }}
          >
            Show me the answer
          </Button>
        ) : null}
        {inline && anchor === 'button' ? inline : null}
        <BottomBar
          pinned={pinned}
          barRef={barRef}
          measuring={measuring}
          message={line}
          tallestMessage={tallest}
        >
          <div class="bar-buttons bar-row">
            <Button
              variant="sunny"
              gameIcon="bolt"
              disabled={!view.nextClue.enabled}
              onClick={() => tap({ type: 'nextClue' }, 'clue')}
            >
              <ClueLabel text={view.nextClue.enabled ? view.nextClue.label : view.nextClue.reason || view.nextClue.label} />
            </Button>
            <Button
              primary
              id="check"
              buttonRef={(el) => {
                checkRef.current = el;
              }}
              onClick={() => tap({ type: 'check' }, 'button')}
            >
              Check
            </Button>
          </div>
        </BottomBar>
        <Announcer message={line} />
      </div>
    </Screen>
  );
}

// What Bud says when you tap him during a round.
const BUD_TIPS = ['You can do it!', 'Read the clue one more time.', 'Not sure? Next clue helps.'];

/** "Next clue (costs 1 bar)" shows as a bold "Next clue" with the cost in small print under it. */
function ClueLabel({ text }: { text: string }) {
  const cut = text.indexOf(' (');
  if (cut === -1 || text.charAt(text.length - 1) !== ')') return <>{text}</>;
  return (
    <span class="clue-label">
      <span>{text.slice(0, cut)}</span>{' '}
      <span class="clue-label-cost">{text.slice(cut + 2, text.length - 1)}</span>
    </span>
  );
}
