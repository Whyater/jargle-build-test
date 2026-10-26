import { useEffect, useState } from 'preact/hooks';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { Battery } from '../components/Battery';
import { Card } from '../components/Card';
import { GameIcon } from '../components/GameIcon';
import type { GameIconName } from '../components/GameIcon';
import { MascotSays } from '../components/MascotSays';
import { MascotStage } from '../components/MascotStage';
import { Confetti } from '../components/Confetti';
import { showToast } from '../components/Toast';
import { feedback } from '../components/feedback';
import { ProgressBar } from '../components/ProgressBar';
import { Streak, XpBadge } from '../components/XpBadge';
import { InAppNote } from './InAppNote';
import { HomeLessonsCard } from './HomeLessonsCard';
import { commit, useApp } from '../store';
import { engine } from '../engine';
import { hrefFor, navigate } from '../router';
import { openRound, shortDate } from '../actions';
import { showJudgesLine } from '../../config';
import {
  countdownText,
  fallbackLevel,
  greetingFor,
  introSeen,
  markSeenLevel,
  seenLevel,
  shouldCelebrateLevel,
  judgeLineVisible,
  markIntroSeen,
  msUntilTomorrow,
  readEndlessBest,
  readXp,
  todayItemId,
  wotdState,
} from './homeLogic';
import type { WotdState } from './homeLogic';
import type { ContentBundle, SaveState, TextSize } from '../../engine/types';
import type { HomeView } from '../../engine/api';
// --- Daily Jargle (v2.1) ---
import type { JargleView } from '../../engine/api';
import { JargleMini } from './JargleMini';

export function HomeScreen() {
  const app = useApp();
  // Set when the intro ends, so Word of the Day pulses once to show where to start.
  const [justIntroduced, setJustIntroduced] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  if (!app.save || !app.content) return <Screen title="Jargle" isHome quietTitle children={null} />;

  const save = app.save;
  const content = app.content;
  const today = app.today;
  const hv = engine.homeView(save, content, today);
  const judges = judgeLineVisible(showJudgesLine, app.demo);

  if (hv.phase === 'prelaunch') {
    return (
      <Screen title="Jargle" isHome quietTitle>
        <div class="home">
          <BrandRow />
          <MascotSays who="floyd" pose="wave" text="Jargle starts soon. Want a sneak peek?" />
          <LinkButton primary big block href="?demo=new">
            Try the demo
          </LinkButton>
          {judges ? <JudgesLine /> : null}
        </div>
      </Screen>
    );
  }

  // A brand new player meets the mascots first (two quick steps, then straight to Play).
  if (showIntro && hv.phase === 'first') {
    return (
      <Intro
        save={save}
        onDone={() => {
          markIntroSeen();
          setShowIntro(false);
          setJustIntroduced(true);
        }}
      />
    );
  }

  // --- Daily Jargle (v2.1) --- Play opens the letter grid game instead of the clue round.
  function openToday() {
    if (!hv.today) return;
    const itemId = todayItemId(content, today);
    if (!itemId) return;
    // Pressing Play also answers the text size question.
    if (!save.flags.textSizeAsked) {
      commit({ ...save, flags: { ...save.flags, textSizeAsked: true } });
    }
    navigate('jargle');
  }

  function openGrace() {
    if (!hv.grace) return;
    const date = engine.dateOfDay(hv.grace.day);
    for (const day of content.schedule.days) {
      if (day.date === date) {
        openRound(hv.grace.key, day.term, 'daily');
        return;
      }
    }
  }

  let wotd = wotdState(hv, save);
  // --- Daily Jargle (v2.1) --- once today's Jargle is played, it decides the card.
  const jargle = engine.jargleView(save, content, today);
  if (jargle && jargle.finished) {
    wotd = jargle.status === 'won' ? { kind: 'solved', bars: 0 } : { kind: 'missed' };
  } else if (jargle && jargle.started && wotd.kind === 'play') {
    wotd = { kind: 'continue' };
  } else if (wotd.kind === 'play' && hv.phase === 'played') {
    // A progress code brings back the counted day but not the game itself, so show the day as done.
    wotd = { kind: 'missed' };
  }
  const finished = wotd.kind === 'solved' || wotd.kind === 'missed';
  const greeting = greetingFor(wotd.kind, hv.streak, new Date().getHours());
  const bigText = save.settings.textSize === 'largest';
  const stage = (
    <MascotStage
      who={greeting.who}
      pose={greeting.pose}
      text={greeting.text}
      size={100}
      floydLines={FLOYD_LINES}
      budLines={BUD_LINES}
    />
  );

  return (
    <Screen title="Jargle" isHome quietTitle>
      <div class="home">
        <BrandRow />
        <ProgressHeader save={save} streak={hv.streak} />

        {bigText ? null : stage}

        <InAppNote />

        {/* Once today's word is done, Endless becomes the big next step. */}
        {finished ? <EndlessCard best={readEndlessBest(save)} featured /> : null}

        <WordOfTheDay hv={hv} wotd={wotd} jargle={jargle} today={today} pulse={justIntroduced} onPlay={openToday} />

        {/* At the biggest text the greeting moves under the card, so Play stays on the first screen. */}
        {bigText ? stage : null}

        {hv.grace ? (
          <Card tone="sunny" onClick={openGrace} class="mini-card wide">
            <span class="mini-icon sunny">
              <GameIcon name="clock" />
            </span>
            <span class="mini-text">
              <span class="mini-title">Finish yesterday's word</span>
              <span class="mini-note">It still counts for your streak.</span>
            </span>
            <GameIcon name="chevron" />
          </Card>
        ) : null}

        {finished ? null : <EndlessCard best={readEndlessBest(save)} />}

        {/* Desktop grid (v2.1): a Lessons tile that only wide screens show. */}
        <HomeLessonsCard save={save} content={content} today={today} />

        <MoreGames hv={hv} save={save} content={content} today={today} />

        {app.demo === 'judge' ? (
          <p class="note-box small">
            Demo: a made-up history with 8 days learned. Try Pass the Phone, or pick a wrong word to see what it means.
          </p>
        ) : null}

        {judges ? <JudgesLine /> : null}
      </div>
    </Screen>
  );
}

