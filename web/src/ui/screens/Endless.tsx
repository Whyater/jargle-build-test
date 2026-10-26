import { useEffect, useRef, useState } from 'preact/hooks';
import type { EndlessAnswer, EndlessAnswerResult, EndlessRun, SaveState } from '../../engine/types';
import { commit, useApp } from '../store';
import { hrefFor } from '../router';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { Hearts } from '../components/Hearts';
import { XpBadge } from '../components/XpBadge';
import { ProgressBar } from '../components/ProgressBar';
import { Confetti } from '../components/Confetti';
import { MascotSays } from '../components/MascotSays';
import { SpeechBubble } from '../components/SpeechBubble';
import { Mascot } from '../components/Mascot';
import { GameIcon } from '../components/GameIcon';
import { XpFloat, showToast } from '../components/Toast';
import { feedback } from '../components/feedback';
import { reducedMotion } from '../components/motion';
import { QuestionView, KIND_NAMES } from '../questions';
import { ignoreKey } from '../questions/keys';
import { getEndlessApi } from './endlessEngine';
import { pickLine } from './endlessLines';
import { markSeenLevel, seenLevel } from './homeLogic';
import {
  ADVANCE_MS,
  answerAnnouncement,
  comboMeter,
  hintFor,
  isNewBest,
  newSeed,
  reactionMood,
  finishRunOnce,
  shouldSaveOnLeave,
  speakerFor,
} from './endlessLogic';
import '../../styles/endless.css';

type Phase = 'start' | 'play' | 'over';

/** What the game over screen shows, worked out once when the run ends. */
interface Summary {
  run: EndlessRun;
  oldBest: number;
  newBest: boolean;
  levelBefore: number;
  levelAfter: number;
  /** True when the new level was not already cheered during the run. */
  freshLevel: boolean;
  xpAfter: number;
}

export function EndlessScreen() {
  const app = useApp();
  const api = getEndlessApi();
  const [phase, setPhase] = useState<Phase>('start');
  const [run, setRun] = useState<EndlessRun | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [last, setLast] = useState<EndlessAnswerResult | null>(null);
  const [line, setLine] = useState('');
  const [turn, setTurn] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  // XP on this phone when the run started, so the header can show the level going up live.
  const [xpAtStart, setXpAtStart] = useState(0);
  const [levelBurst, setLevelBurst] = useState(0);

  // The latest values for timers and the leave handler, which outlive a render.
  const runRef = useRef<EndlessRun | null>(null);
  const savedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const appRef = useRef(app);
  // The auto-advance timer must call the newest next(), not the one from an old render.
  const nextRef = useRef<() => void>(() => {});
  runRef.current = run;
  appRef.current = app;

  // Leaving mid-run (Back, a tab, closing the screen) still saves the run so its XP is kept.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const current = getAppSave();
      const run = runRef.current;
      if (current && run && shouldSaveOnLeave(run, savedRef.current)) {
        finishRunOnce(savedRef, () => commit(getEndlessApi().finishEndless(current.save, run, current.today)));
        runRef.current = null;
      }
    };
  }, []);

  function getAppSave(): { save: SaveState; today: string } | null {
    const a = appRef.current;
    if (!a.save) return null;
    return { save: a.save, today: a.today };
  }

  if (!app.save || !app.content) return null;
  const save = app.save;
  const content = app.content;

  function start() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const fresh = api.startEndless(save, content, app.today, newSeed(Date.now()));
    if (!fresh.question) {
      showToast('No words to play yet. Come back tomorrow!', 'coral');
      return;
    }
    runRef.current = fresh;
    savedRef.current = false;
    setXpAtStart(save.xp || 0);
    setRun(fresh);
    setPicked(null);
    setLast(null);
    setSummary(null);
    setLevelBurst(0);
    setTurn(0);
    setLine(fresh.question ? hintFor(fresh.question) : '');
    setAnnounce('');
    setPhase('play');
  }

  function next() {
    const current = runRef.current;
    if (!current) return;
    if (current.over) {
      endRun(current);
      return;
    }
    const moved = api.nextEndlessQuestion(current, content);
    runRef.current = moved;
    setRun(moved);
    setPicked(null);
    setLast(null);
    setTurn(turn + 1);
    setLine(moved.question ? hintFor(moved.question) : '');
  }

  function answer(given: EndlessAnswer) {
    const current = runRef.current;
    if (!current || current.answered || current.over || !current.question) return;
    const result = api.answerEndless(current, given);
    const who = speakerFor(turn);
    // Update the ref right away, so a fast second tap or key press sees the answered run.
    runRef.current = result.run;
    setRun(result.run);
    setPicked(given.choice);
    setLast(result);
    setLine(pickLine(who, reactionMood(result), result.run.asked));
    setAnnounce(answerAnnouncement(result, current.question));

    // A level reached mid-run gets its own little moment. Its sound already starts with the
    // right-answer chime, so only one of the two plays.
    const levelBefore = api.levelFromXp(xpAtStart + current.xp).level;
    const levelNow = api.levelFromXp(xpAtStart + result.run.xp).level;
    if (levelNow > levelBefore) {
      showToast('Level ' + levelNow + '!', 'sunny', 'star');
      feedback('levelUp');
      setLevelBurst(levelNow);
      setLine(pickLine(who, 'levelUp', result.run.asked));
      // Play celebrates new levels too; mark this one as shown so it is not cheered twice.
      markSeenLevel(levelNow);
    } else {
      feedback(result.correct ? 'correct' : 'wrong');
    }

    if (result.correct && !result.run.over) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        nextRef.current();
      }, ADVANCE_MS);
    }
  }

  nextRef.current = next;

  function endRun(finished: EndlessRun) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const oldBest = save.endlessBest || 0;
    const xpBefore = save.xp || 0;
    let after = save;
    finishRunOnce(savedRef, () => {
      after = api.finishEndless(save, finished, app.today);
      commit(after);
    });
    const xpAfter = after.xp || 0;
    const levelBefore = api.levelFromXp(xpBefore).level;
    const levelAfter = api.levelFromXp(xpAfter).level;
    const result: Summary = {
      run: finished,
      oldBest,
      newBest: isNewBest(finished.score, oldBest),
      levelBefore,
      levelAfter,
      // A level already cheered mid-run is shown again here, but without a second burst.
      freshLevel: levelAfter > levelBefore && levelAfter > seenLevel(),
      xpAfter,
    };
    setSummary(result);
    setPhase('over');
    if (result.newBest || result.freshLevel) feedback('levelUp');
    if (result.levelAfter > result.levelBefore) markSeenLevel(result.levelAfter);
  }

  /** The X in the header: end the run now and see the score. Before any answer it just goes back. */
  function quit() {
    const current = runRef.current;
    if (!current || !shouldSaveOnLeave(current, savedRef.current)) {
      setRun(null);
      setPhase('start');
      return;
    }
    endRun(current);
  }

  if (phase === 'play' && run && run.question) {
    return (
      <RunView
        run={run}
        picked={picked}
        last={last}
        line={line}
        turn={turn}
        announce={announce}
        xpNow={xpAtStart + run.xp}
        levelFromXp={api.levelFromXp}
        comboMultiplier={api.comboMultiplier}
        onAnswer={answer}
        onNext={next}
        onQuit={quit}
        levelBurst={levelBurst}
      />
    );
  }
  if (phase === 'over' && summary) {
    return <GameOver summary={summary} levelFromXp={api.levelFromXp} onAgain={start} />;
  }
  return <StartView best={save.endlessBest || 0} games={save.endlessGames || 0} onStart={start} />;
}

