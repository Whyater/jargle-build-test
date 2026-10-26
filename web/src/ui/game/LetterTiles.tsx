// Letter tiles: build a word from shuffled tiles, like a Scrabble rack.
// Tap a tile to drop it in the next empty slot, tap a placed tile to send it back.
// Used as the "Spell it" question in Endless and as a step in lessons.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Tile } from '../../engine/api';
import { answerGroups, answerLetters, checkTiles, dealTiles, letterPoints, nextHint, shuffleTiles, tileRandom, tileScore } from '../../engine/api';
import { reducedMotion } from '../components/motion';
import { ignoreKey } from '../questions/keys';
import { tileSound } from './tileSounds';
import './LetterTiles.css';

export interface LetterTilesResult {
  correct: boolean;
  hintsUsed: number;
  ms: number;
  score: number;
}

export interface LetterTilesProps {
  /** The word to build. Spaces and hyphens show as fixed gaps; only letters become tiles. */
  answer: string;
  /** The meaning or clue shown above the slots. */
  prompt: ComponentChildren;
  /** 1, 2 or 3: how many decoy tiles get mixed in (0, 1 or 2). */
  difficulty: 1 | 2 | 3;
  /** Called once, when the word is right or after the second wrong try. */
  onDone: (result: LetterTilesResult) => void;
  /** Same seed = same deal. Defaults to the answer. */
  seed?: string;
  /** Physical keyboard typing. Turn off behind dialogs. Default true. */
  keysOn?: boolean;
  /** Id for the prompt card, so a screen can move focus to it. */
  promptId?: string;
  /** Small sticker on the prompt card, like "Spell it". */
  tag?: string;
  /** "+36" that floats up from the slots after a right answer. */
  reward?: string | null;
  /** Play the right or wrong sound at the end. Endless plays its own, so it turns this off. Default true. */
  resultSound?: boolean;
}

type Phase = 'play' | 'checking' | 'wrong' | 'right' | 'revealed';

/** How many tries before the answer is shown. */
const TRIES = 2;
/** Wait for the last tile to land before checking. */
const CHECK_DELAY_MS = 260;
/** How long the wrong shake shows before the tiles slide back. */
const WRONG_MS = 560;
const FLY_MS = 240;

/** At this width (px) and up the board counts as wide: bigger tiles, longer rows. */
const WIDE_PX = 520;

/** Tiles per row: on a phone one row up to 6, then two even rows; when wide, one row up to 9. */
function rowCols(count: number, wide: boolean): number {
  const most = wide ? 9 : 6;
  return count <= most ? count : Math.ceil(count / 2);
}

/** Tile size in px so the widest row fits the board. */
interface Fit {
  tile: number;
  gap: number;
  wide: boolean;
}

function emptySlots(count: number): (number | null)[] {
  const slots: (number | null)[] = [];
  for (let i = 0; i < count; i++) slots.push(null);
  return slots;
}