// What Floyd and Bud say when you tap them on Play.
const FLOYD_LINES = [
  "I hold 1.44 MB. That's less than one phone photo!",
  'One new word a day keeps your streak going.',
  'Ask me about Old Tech. I was there!',
];
const BUD_LINES = [
  'My screen is my face. Cute, right?',
  'Endless is my favorite. How far can you go?',
  "Tap Play and I'll give you the first clue.",
];

function BrandRow() {
  return (
    <div class="home-brand">
      <span class="wordmark" aria-hidden="true">
        Jargle
      </span>
      <a class="icon-btn" href={hrefFor('how')} aria-label="How to play">
        <GameIcon name="help" />
      </a>
    </div>
  );
}

/** Streak flame on the left, level star and XP bar on the right. */
function ProgressHeader({ save, streak }: { save: SaveState; streak: number }) {
  const xp = readXp(save);
  const info = fallbackLevel(xp);
  const [burst, setBurst] = useState(0);

  // A level-up earned somewhere else (a round, Endless) is celebrated here once.
  useEffect(() => {
    if (shouldCelebrateLevel(seenLevel(), info.level)) {
      setBurst(Date.now());
      feedback('levelUp');
      showToast('Level ' + info.level + '! Nice work.', 'sunny', 'star');
    }
    markSeenLevel(info.level);
  }, [info.level]);

  return (
    <div class="home-progress-wrap">
      <Confetti burst={burst} />
      <a class="home-progress" href={hrefFor('me')}>
        {/* One plain sentence for screen readers; the badges and bar below say the same thing visually. */}
        <span class="visually-hidden">
          {'Your progress: level ' + info.level + ', ' + streak + ' day streak, ' + info.intoLevel + ' of ' + info.needed + ' XP'}
        </span>
        <span aria-hidden="true">
          <Streak days={streak} />
        </span>
        <span class="home-level" aria-hidden="true">
          <XpBadge level={info.level} />
          <span class="home-level-bar">
            <ProgressBar
              value={info.intoLevel}
              max={info.needed}
              tone="sunny"
              label={'Level ' + info.level + ': ' + info.intoLevel + ' of ' + info.needed + ' XP'}
            />
            <span class="home-level-text">
              {info.intoLevel} / {info.needed} XP
            </span>
          </span>
        </span>
      </a>
    </div>
  );
}

interface WordOfTheDayProps {
  hv: HomeView;
  wotd: WotdState;
  /** Daily Jargle (v2.1): today's letter grid game, or null when there is no word. */
  jargle: JargleView | null;
  today: string;
  pulse: boolean;
  onPlay: () => void;
}