// ---- Start ----------------------------------------------------------------

function StartView({ best, games, onStart }: { best: number; games: number; onStart: () => void }) {
  useEnterKey(onStart);
  const hello = pickLine('bud', 'hello', games);
  return (
    <Screen title="Endless">
      <div class="en-start">
        <div class="en-stage">
          <SpeechBubble text={hello} tail="bottom" />
          <div class="en-stage-mascots">
            <Mascot who="floyd" size={120} pose="wave" />
            <Mascot who="bud" size={120} pose="happy" />
          </div>
        </div>

        <div class="en-best" role="img" aria-label={best > 0 ? 'Best score ' + best : 'No best score yet'}>
          <span class="en-best-icon" aria-hidden="true">
            <GameIcon name="trophy" size={28} />
          </span>
          <span class="en-best-text" aria-hidden="true">
            <span class="en-best-label">{best > 0 ? 'Best score. Beat it!' : 'Best score'}</span>
            <span class="en-best-num">{best > 0 ? best : 'No best yet'}</span>
          </span>
        </div>

        {/* Start sits right under the best score, so it is on screen even on small phones. */}
        <Button variant="primary" big block gameIcon="play" sound onClick={onStart}>
          Start
        </Button>
        <ul class="en-rules">
          <li>
            <span class="en-rule-icon heart" aria-hidden="true">
              <GameIcon name="heart" size={22} />
            </span>
            3 hearts
          </li>
          <li>
            <span class="en-rule-icon bolt" aria-hidden="true">
              <GameIcon name="bolt" size={22} />
            </span>
            Combos up to x3
          </li>
          <li>
            <span class="en-rule-icon infinity" aria-hidden="true">
              <GameIcon name="infinity" size={22} />
            </span>
            Play forever
          </li>
        </ul>

      </div>
    </Screen>
  );
}

// ---- The run --------------------------------------------------------------