export function LetterTiles(props: LetterTilesProps) {
  const { answer, difficulty, keysOn = true, resultSound = true } = props;
  const seed = props.seed || answer;
  const letters = answerLetters(answer);
  const groups = answerGroups(answer);

  // `rack` is the tray order. A placed tile keeps its spot in the rack as an empty hole,
  // so the other tiles never jump around.
  const [rack, setRack] = useState<Tile[]>(() => dealTiles(answer, difficulty, tileRandom(seed + ':deal')));
  // One entry per answer letter: the id of the tile sitting there, or null.
  const [slots, setSlots] = useState<(number | null)[]>(() => emptySlots(letters.length));
  // Slots filled by a hint stay put.
  const [locked, setLocked] = useState<boolean[]>(() => letters.map(() => false));
  const [phase, setPhase] = useState<Phase>('play');
  const [tries, setTries] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shuffles, setShuffles] = useState(0);
  const [announce, setAnnounce] = useState('');

  const startRef = useRef(Date.now());
  const doneRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Where each tile was on screen before the last move, for the fly animation.
  const flipRef = useRef<Map<number, DOMRect> | null>(null);
  const timersRef = useRef<number[]>([]);
  const [fit, setFit] = useState<Fit>({ tile: 48, gap: 8, wide: false });

  let longest = 0;
  for (let g = 0; g < groups.length; g++) longest = Math.max(longest, groups[g].letters.length);

  // Size the tiles from the board's real width (it changes with the screen and the app layout),
  // before the first paint so nothing jumps.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    function resize() {
      const width = root ? root.clientWidth : 0;
      if (!width) return;
      const wide = width >= WIDE_PX;
      const gap = wide ? 10 : 8;
      const cols = Math.max(rowCols(rack.length, wide), rowCols(longest, wide));
      // Chunkier tiles when there is room: phones get 56 px, roomy boards up to 72 px.
      let biggest = 56;
      if (width >= 420) biggest = 64;
      if (wide) biggest = 72;
      // Each tile takes its width plus one gap (half on each side); keep a little edge room too.
      const tile = Math.max(30, Math.min(biggest, Math.floor((width - 2 * gap) / cols - gap)));
      setFit((old) => (old.tile === tile && old.wide === wide ? old : { tile, gap, wide }));
    }
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resize);
      observer.observe(root);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [rack.length, longest]);

  useEffect(() => {
    return () => {
      for (let i = 0; i < timersRef.current.length; i++) window.clearTimeout(timersRef.current[i]);
    };
  }, []);

  function later(action: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(action, ms));
  }

  function tileById(id: number): Tile | null {
    for (let i = 0; i < rack.length; i++) {
      if (rack[i].id === id) return rack[i];
    }
    return null;
  }

  function placedLetters(list: (number | null)[]): (string | null)[] {
    const result: (string | null)[] = [];
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      const tile = id === null ? null : tileById(id);
      result.push(tile ? tile.letter : null);
    }
    return result;
  }

  function isPlaced(id: number, list: (number | null)[]): boolean {
    return list.indexOf(id) !== -1;
  }

  /** Remembers where every tile is right now, so the next render can fly them from there. */
  function measure() {
    if (reducedMotion() || !rootRef.current) return;
    const map = new Map<number, DOMRect>();
    const nodes = rootRef.current.querySelectorAll<HTMLElement>('[data-tile]');
    for (let i = 0; i < nodes.length; i++) {
      map.set(Number(nodes[i].dataset.tile), nodes[i].getBoundingClientRect());
    }
    flipRef.current = map;
  }

  // The fly animation (FLIP): after a move, start each tile at its old spot and slide it home.
  useLayoutEffect(() => {
    const before = flipRef.current;
    flipRef.current = null;
    if (!before || !rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll<HTMLElement>('[data-tile]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const old = before.get(Number(node.dataset.tile));
      if (!old) continue;
      const now = node.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      node.style.transition = 'none';
      node.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      node.getBoundingClientRect(); // forces the browser to apply the start position first
      node.style.transition = 'transform ' + FLY_MS + 'ms var(--ease-out)';
      node.style.transform = '';
    }
  });

  function finish(correct: boolean, hints: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    const ms = Date.now() - startRef.current;
    props.onDone({ correct, hintsUsed: hints, ms, score: tileScore({ correct, ms, hintsUsed: hints }) });
  }

  /** Runs once the last slot is filled. */
  function check(nextSlots: (number | null)[], hints: number, lockedNow: boolean[]) {
    setPhase('checking');
    later(() => {
      if (checkTiles(answer, placedLetters(nextSlots))) {
        setPhase('right');
        setAnnounce('Right! ' + letters.join('') + '.');
        if (resultSound) tileSound('correct');
        finish(true, hints);
        return;
      }
      const used = tries + 1;
      setTries(used);
      if (used >= TRIES) {
        setPhase('revealed');
        setAnnounce('Not quite. The word is ' + letters.join('') + '.');
        if (resultSound) tileSound('wrong');
        finish(false, hints);
        return;
      }
      setPhase('wrong');
      setAnnounce('Not quite. One more try.');
      tileSound('wrong');
      later(() => {
        // Send back every tile except the ones a hint placed.
        measure();
        const kept = nextSlots.slice();
        for (let i = 0; i < kept.length; i++) {
          if (!lockedNow[i]) kept[i] = null;
        }
        setSlots(kept);
        setPhase('play');
      }, WRONG_MS);
    }, CHECK_DELAY_MS);
  }

  function place(tile: Tile) {
    if (phase !== 'play' || isPlaced(tile.id, slots)) return;
    const target = slots.indexOf(null);
    if (target === -1) return;
    measure();
    const next = slots.slice();
    next[target] = tile.id;
    setSlots(next);
    tileSound('tilePlace');
    const left = countEmpty(next);
    setAnnounce(tile.letter + ' in slot ' + (target + 1) + '. ' + (left === 0 ? 'Checking.' : left + ' left.'));
    if (left === 0) check(next, hintsUsed, locked);
  }

  function sendBack(slot: number) {
    if (phase !== 'play' || locked[slot] || slots[slot] === null) return;
    const tile = tileById(slots[slot] as number);
    measure();
    const next = slots.slice();
    next[slot] = null;
    setSlots(next);
    tileSound('tileReturn');
    if (tile) setAnnounce(tile.letter + ' back to the tray.');
  }

  function shuffle() {
    if (phase !== 'play') return;
    // Only the loose tiles change places; holes stay where they are.
    const spots: number[] = [];
    const loose: Tile[] = [];
    for (let i = 0; i < rack.length; i++) {
      if (!isPlaced(rack[i].id, slots)) {
        spots.push(i);
        loose.push(rack[i]);
      }
    }
    if (loose.length < 2) return;
    const mixed = shuffleTiles(loose, tileRandom(seed + ':shuffle:' + shuffles));
    const next = rack.slice();
    for (let i = 0; i < spots.length; i++) next[spots[i]] = mixed[i];
    measure();
    setRack(next);
    setShuffles(shuffles + 1);
    tileSound('tilePick');
    setAnnounce('Tiles shuffled.');
  }

  function hint() {
    if (phase !== 'play') return;
    const found = nextHint(answer, placedLetters(slots));
    if (!found) return;
    const next = slots.slice();
    // A wrong tile in that slot goes back first.
    if (next[found.slot] !== null) next[found.slot] = null;
    // Prefer a loose tile with the right letter; else take it from a later slot where it is wrong.
    let pick: number | null = null;
    for (let i = 0; i < rack.length && pick === null; i++) {
      if (rack[i].letter === found.letter && !isPlaced(rack[i].id, next)) pick = rack[i].id;
    }
    for (let i = found.slot + 1; i < next.length && pick === null; i++) {
      const id = next[i];
      const tile = id === null ? null : tileById(id);
      if (tile && !locked[i] && tile.letter === found.letter && letters[i] !== found.letter) {
        pick = tile.id;
        next[i] = null;
      }
    }
    for (let i = found.slot + 1; i < next.length && pick === null; i++) {
      const id = next[i];
      const tile = id === null ? null : tileById(id);
      if (tile && !locked[i] && tile.letter === found.letter) {
        pick = tile.id;
        next[i] = null;
      }
    }
    if (pick === null) return;
    measure();
    next[found.slot] = pick;
    const nextLocked = locked.slice();
    nextLocked[found.slot] = true;
    const hints = hintsUsed + 1;
    setSlots(next);
    setLocked(nextLocked);
    setHintsUsed(hints);
    tileSound('tilePlace');
    setAnnounce('Hint: slot ' + (found.slot + 1) + ' is ' + found.letter + '.');
    if (next.indexOf(null) === -1) check(next, hints, nextLocked);
  }

  // Typing on a keyboard: a letter places a matching loose tile, Backspace sends the last one back.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyRef.current = (event: KeyboardEvent) => {
    if (ignoreKey(event)) return;
    if (event.key === 'Backspace') {
      for (let i = slots.length - 1; i >= 0; i--) {
        if (slots[i] !== null && !locked[i]) {
          event.preventDefault();
          sendBack(i);
          return;
        }
      }
      return;
    }
    if (event.key.length !== 1) return;
    const letter = event.key.toUpperCase();
    if (letter < 'A' || letter > 'Z') return;
    for (let i = 0; i < rack.length; i++) {
      if (rack[i].letter === letter && !isPlaced(rack[i].id, slots)) {
        event.preventDefault();
        place(rack[i]);
        return;
      }
    }
  };
  const typing = keysOn && phase === 'play';
  useEffect(() => {
    if (!typing) return;
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typing]);

  // ---- Drawing ----

  const firstEmpty = slots.indexOf(null);
  const loose = rack.length - countFilled(slots);
  const canHint = phase === 'play' && nextHint(answer, placedLetters(slots)) !== null;
  const canShuffle = phase === 'play' && loose >= 2;

  // Slots, grouped by word, so "two factor" shows a gap and "Wi-Fi" a dash.
  const slotGroups = [];
  let index = 0;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const cells = [];
    for (let i = 0; i < group.letters.length; i++) {
      cells.push(renderSlot(index));
      index++;
    }
    slotGroups.push(
      <div class="lt-word" key={'g' + g} style={{ '--row': rowCols(group.letters.length, fit.wide) } as Record<string, number>}>
        {cells}
      </div>,
    );
    const mark = group.after.trim();
    if (g < groups.length - 1 && mark) {
      slotGroups.push(
        <span class="lt-sep" key={'s' + g} aria-hidden="true">
          {mark}
        </span>,
      );
    }
  }

  function renderSlot(i: number) {
    const id = slots[i];
    const tile = id === null ? null : tileById(id);
    let cls = 'lt-slot';
    if (i === firstEmpty && phase === 'play') cls += ' is-next';
    if (tile || phase === 'revealed') cls += ' is-full';
    const style = { '--i': i } as Record<string, number>;

    if (phase === 'revealed') {
      // Show the real word. Letters the player had right stay as their tiles.
      const right = tile && tile.letter === letters[i];
      return (
        <span class={cls} key={i} style={style}>
          <span class={'lt-tile in-slot' + (right ? ' is-kept' : ' is-given')} aria-hidden="true">
            <span class="lt-letter">{letters[i]}</span>
            <span class="lt-points">{letterPoints(letters[i])}</span>
          </span>
          <span class="visually-hidden">{'Slot ' + (i + 1) + ': ' + letters[i]}</span>
        </span>
      );
    }
    if (!tile) {
      return (
        <span class={cls} key={i} style={style}>
          <span class="visually-hidden">{'Slot ' + (i + 1) + ', empty'}</span>
        </span>
      );
    }
    const label = locked[i]
      ? 'Slot ' + (i + 1) + ': ' + tile.letter + ', from a hint'
      : 'Slot ' + (i + 1) + ': ' + tile.letter + '. Send back';
    return (
      <span class={cls} key={i} style={style}>
        <button
          type="button"
          class={'lt-tile in-slot' + (locked[i] ? ' is-given' : '')}
          data-tile={tile.id}
          aria-label={label}
          aria-disabled={locked[i] || phase !== 'play' ? 'true' : undefined}
          onClick={() => sendBack(i)}
        >
          <span class="lt-letter" aria-hidden="true">
            {tile.letter}
          </span>
          <span class="lt-points" aria-hidden="true">
            {letterPoints(tile.letter)}
          </span>
        </button>
      </span>
    );
  }

  const tray = [];
  for (let i = 0; i < rack.length; i++) {
    const tile = rack[i];
    if (isPlaced(tile.id, slots) || phase === 'revealed') {
      tray.push(<span class="lt-hole" key={'h' + tile.id} aria-hidden="true" />);
      continue;
    }
    tray.push(
      <button
        type="button"
        class="lt-tile"
        key={'t' + tile.id}
        data-tile={tile.id}
        aria-label={'Letter ' + tile.letter}
        aria-disabled={phase !== 'play' ? 'true' : undefined}
        onClick={() => place(tile)}
      >
        <span class="lt-letter" aria-hidden="true">
          {tile.letter}
        </span>
        <span class="lt-points" aria-hidden="true">
          {letterPoints(tile.letter)}
        </span>
      </button>,
    );
  }

  let ask = letters.length + ' letters';
  if (phase === 'wrong') ask = 'Not quite. One more try!';
  if (phase === 'play' && tries > 0) ask = 'Last try. ' + letters.length + ' letters';
  if (phase === 'right') ask = 'You got it!';
  if (phase === 'revealed') ask = 'Here is the word';

  const sizes = { '--tile': fit.tile + 'px', '--gap': fit.gap + 'px' } as Record<string, string>;

  return (
    <div class={'lt is-' + phase + (fit.wide ? ' is-wide' : '')} ref={rootRef} style={sizes}>
      <div class="lt-prompt" id={props.promptId} tabIndex={-1}>
        {props.tag ? <span class="lt-tag">{props.tag}</span> : null}
        <div class="lt-prompt-text">{props.prompt}</div>
        <p class="lt-ask">{ask}</p>
      </div>

      <div class="lt-board">
        <div class="lt-slots" role="group" aria-label={'Your word, ' + letters.length + ' letters'}>
          {slotGroups}
          {props.reward && phase === 'right' ? (
            <span class="lt-reward" aria-hidden="true">
              {props.reward}
            </span>
          ) : null}
        </div>

        <div class="lt-tray" role="group" aria-label="Letter tiles" style={{ '--row': rowCols(rack.length, fit.wide) } as Record<string, number>}>
          {tray}
        </div>
      </div>

      <div class="lt-tools">
        <button type="button" class="lt-tool" onClick={shuffle} aria-disabled={canShuffle ? undefined : 'true'}>
          <ShuffleIcon />
          <span>Shuffle</span>
        </button>
        <button type="button" class="lt-tool hint" onClick={hint} aria-disabled={canHint ? undefined : 'true'}>
          <BulbIcon />
          <span>Hint</span>
          {hintsUsed === 0 && canHint ? (
            <span class="lt-cost" aria-label="costs 3 points">
              -3
            </span>
          ) : null}
        </button>
      </div>

      <p class="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

function countFilled(list: (number | null)[]): number {
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] !== null) count++;
  }
  return count;
}

function countEmpty(list: (number | null)[]): number {
  return list.length - countFilled(list);
}


function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M3.5 7h3.2c2.4 0 3.9 1.2 5.3 5s2.9 5 5.3 5h3.2" />
      <path d="M3.5 17h3.2c1.4 0 2.5-.4 3.4-1.4M14.6 8.4c.9-1 2-1.4 3.4-1.4h2.5" />
      <path d="M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z" />
    </svg>
  );
}