function WordOfTheDay({ hv, wotd, jargle, today, pulse, onPlay }: WordOfTheDayProps) {
  // --- Daily Jargle (v2.1) ---
  const jargleDone = !!jargle && jargle.finished;
  const dayLine = hv.today ? 'No. ' + hv.today.day + ' · ' + shortDate(today) : shortDate(today);
  const finished = wotd.kind === 'solved' || wotd.kind === 'missed';

  return (
    <section class={pulse ? 'wotd pulse' : 'wotd'} aria-labelledby="wotd-title">
      <div class="wotd-top">
        <p class="wotd-day">{dayLine}</p>
        <h2 id="wotd-title" class="wotd-title">
          Word of the Day
        </h2>
      </div>

      {wotd.kind === 'play' ? (
        <>
          <p class="wotd-text wotd-intro">Guess today's tech word in 6 tries.</p>
          <Button variant="sunny" big block sound onClick={onPlay} gameIcon="play">
            Play
          </Button>
        </>
      ) : null}

      {wotd.kind === 'continue' ? (
        <>
          <p class="wotd-text wotd-intro">You started this one. Pick up where you left off.</p>
          <Button variant="sunny" big block sound onClick={onPlay} gameIcon="play">
            Continue
          </Button>
        </>
      ) : null}

      {/* --- Daily Jargle (v2.1) --- */}
      {jargleDone && jargle ? <JargleMini view={jargle} /> : null}

      {wotd.kind === 'solved' && !jargleDone ? (
        <div class="wotd-done">
          <Battery bars={wotd.bars} small />
          <p class="wotd-text">
            Solved with {wotd.bars} {wotd.bars === 1 ? 'bar' : 'bars'} left. Nice!
          </p>
        </div>
      ) : null}

      {wotd.kind === 'missed' && !jargleDone ? <p class="wotd-text">Done! You learned today's word.</p> : null}

      {wotd.kind === 'none' ? <p class="wotd-text">New words are on the way. Open Jargle online to get them.</p> : null}

      {finished ? (
        <>
          <p class="wotd-goal">
            <span>Daily goal done</span>
            {hv.streak > 0 ? (
              <span class="wotd-goal-streak">
                <GameIcon name="flame" size={18} />
                {hv.streak} {hv.streak === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </p>
          {/* The share line lives on the reveal, so the card stays short: countdown and a way back. */}
          <div class="wotd-foot">
            <Countdown />
            {hv.today ? (
              <Button variant="ghost" small onClick={onPlay}>
                See today's word
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** "Next word in 5h 12m", updated every 20 seconds. */
function Countdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <p class="wotd-next">
      <GameIcon name="clock" size={20} />
      <span>Next word in {countdownText(msUntilTomorrow(now))}</span>
    </p>
  );
}

function EndlessCard({ best, featured }: { best: number; featured?: boolean }) {
  return (
    <section class={featured ? 'endless-card featured' : 'endless-card'} aria-labelledby="endless-title">
      <div class="endless-head">
        <span class="endless-icon">
          <GameIcon name="infinity" size={30} />
        </span>
        <div class="endless-words">
          <h2 id="endless-title" class="endless-title">
            Endless
          </h2>
          <p class="endless-text">
            {best > 0 ? (
              <>
                <span class="endless-best">
                  <GameIcon name="trophy" size={18} />
                  Best {best}.
                </span>{' '}
                Beat it?
              </>
            ) : (
              'Quick questions, 3 hearts. How far can you go?'
            )}
          </p>
        </div>
      </div>
      <div class="endless-foot">
        <LinkButton variant="coral" big={featured} href={hrefFor('endless')} gameIcon="play">
          Play Endless
        </LinkButton>
      </div>
    </section>
  );
}

interface MoreGamesProps {
  hv: HomeView;
  save: SaveState;
  content: ContentBundle;
  today: string;
}

function MoreGames({ hv, save, content, today }: MoreGamesProps) {
  function newSet() {
    commit(engine.startPtpSet(save, content, today));
    navigate('ptp');
  }
  const reviewNote =
    hv.reviewDue > 0 ? hv.reviewDue + (hv.reviewDue === 1 ? ' word due' : ' words due') : 'All caught up';
  return (
    <section aria-label="More games">
      <div class="mini-grid">
        <MiniCard
          href={hrefFor('ptp')}
          tone="mint"
          icon="people"
          title="Pass the Phone"
          note={hv.ptpInProgress ? 'Continue your set' : 'Play with a friend'}
        />
        <MiniCard href={hrefFor('oldtech')} tone="sunny" icon="clock" title="Old Tech" note="Retro tech with Floyd" />
        {/* A brand new player has no past words yet, so these two wait until after day one. */}
        {hv.phase === 'first' ? null : (
          <MiniCard href={hrefFor('practice')} tone="grape" icon="cards" title="Practice" note="All past words" />
        )}
        {hv.phase === 'first' ? null : (
          <MiniCard href={hrefFor('review')} tone="coral" icon="bolt" title="Review" note={reviewNote} />
        )}
      </div>
      {hv.ptpInProgress ? (
        <Button block small onClick={newSet}>
          Start a new Pass the Phone set
        </Button>
      ) : null}
    </section>
  );
}

interface MiniCardProps {
  href: string;
  tone: 'mint' | 'sunny' | 'grape' | 'coral';
  icon: GameIconName;
  title: string;
  note: string;
}

function MiniCard({ href, tone, icon, title, note }: MiniCardProps) {
  return (
    <Card href={href} class="mini-card">
      <span class={'mini-icon ' + tone}>
        <GameIcon name={icon} />
      </span>
      <span class="mini-title">{title}</span>
      <span class="mini-note">{note}</span>
    </Card>
  );
}

/** Two quick steps: meet the mascots, then pick a text size and go. */
function Intro({ save, onDone }: { save: SaveState; onDone: () => void }) {
  const [step, setStep] = useState(1);
  // The tab bar hides during the intro so the only thing to tap is Next.
  useEffect(() => {
    document.body.classList.add('in-intro');
    return () => document.body.classList.remove('in-intro');
  }, []);

  function choose(size: TextSize) {
    commit({
      ...save,
      settings: { ...save.settings, textSize: size },
      flags: { ...save.flags, textSizeAsked: true },
    });
  }

  if (step === 1) {
    return (
      <Screen title="Welcome to Jargle" isHome quietTitle focusKey="intro-1">
        <div class="intro">
          <p class="intro-step" aria-hidden="true">
            <span class="dot on" />
            <span class="dot" />
          </p>
          <p class="intro-hello" aria-hidden="true">
            Welcome to <span class="wordmark">Jargle</span>
          </p>
          <MascotSays who="floyd" pose="wave" size={96} text="Hi! I'm Floyd, a floppy disk. I know all the old tech." />
          <MascotSays
            who="bud"
            pose="happy"
            size={96}
            flip
            text="And I'm Bud, a phone. We'll teach you one tech word a day!"
          />
          <Button variant="primary" big block sound onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="How Jargle works" isHome quietTitle focusKey="intro-2">
      <div class="intro">
        <p class="intro-step" aria-hidden="true">
          <span class="dot" />
          <span class="dot on" />
        </p>
        <MascotSays who="bud" pose="talk" size={72} text="Here's how it works. It's quick!" />
        <ul class="intro-points">
          <li>
            <span class="mini-icon grape">
              <GameIcon name="star" />
            </span>
            <span>
              <strong>Word of the Day.</strong> Guess the word in 6 tries. Each miss unlocks a clue.
            </span>
          </li>
          <li>
            <span class="mini-icon coral">
              <GameIcon name="infinity" />
            </span>
            <span>
              <strong>Endless.</strong> Quick questions for as long as you like.
            </span>
          </li>
          <li>
            <span class="mini-icon sunny">
              <GameIcon name="flame" />
            </span>
            <span>
              <strong>Streaks and XP.</strong> Play daily to level up.
            </span>
          </li>
        </ul>
        <fieldset class="intro-size">
          <legend>Text size</legend>
          <div class="choice-row">
            {(['normal', 'large', 'largest'] as TextSize[]).map((size) => (
              <button
                type="button"
                class="choice"
                key={size}
                aria-pressed={save.settings.textSize === size ? 'true' : 'false'}
                onClick={() => choose(size)}
              >
                {size[0].toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
        <Button variant="primary" big block sound onClick={onDone}>
          Let's play!
        </Button>
      </div>
    </Screen>
  );
}

function JudgesLine() {
  return (
    <p>
      <a class="link" href="?demo=judge">
        For judges: see a made-up history.
      </a>
    </p>
  );
}