interface RunViewProps {
  run: EndlessRun;
  picked: string | null;
  last: EndlessAnswerResult | null;
  line: string;
  turn: number;
  announce: string;
  xpNow: number;
  levelFromXp: (xp: number) => { level: number; intoLevel: number; needed: number };
  comboMultiplier: (combo: number) => number;
  onAnswer: (answer: EndlessAnswer) => void;
  onNext: () => void;
  onQuit: () => void;
  /** The level just reached mid-run (0 for none), so confetti fires once per new level. */
  levelBurst: number;
}

function RunView(props: RunViewProps) {
  const { run, picked, last } = props;
  const question = run.question!;
  const nextButton = useRef<HTMLButtonElement | null>(null);
  const answered = picked !== null;
  const wrong = answered && last !== null && !last.correct;

  // A new question: move focus to it so keyboard and screen reader users start there.
  useEffect(() => {
    const prompt = document.getElementById('en-prompt');
    if (prompt) prompt.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [question.id]);

  // A wrong answer: focus Next, so Enter or Space moves on, and bring the why line into view.
  useEffect(() => {
    if (!wrong) return;
    if (nextButton.current) nextButton.current.focus({ preventScroll: true });
    const why = document.querySelector('.en-why');
    if (why && why.scrollIntoView) why.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [wrong, question.id]);

  useEnterKey(wrong ? props.onNext : null);

  const level = props.levelFromXp(props.xpNow);
  const meter = comboMeter(run.combo);
  const multiplier = props.comboMultiplier(run.combo);
  // A right answer now would earn this, which is what the clue question's "Worth" shows.
  const nextMultiplier = props.comboMultiplier(run.combo + 1);
  const who = speakerFor(props.turn);
  const pose = !answered ? 'idle' : last && last.correct ? 'happy' : 'oops';
  const reward = last && last.correct ? '+' + last.points : null;
  // Hearts lost so far: the newest one gets the break animation.
  const brokeHeart = wrong ? run.hearts : -1;

  return (
    <div class={'sheet en-run' + (wrong ? ' is-wrong' : '') + (answered && !wrong ? ' is-right' : '')}>
      <h1 class="visually-hidden">Endless</h1>
      <header class="en-hud">
        <div class="en-hud-row">
          <button type="button" class="icon-btn en-quit" aria-label="End run" onClick={props.onQuit}>
            <GameIcon name="close" />
          </button>
          <div class="en-hearts">
            <Hearts left={run.hearts} />
            {brokeHeart >= 0 ? <HeartBreak index={brokeHeart} key={'break' + run.asked} /> : null}
          </div>
          <div class="en-score" role="img" aria-label={'Score ' + run.score}>
            <span class="en-score-num" key={run.score} aria-hidden="true">
              {run.score}
            </span>
          </div>
        </div>
        <div class="en-hud-row two">
          <div
            class={'en-combo m' + multiplier}
            role="img"
            aria-label={'Combo ' + run.combo + ', points times ' + multiplier}
          >
            <span class="en-mult" key={'m' + multiplier}>
              x{multiplier}
            </span>
            <span class="en-pips" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} class={i < meter.filled ? 'pip on' : 'pip'} />
              ))}
            </span>
            <span class="en-combo-count" key={'c' + run.combo} aria-hidden="true">
              {run.combo > 0 ? run.combo + ' in a row' : 'Combo'}
            </span>
          </div>
          <div class="en-level">
            <Confetti burst={props.levelBurst} />
            <XpBadge level={level.level} />
            <div class="en-level-bar">
              <ProgressBar
                value={level.intoLevel}
                max={level.needed}
                tone="sunny"
                label={'Level ' + level.level + ': ' + level.intoLevel + ' of ' + level.needed + ' XP'}
              />
              <XpFloat amount={last ? last.xpGained : 0} burst={last && last.correct ? run.asked : 0} />
            </div>
          </div>
        </div>
      </header>

      <main class="en-main">
        <QuestionView
          question={question}
          picked={picked}
          onAnswer={props.onAnswer}
          reward={reward}
          keysOn={!answered}
          promptId="en-prompt"
          tag={KIND_NAMES[question.kind]}
          multiplier={nextMultiplier}
        />

        <section class="en-react" aria-label={who === 'floyd' ? 'Floyd says' : 'Bud says'}>
          <MascotSays who={who} text={props.line} pose={pose} size={answered ? 76 : 64} key={who + props.turn + (answered ? 'a' : 'q')} />
          <div class="en-after">
            {wrong ? (
              <>
                <div class="en-why">
                  <p class="en-why-text">
                    <WhyLine why={question.why} />
                  </p>
                </div>
                {/* Sticks to the bottom of the screen when the why line pushes it out of view. */}
                <div class="en-nextbar">
                  <Button variant="primary" big block onClick={props.onNext} buttonRef={(el) => (nextButton.current = el)}>
                    {run.over ? 'See my score' : 'Next'}
                  </Button>
                </div>
              </>
            ) : null}
            {answered && !wrong ? (
              <div class="en-advance" aria-hidden="true">
                <span class="en-advance-fill" style={{ animationDuration: ADVANCE_MS + 'ms' }} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <p class="visually-hidden" role="status" aria-live="assertive">
        {props.announce}
      </p>
    </div>
  );
}

