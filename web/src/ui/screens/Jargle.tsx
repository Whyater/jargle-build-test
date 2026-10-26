// Daily Jargle: guess today's tech word in 6 tries. Green means the right letter in the right
// spot, yellow means the letter is in the word somewhere else, gray means it is not in the word.
// Each wrong guess unlocks one more clue from Bud.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { JargleView } from '../../engine/api';
import type { ContentBundle, JargleTile, LocalDate, SaveState, TermItem } from '../../engine/types';
import { engine } from '../engine';
import { commit, getApp, useApp } from '../store';
import { hrefFor, navigate } from '../router';
import { openRound } from '../actions';
import { wordLessonHref } from '../lesson/start';
import { appUrl } from '../../config';
import { shareOrCopy } from '../../platform/share';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { MascotSays } from '../components/MascotSays';
import { Confetti } from '../components/Confetti';
import { Announcer } from '../components/BottomBar';
import { showToast } from '../components/Toast';
import { reducedMotion } from '../components/motion';
import { levelReached, markSeenLevel, readXp } from './homeLogic';
import { flipSound, invalidSound, keySound, loseSound, winSound } from './jargleSounds';
import '../../styles/jargle.css';

const TRIES = 6;
// One tile starts turning every FLIP_STEP ms; each turn takes FLIP_TIME ms.
const FLIP_STEP = 260;
const FLIP_TIME = 500;
// How long the win bounce runs before the result card shows.
const BOUNCE_TIME = 700;

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// The word list is a few kB, so it only loads when this screen opens.
let wordsPromise: Promise<WordTools | null> | null = null;

interface WordTools {
  words: Set<string>;
  isKnownWord: (words: Set<string>, guess: string) => boolean;
}

function loadWords(content: ContentBundle): Promise<WordTools | null> {
  if (!wordsPromise) {
    // Every daily answer counts as a word, even names like ZELLE that no dictionary has.
    // So does every word the game's own text uses, which covers tech words like LAPTOP and ROUTER.
    const extra: string[] = content.commonWords.slice();
    for (const day of content.schedule.days) {
      const item = content.items[day.term];
      if (item && item.puzzle) extra.push(item.puzzle);
    }
    for (const id in content.items) {
      const item = content.items[id];
      let text = item.term + ' ' + item.meaning + ' ' + item.clues.join(' ');
      for (const decoy of item.decoys) text += ' ' + decoy.term + ' ' + decoy.meaning;
      for (const line of item.exchange) text += ' ' + line.text;
      const found = text.toUpperCase().match(/[A-Z]+/g) || [];
      for (const word of found) {
        if (word.length >= 4 && word.length <= 7) extra.push(word);
      }
    }
    wordsPromise = import('./jargleWords')
      .then((module) => ({ words: module.buildWordList(extra), isKnownWord: module.isKnownWord }))
      .catch(() => {
        // Forget the failed try, so the next Enter loads it again.
        wordsPromise = null;
        return null;
      });
  }
  return wordsPromise;
}

export function JargleScreen() {
  const app = useApp();
  if (app.status !== 'ready' || !app.save || !app.content) return null;
  const view = engine.jargleView(app.save, app.content, app.today);
  if (!view) {
    return (
      <Screen title="Daily Jargle">
        <div class="stack">
          <MascotSays who="bud" pose="think" text="No new word today. New words are on the way." />
          <LinkButton primary block href={hrefFor('endless')} gameIcon="play">
            Play Endless
          </LinkButton>
        </div>
      </Screen>
    );
  }
  return <JargleGame key={view.day} view={view} save={app.save} content={app.content} today={app.today} demo={app.demo !== null} />;
}

interface GameProps {
  view: JargleView;
  save: SaveState;
  content: ContentBundle;
  today: LocalDate;
  demo: boolean;
}