/** "Cache: a place ..." with the word in bold. */
function WhyLine({ why }: { why: string }) {
  const cut = why.indexOf(': ');
  if (cut < 0) return <>{why}</>;
  return (
    <>
      <strong>{why.slice(0, cut)}</strong>
      {why.slice(cut)}
    </>
  );
}

/** Two heart halves that crack apart over the heart that was just lost. */
function HeartBreak({ index }: { index: number }) {
  if (reducedMotion()) return null;
  return (
    <span class="en-heartbreak" style={{ '--i': index }} aria-hidden="true">
      <span class="half left">
        <GameIcon name="heart" size={26} />
      </span>
      <span class="half right">
        <GameIcon name="heart" size={26} />
      </span>
    </span>
  );
}

// ---- Game over ------------------------------------------------------------

interface GameOverProps {
  summary: Summary;
  levelFromXp: (xp: number) => { level: number; intoLevel: number; needed: number };
  onAgain: () => void;
}

function GameOver({ summary, levelFromXp, onAgain }: GameOverProps) {
  useEnterKey(onAgain);
  const { run } = summary;
  const levelUp = summary.levelAfter > summary.levelBefore;
  const level = levelFromXp(summary.xpAfter);
  const celebrate = summary.newBest || levelUp;
  const burst = summary.newBest || summary.freshLevel;
  const floydLine = pickLine('floyd', summary.newBest ? 'best' : 'over', run.asked);
  const budLine = pickLine('bud', levelUp ? 'levelUp' : summary.newBest ? 'best' : 'over', run.asked);
  const best = summary.newBest ? run.score : summary.oldBest;

  return (
    <Screen title="Game over">
      <div class="en-over">
        <div class={'en-scorecard' + (summary.newBest ? ' best' : '')}>
          <Confetti burst={burst ? 1 : 0} />
          {summary.newBest ? (
            <p class="en-ribbon">
              <GameIcon name="trophy" size={20} />
              New best!
            </p>
          ) : null}
          <p class="en-final-label">Your score</p>
          <p class="en-final">{run.score}</p>
          <p class="en-final-best">{summary.newBest ? 'Old best: ' + summary.oldBest : 'Best: ' + best}</p>
        </div>

        <ul class="en-stats">
          <li>
            <span class="num">{run.correct}</span>
            <span class="label">{run.correct === 1 ? 'right answer' : 'right answers'}</span>
          </li>
          <li>
            <span class="num">{run.bestCombo}</span>
            <span class="label">best combo</span>
          </li>
          <li class="xp">
            <span class="num">+{run.xp}</span>
            <span class="label">XP</span>
          </li>
        </ul>

        <div class={'en-levelcard' + (levelUp ? ' up' : '')}>
          <XpBadge level={level.level} />
          <div class="en-levelcard-text">
            <p class="en-levelcard-title">{levelUp ? 'Level up! You reached level ' + level.level : 'Level ' + level.level}</p>
            <ProgressBar
              value={level.intoLevel}
              max={level.needed}
              tone="sunny"
              big
              label={'Level ' + level.level + ': ' + level.intoLevel + ' of ' + level.needed + ' XP'}
            />
            <p class="en-levelcard-note">
              {level.needed - level.intoLevel} XP to level {level.level + 1}
            </p>
          </div>
        </div>

        <div class="en-over-says">
          <MascotSays who={levelUp ? 'bud' : 'floyd'} text={levelUp ? budLine : floydLine} pose={celebrate ? 'happy' : 'wave'} size={80} />
        </div>

        {/* Pinned to the bottom so Play again is always in reach, even on small phones. */}
        <div class="en-over-actions">
          <Button variant="primary" big block gameIcon="play" sound onClick={onAgain}>
            Play again
          </Button>
          <LinkButton block variant="ghost" href={hrefFor('home')}>
            Home
          </LinkButton>
        </div>
      </div>
    </Screen>
  );
}

// ---- Shared bits ----------------------------------------------------------

/** Enter runs `action`, unless focus is on a button or link (those handle Enter themselves). */
function useEnterKey(action: (() => void) | null) {
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Enter' || ignoreKey(event) || !actionRef.current) return;
      const target = event.target as HTMLElement | null;
      const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
      if (tag === 'button' || tag === 'a') return;
      event.preventDefault();
      actionRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