function JargleGame({ view, save, content, today, demo }: GameProps) {
  const [typed, setTyped] = useState('');
  // Bumping this number replays the shake on the row being typed.
  const [shake, setShake] = useState(0);
  // The row whose tiles are turning over right now, or -1.
  const [revealRow, setRevealRow] = useState(-1);
  const [bounce, setBounce] = useState(false);
  const [burst, setBurst] = useState(0);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  // A game that was already over when the screen opened shows its result right away.
  const [showResult, setShowResult] = useState(view.finished);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  // False once the screen closes, so a word list that arrives late can't play a guess.
  const open = useRef(true);

  useEffect(() => {
    loadWords(content);
    const pending = timers.current;
    return () => {
      open.current = false;
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  function later(ms: number, run: () => void) {
    timers.current.push(window.setTimeout(run, ms));
  }

  function reject(text: string) {
    invalidSound();
    setShake(shake + 1);
    setNote(text);
    setMessage(text);
    later(1600, () => setNote(''));
  }

  function typeLetter(letter: string) {
    if (busy.current || view.status !== 'playing' || typed.length >= view.length) return;
    keySound();
    setNote('');
    setTyped(typed + letter);
  }

  function deleteLetter() {
    if (busy.current || view.status !== 'playing' || typed.length === 0) return;
    keySound();
    setTyped(typed.slice(0, -1));
  }

  async function submit() {
    if (busy.current || view.status !== 'playing') return;
    const guess = typed;
    const check = engine.checkGuess(guess, view.length, null);
    if (check === 'short') {
      reject('Not enough letters');
      return;
    }
    if (check !== 'ok') {
      reject('Letters only, please');
      return;
    }
    busy.current = true;
    const tools = await loadWords(content);
    if (!open.current) return;
    busy.current = false;
    if (!tools) {
      // A guess is never counted unless it could be checked.
      reject("Couldn't load the word list. Check your connection.");
      return;
    }
    if (!tools.isKnownWord(tools.words, guess)) {
      reject('Not in the word list');
      return;
    }

    // Read the newest save: the word list may have taken a moment, and another tab may have saved.
    const app = getApp();
    if (!app.save || !app.content || app.today !== today) return;
    busy.current = true;
    const xpBefore = readXp(app.save);
    const result = engine.submitJargleGuess(app.save, app.content, today, guess);
    if (result.outcome === 'ignored') {
      busy.current = false;
      return;
    }
    commit(result.state);
    setTyped('');
    const row = view.rows.length;
    setRevealRow(row);

    // Each tile clicks as it turns, then the row is read out once it has finished.
    const motion = !reducedMotion();
    const step = motion ? FLIP_STEP : 0;
    const total = motion ? (view.length - 1) * FLIP_STEP + FLIP_TIME : 0;
    for (let col = 0; col < view.length; col++) {
      if (motion) later(col * step + FLIP_TIME / 2, () => flipSound(col));
    }
    if (!motion) flipSound(0);

    later(total, () => {
      setRevealRow(-1);
      busy.current = false;
      const spoken = rowSentence(guess, result.tiles);
      if (result.outcome === 'won') {
        winSound();
        setBounce(true);
        setBurst(Date.now());
        setMessage(spoken + '. You got it in ' + (row + 1) + '!');
        showToast('+' + result.xpGained + ' XP', 'sunny', 'star');
        const level = levelReached(xpBefore, readXp(result.state));
        if (level > 0) {
          markSeenLevel(level);
          showToast('Level ' + level + '! Nice work.', 'sunny', 'star');
        }
        later(motion ? BOUNCE_TIME : 0, () => setShowResult(true));
      } else if (result.outcome === 'lost') {
        loseSound();
        setMessage(spoken + ". Today's word was " + view.item.term + '.');
        if (result.xpGained > 0) showToast('+' + result.xpGained + ' XP', 'sunny', 'star');
        later(motion ? 400 : 0, () => setShowResult(true));
      } else {
        setMessage(spoken + '. New clue unlocked.');
      }
    });
  }

  function pressKey(key: string) {
    if (key === 'ENTER') submit();
    else if (key === 'BACK') deleteLetter();
    else typeLetter(key);
  }

  // A real keyboard works too. The handler is replaced on every render, so it sees fresh state.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (event.key === 'Enter') {
      // Enter on a focused button or link presses that button, not the guess. The on-screen keys
      // never take focus from a tap (see Keyboard), so this only happens when someone tabs to a key.
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
      event.preventDefault();
      submit();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      deleteLetter();
    } else if (/^[a-zA-Z]$/.test(event.key)) {
      typeLetter(event.key.toUpperCase());
    }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // No running head line here: on small phones every row of height goes to the grid and keyboard.
  return (
    <Screen title="Daily Jargle">
      <div class={'jg len-' + view.length + (showResult ? ' is-done' : '')} style={{ '--len': String(view.length) }}>
        <Confetti burst={burst} />
        <ClueBubble view={view} />

        <div class="jg-board">
          <p class={note ? 'jg-note show' : 'jg-note'} aria-hidden="true">
            {note || ' '}
          </p>
          <div class="jg-grid">
            {renderRows(view, typed, revealRow, shake, bounce)}
          </div>
        </div>

        {showResult ? (
          <ResultCard view={view} save={save} content={content} demo={demo} />
        ) : (
          <Keyboard keyboard={view.keyboard} revealing={revealRow !== -1} onKey={pressKey} />
        )}
        <Announcer message={message} />
      </div>
    </Screen>
  );
}

/** "C right spot, L not in the word, ..." for screen readers after a row turns over. */
function rowSentence(guess: string, tiles: JargleTile[]): string {
  const parts: string[] = [];
  for (let i = 0; i < guess.length; i++) {
    parts.push(guess[i] + ' ' + tileWords(tiles[i]));
  }
  return parts.join(', ');
}

function tileWords(tile: JargleTile | undefined): string {
  if (tile === 'correct') return 'right spot';
  if (tile === 'present') return 'in the word, wrong spot';
  if (tile === 'absent') return 'not in the word';
  return '';
}

function renderRows(view: JargleView, typed: string, revealRow: number, shake: number, bounce: boolean) {
  const rows = [];
  // Once the game is over, the unused rows go away so the result card sits closer.
  const rowCount = view.status === 'playing' ? TRIES : view.rows.length;
  for (let r = 0; r < rowCount; r++) {
    const tiles = [];
    const done = r < view.rows.length ? view.rows[r] : null;
    const current = !done && r === view.rows.length && view.status === 'playing';
    const winningRow = bounce && view.status === 'won' && r === view.rows.length - 1;
    for (let c = 0; c < view.length; c++) {
      let letter = '';
      let tileClass = 'jg-tile';
      let label = 'empty';
      const style: Record<string, string> = {};
      if (done) {
        letter = done.guess[c] || '';
        tileClass += ' ' + done.tiles[c];
        label = letter + ', ' + tileWords(done.tiles[c]);
        if (r === revealRow) {
          tileClass += ' flip';
          style.animationDelay = c * FLIP_STEP + 'ms';
        }
        if (winningRow) {
          tileClass += ' win';
          style.animationDelay = c * 90 + 'ms';
        }
      } else if (current && c < typed.length) {
        letter = typed[c];
        tileClass += ' typed';
        label = letter;
      }
      tiles.push(
        <span key={c} class={tileClass} style={style} role="img" aria-label={label}>
          {letter}
        </span>,
      );
    }
    let rowClass = 'jg-row';
    if (current && shake > 0) rowClass += ' shake' + (shake % 2);
    rows.push(
      <div key={r} class={rowClass} role="group" aria-label={'Guess ' + (r + 1) + ' of ' + TRIES}>
        {tiles}
      </div>,
    );
  }
  return rows;
}

/** Bud reads out the newest clue. Older clues fold away under it. */
function ClueBubble({ view }: { view: JargleView }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const clues = view.clues;
  const newest = clues.length > 0 ? clues[clues.length - 1] : '';
  // Some answers are one key word that goes with a longer term (LOGIN for two-factor login).
  const puzzle = (view.item.puzzle || '').toUpperCase();
  const keyWord = puzzle !== '' && puzzle !== view.item.term.toUpperCase().replace(/[^A-Z]/g, '');
  const named = keyWord ? puzzle + ', as in ' + view.item.term : view.item.term;
  let pose = 'think';
  let text = newest;
  if (view.status === 'won') {
    pose = 'happy';
    text = 'Nice! Today\'s word is ' + named + '.';
  } else if (view.status === 'lost') {
    pose = 'oops';
    text = 'It was ' + named + '. Now you know it!';
  }
  const earlier = clues.slice(0, -1);
  const playing = view.status === 'playing';
  return (
    <section class="jg-clue" aria-label="Clues">
      <MascotSays who="bud" pose={pose} size={64} text={text} />
      {playing ? (
        <div class="jg-clue-foot">
          <p class="jg-clue-count">
            Clue {clues.length} of 5
            {/* A small tag instead of the dots, so the board keeps its height on small phones. */}
            {keyWord ? (
              <span class="jg-key-tag">
                Key word
                <span class="visually-hidden">: the answer is a key word that goes with today's tech term.</span>
              </span>
            ) : (
              <ClueDots shown={clues.length} />
            )}
          </p>
          {earlier.length > 0 ? (
            <button
              type="button"
              class="jg-earlier-btn"
              aria-expanded={showEarlier ? 'true' : 'false'}
              aria-controls="jg-earlier"
              onClick={() => setShowEarlier(!showEarlier)}
            >
              {showEarlier ? 'Hide earlier clues' : 'Earlier clues'}
            </button>
          ) : null}
        </div>
      ) : null}
      {playing && showEarlier && earlier.length > 0 ? (
        <ol class="jg-earlier" id="jg-earlier">
          {earlier.map((clue, i) => (
            <li key={i}>{clue}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ClueDots({ shown }: { shown: number }) {
  const dots = [];
  for (let i = 0; i < 5; i++) {
    dots.push(<span key={i} class={i < shown ? 'jg-dot on' : 'jg-dot'} />);
  }
  return (
    <span class="jg-dots" aria-hidden="true">
      {dots}
    </span>
  );
}

interface KeyboardProps {
  keyboard: Record<string, JargleTile>;
  revealing: boolean;
  onKey: (key: string) => void;
}

function Keyboard({ keyboard, revealing, onKey }: KeyboardProps) {
  // While a row turns over, the keys keep their old colors so they don't give the answer away early.
  const shownStates = useRef(keyboard);
  if (!revealing) shownStates.current = keyboard;
  const states = shownStates.current;

  const rows = KEY_ROWS.map((row, r) => {
    const keys = [];
    if (r === 2) {
      keys.push(
        <button key="enter" type="button" class="jg-key wide" onMouseDown={keepFocus} onClick={() => onKey('ENTER')}>
          Enter
        </button>,
      );
    }
    for (const letter of row) {
      const state = states[letter];
      keys.push(
        <button
          key={letter}
          type="button"
          class={'jg-key' + (state ? ' ' + state : '')}
          onMouseDown={keepFocus}
          aria-label={state ? letter + ', ' + tileWords(state) : letter}
          onClick={() => onKey(letter)}
        >
          {letter}
        </button>,
      );
    }
    if (r === 2) {
      keys.push(
        <button
          key="back"
          type="button"
          class="jg-key wide"
          aria-label="Delete letter"
          onMouseDown={keepFocus}
          onClick={() => onKey('BACK')}
        >
          <BackspaceIcon />
        </button>,
      );
    }
    return (
      <div key={r} class="jg-keyrow">
        {keys}
      </div>
    );
  });
  return (
    <div class="jg-keys" role="group" aria-label="Keyboard">
      {rows}
    </div>
  );
}

// A tapped key must not keep focus, or the next Enter on a real keyboard would press that key again.
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

function BackspaceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linejoin="round"
      />
      <path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  );
}

interface ResultProps {
  view: JargleView;
  save: SaveState;
  content: ContentBundle;
  demo: boolean;
}

/** The word, what it means, why it matters, and where to go next. */
function ResultCard({ view, save, content, demo }: ResultProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [shareNote, setShareNote] = useState('');
  const item = view.item;
  const won = view.status === 'won';
  const answer = view.answer || '';
  // Some answers are one part of a longer term (SHOT for Screenshot), so say both.
  const termLetters = item.term.toUpperCase().replace(/[^A-Z]/g, '');
  const why = whyLine(item);
  // Show the XP the game really paid. Saves from before xp_paid existed fall back to the usual amount.
  const record = save.jargle ? save.jargle[view.key] : undefined;
  const xp =
    record && typeof record.xp_paid === 'number'
      ? record.xp_paid
      : engine.xpFor({ type: 'jargle', won: won, guesses: view.rows.length });

  useEffect(() => {
    if (!heading.current) return;
    heading.current.focus();
    heading.current.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  async function share() {
    const text = engine.jargleShareText(save, content, view.day, { appUrl, demo: demo });
    const result = await shareOrCopy(text);
    if (result === 'copied') setShareNote('Copied. Paste it into a text or email.');
    if (result === 'failed') setShareNote("Sharing didn't work here. Try again from another browser.");
  }

  return (
    <section class={won ? 'jg-result won' : 'jg-result'} aria-labelledby="jg-result-title">
      <div class="jg-result-top">
        <h2 id="jg-result-title" class="jg-result-title" tabIndex={-1} ref={heading}>
          {engine.jargleResultLine(view)}
        </h2>
        <span class="jg-xp">+{xp} XP</span>
      </div>

      <div class="jg-word">
        <p class="jg-term">{item.term}</p>
        {answer && answer !== termLetters ? <p class="jg-answer-note">The puzzle word was {answer}.</p> : null}
        <p class="jg-meaning">{item.meaning}</p>
      </div>

      {why ? (
        <div class="jg-why">
          <h3 class="jg-why-title">Why it matters</h3>
          <p>{why}</p>
        </div>
      ) : null}

      <div class="jg-actions">
        <LinkButton primary big block href={wordLessonHref(item.id)} gameIcon="learn">
          Learn the lesson
        </LinkButton>
        <div class="jg-actions-row">
          <Button variant="sunny" block onClick={share}>
            Share
          </Button>
          <LinkButton variant="coral" block href={hrefFor('endless')} gameIcon="infinity">
            Play Endless
          </LinkButton>
        </div>
        {shareNote ? <p class="jg-share-note">{shareNote}</p> : null}
        {/* The old daily clue round, still there for anyone who wants one more go at the word. */}
        <Button variant="ghost" small block onClick={() => openRound('d:' + view.day, item.id, 'daily')}>
          Bonus clue round
        </Button>
        <Button variant="ghost" small block onClick={() => navigate('home')}>
          Back to Play
        </Button>
      </div>
      <Announcer message={shareNote} />
    </section>
  );
}

/** Bud's first tip from the word's chat is the plain "why it matters" line. */
function whyLine(item: TermItem): string {
  for (const line of item.exchange) {
    if (line.speaker === 'bud') return line.text;
  }
  return item.exchange.length > 0 ? item.exchange[0].text : '';
}
