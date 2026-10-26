// Game sounds, made from scratch with Web Audio (no audio files to download).
//
// Every sound goes through one shared chain:
//   voices -> master gain -> compressor -> speakers
// and bells also feed a soft echo (a short delay that repeats a little quieter each time).
// The compressor squashes any loud peak, so stacked notes never clip.
//
// Nothing plays until the first tap or key press (unlockAudio), or while Sound is off.

export type SoundName =
  | 'tap'
  | 'keyPress'
  | 'tilePick'
  | 'tilePlace'
  | 'tileReturn'
  | 'flip'
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'levelUp'
  | 'win'
  | 'lose'
  | 'lessonComplete'
  | 'heartLost'
  | 'streak'
  | 'unlock'
  // Older names, still used by the daily round and the mascots.
  | 'flick'
  | 'tock'
  | 'chime'
  | 'twoNotes'
  | 'ding'
  | 'stamp'
  | 'whirr'
  | 'bloop';

// How loud everything is overall, 0 to 1. Kept quiet on purpose: these play a lot.
const DEFAULT_VOLUME = 0.5;

// Note pitches in hertz. Each octave up doubles the number.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const B5 = 987.77;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;
const A6 = 1760;
const C7 = 2093;

// A pentatonic scale (no notes that clash), used for the Wordle flips and combo steps.
// Any two of these sound nice together, so rising runs always sound happy.
const SCALE = [C5, D5, E5, G5, A5, C6, D6, E6, G6, A6, C7];

let context: AudioContext | null = null;
let master: GainNode | null = null;
let echo: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let unlocked = false;
let soundOn = true;
let volume = DEFAULT_VOLUME;

function getContext(): AudioContext | null {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Context = window.AudioContext || win.webkitAudioContext;
  if (!Context) return null;
  try {
    context = new Context();
    return context;
  } catch (_error) {
    return null;
  }
}

// One second of static. Made once and reused, so no sound builds a big buffer of its own.
function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Builds the master gain, the compressor and the echo once.
function buildChain(ctx: AudioContext): void {
  if (master) return;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, ctx.currentTime);
  compressor.knee.setValueAtTime(12, ctx.currentTime);
  compressor.ratio.setValueAtTime(4, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.15, ctx.currentTime);
  compressor.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.setValueAtTime(volume, ctx.currentTime);
  master.connect(compressor);

  // Echo: input -> delay -> darker filter -> back into the delay (quieter) and out to master.
  // A loop with a gain under 1 fades out on its own, like a small room.
  echo = ctx.createGain();
  echo.gain.setValueAtTime(0.22, ctx.currentTime);
  const delay = ctx.createDelay(0.5);
  delay.delayTime.setValueAtTime(0.11, ctx.currentTime);
  const darker = ctx.createBiquadFilter();
  darker.type = 'lowpass';
  darker.frequency.setValueAtTime(2800, ctx.currentTime);
  const loop = ctx.createGain();
  loop.gain.setValueAtTime(0.25, ctx.currentTime);
  echo.connect(delay);
  delay.connect(darker);
  darker.connect(loop);
  loop.connect(delay);
  darker.connect(master);
}

/** Call from a tap or key press. Browsers (iOS Safari most of all) only allow audio after one. */
export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    buildChain(ctx);
    if (!noiseBuffer) noiseBuffer = makeNoise(ctx);
    const result = ctx.resume();
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
    unlocked = true;
  } catch (_error) {
    unlocked = false;
  }
}

export function setSoundOn(on: boolean): void {
  soundOn = on;
}

/** Overall loudness from 0 (silent) to 1. */
export function setVolume(level: number): void {
  volume = Math.min(1, Math.max(0, level));
  if (context && master) master.gain.setValueAtTime(volume, context.currentTime);
}

// Returns the context only when a sound is allowed to play right now.
function ready(): AudioContext | null {
  if (!soundOn || !unlocked || !context || !master) return null;
  // iOS can suspend audio again (a call, the app in the background). Sounds are played from
  // taps, so asking to resume here works.
  if (context.state !== 'running') {
    try {
      const result = context.resume();
      if (result && typeof result.catch === 'function') result.catch(() => undefined);
    } catch (_error) {
      // Try again on the next sound.
    }
  }
  return context;
}

// A loudness curve: silent, a quick rise (attack), then a fade that shrinks by the same
// factor every moment, like a struck bell. Exponential ramps cannot reach 0, so 0.0001.
function envelope(ctx: AudioContext, peak: number, start: number, attack: number, length: number, withEcho: boolean): GainNode {
  const node = ctx.createGain();
  node.gain.setValueAtTime(0.0001, start);
  node.gain.exponentialRampToValueAtTime(peak, start + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, start + length);
  node.connect(master!);
  if (withEcho && echo) node.connect(echo);
  return node;
}

interface NoteOptions {
  wave?: OscillatorType;
  endFrequency?: number; // slide to this pitch over the note
  attack?: number;
  echo?: boolean;
  lowpass?: number; // cut the fizzy top off brighter waves
}

// One oscillator note. Everything tonal is built from these.
function note(ctx: AudioContext, frequency: number, start: number, length: number, peak: number, options: NoteOptions = {}): void {
  const oscillator = ctx.createOscillator();
  const output = envelope(ctx, peak, start, options.attack || 0.005, length, options.echo === true);
  let filter: BiquadFilterNode | null = null;
  oscillator.type = options.wave || 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + length);
  if (options.lowpass) {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.lowpass, start);
    oscillator.connect(filter);
    filter.connect(output);
  } else {
    oscillator.connect(output);
  }
  oscillator.start(start);
  oscillator.stop(start + length + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    if (filter) filter.disconnect();
    output.disconnect();
  };
}

// A soft bell: the note plus a much quieter copy one octave up for sparkle, with echo.
function bell(ctx: AudioContext, frequency: number, start: number, length: number, peak: number): void {
  note(ctx, frequency, start, length, peak, { echo: true });
  note(ctx, frequency * 2, start, length * 0.5, peak * 0.25, { echo: true });
}

// A short burst of filtered static: clicks, taps, whooshes.
function noise(ctx: AudioContext, start: number, length: number, peak: number, filterType: BiquadFilterType, frequency: number): void {
  if (!noiseBuffer) noiseBuffer = makeNoise(ctx);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const output = envelope(ctx, peak, start, 0.002, length, false);
  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  source.connect(filter);
  filter.connect(output);
  // Start at a random spot in the static so repeated clicks do not sound identical.
  source.start(start, Math.random() * 0.5);
  source.stop(start + length + 0.02);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    output.disconnect();
  };
}

// A tiny random pitch change (about 3 percent) so fast repeats sound less robotic.
function wobble(frequency: number): number {
  return frequency * (0.97 + Math.random() * 0.06);
}

// Runs one sound safely. Audio must never interrupt a round.
function play(draw: (ctx: AudioContext, start: number) => void): void {
  const ctx = ready();
  if (!ctx) return;
  try {
    draw(ctx, ctx.currentTime + 0.005);
  } catch (_error) {
    // Ignore: a missed sound is better than a broken screen.
  }
}

/** Button or card tap: a small soft pop. */
export function playTap(): void {
  play((ctx, t) => {
    note(ctx, wobble(520), t, 0.07, 0.16, { endFrequency: 300 });
    noise(ctx, t, 0.02, 0.04, 'lowpass', 2500);
  });
}

/** On-screen keyboard key: a crisp little click, a bit brighter than a tap. */
export function playKeyPress(): void {
  play((ctx, t) => {
    note(ctx, wobble(880), t, 0.045, 0.08, { wave: 'triangle', endFrequency: 660, lowpass: 3000 });
    noise(ctx, t, 0.015, 0.05, 'bandpass', 3500);
  });
}

/** Picking up a letter tile: a short rising lift. */
export function playTilePick(): void {
  play((ctx, t) => {
    note(ctx, wobble(600), t, 0.07, 0.14, { endFrequency: 900 });
    noise(ctx, t, 0.02, 0.03, 'bandpass', 2000);
  });
}

/** Setting a tile in a slot: a woody clack. */
export function playTilePlace(): void {
  play((ctx, t) => {
    note(ctx, wobble(340), t, 0.09, 0.2, { endFrequency: 220 });
    note(ctx, 1200, t, 0.03, 0.035, { wave: 'triangle', lowpass: 3000 });
    noise(ctx, t, 0.03, 0.08, 'lowpass', 1500);
  });
}

/** A tile going back to the tray: the pick sound turned upside down (falling). */
export function playTileReturn(): void {
  play((ctx, t) => {
    note(ctx, wobble(700), t, 0.09, 0.12, { endFrequency: 420 });
    noise(ctx, t, 0.02, 0.025, 'bandpass', 1600);
  });
}

/** A Wordle tile flipping over. column 0, 1, 2... climbs the scale, so a row plays a little tune. */
export function playFlip(column: number): void {
  const step = Math.min(SCALE.length - 1, Math.max(0, Math.round(column)));
  play((ctx, t) => {
    noise(ctx, t, 0.05, 0.05, 'bandpass', 1800);
    note(ctx, SCALE[step], t + 0.02, 0.14, 0.08, { wave: 'triangle', lowpass: 2500 });
  });
}

/** Right answer: a bright two-note chime going up. */
export function playCorrect(): void {
  play((ctx, t) => {
    bell(ctx, A5, t, 0.35, 0.13);
    bell(ctx, E6, t + 0.08, 0.55, 0.13);
  });
}

/** Wrong answer: a soft low bonk. Round sine waves only, so it is never harsh. */
export function playWrong(): void {
  play((ctx, t) => {
    note(ctx, 220, t, 0.2, 0.2, { endFrequency: 150 });
    note(ctx, 110, t, 0.16, 0.06);
  });
}

/** Combo: level 1, 2, 3... Each level starts one scale step higher, so a streak climbs. */
export function playCombo(level: number): void {
  const step = Math.min(8, Math.max(1, Math.round(level)));
  play((ctx, t) => {
    bell(ctx, SCALE[step - 1], t, 0.25, 0.12);
    bell(ctx, SCALE[step + 1], t + 0.07, 0.45, 0.12);
    // A high sparkle once the combo gets big.
    if (step >= 5) note(ctx, SCALE[step + 2] * 2, t + 0.14, 0.3, 0.03, { echo: true });
  });
}

/** Level up: a quick climbing fanfare that lands on a held chord. */
export function playLevelUp(): void {
  play((ctx, t) => {
    const climb = [C5, E5, G5];
    for (let i = 0; i < climb.length; i += 1) {
      note(ctx, climb[i], t + i * 0.08, 0.16, 0.1, { wave: 'triangle', lowpass: 3000, echo: true });
    }
    // The landing chord: C, E and G an octave up, held.
    const chord = [C6, E6, G6];
    for (let i = 0; i < chord.length; i += 1) {
      note(ctx, chord[i], t + 0.24, 0.8, 0.08, { wave: 'triangle', lowpass: 3500, attack: 0.01, echo: true });
    }
    bell(ctx, C7, t + 0.24, 0.6, 0.05);
  });
}

/** Won a game: a short bouncy jingle. */
export function playWin(): void {
  play((ctx, t) => {
    bell(ctx, E5, t, 0.2, 0.11);
    bell(ctx, G5, t + 0.1, 0.2, 0.11);
    bell(ctx, C6, t + 0.2, 0.25, 0.12);
    bell(ctx, E6, t + 0.34, 0.7, 0.1);
    bell(ctx, C6, t + 0.34, 0.7, 0.08);
  });
}

/** Lost a game: three soft falling notes. Gentle, not a sad trombone. */
export function playLose(): void {
  play((ctx, t) => {
    note(ctx, G5 / 2, t, 0.25, 0.1, { wave: 'triangle', lowpass: 1500 });
    note(ctx, E5 / 2, t + 0.18, 0.25, 0.1, { wave: 'triangle', lowpass: 1500 });
    note(ctx, C5 / 2, t + 0.36, 0.6, 0.1, { wave: 'triangle', lowpass: 1500, echo: true });
  });
}

/** Finished a lesson: a warm climb into a big soft chord. */
export function playLessonComplete(): void {
  play((ctx, t) => {
    bell(ctx, C5, t, 0.2, 0.1);
    bell(ctx, E5, t + 0.12, 0.2, 0.1);
    bell(ctx, G5, t + 0.24, 0.2, 0.1);
    const chord = [C5, E5, G5, C6];
    for (let i = 0; i < chord.length; i += 1) {
      note(ctx, chord[i], t + 0.38, 1.0, 0.06, { wave: 'triangle', lowpass: 2500, attack: 0.02, echo: true });
    }
    bell(ctx, E6, t + 0.38, 0.8, 0.06);
  });
}

/** Lost a heart: a little deflating pop with a soft thud under it. */
export function playHeartLost(): void {
  play((ctx, t) => {
    note(ctx, 600, t, 0.24, 0.13, { endFrequency: 200 });
    noise(ctx, t, 0.08, 0.06, 'lowpass', 300);
  });
}

/** Streak went up: a quick rising flutter that ends on a high ding. */
export function playStreak(): void {
  play((ctx, t) => {
    const flutter = [G5, B5, D6];
    for (let i = 0; i < flutter.length; i += 1) {
      note(ctx, flutter[i], t + i * 0.06, 0.1, 0.08, { wave: 'triangle', lowpass: 3000 });
    }
    bell(ctx, G6, t + 0.2, 0.6, 0.1);
  });
}

/** Something unlocked (a badge, a lesson): a fast sparkly run. */
export function playUnlock(): void {
  play((ctx, t) => {
    const run = [C6, E6, G6, C7];
    for (let i = 0; i < run.length; i += 1) {
      bell(ctx, run[i], t + i * 0.05, 0.3 + i * 0.08, 0.07);
    }
  });
}

// The older sounds. The daily round, badges and the mascots still use these names.
function playOld(name: SoundName): void {
  play((ctx, t) => {
    // A new clue appears: a papery flick.
    if (name === 'flick') noise(ctx, t, 0.12, 0.14, 'bandpass', 2500);
    // Learned it (no level-up): a gentle falling pair.
    if (name === 'twoNotes') {
      note(ctx, E5, t, 0.24, 0.09, { wave: 'triangle', lowpass: 2500 });
      note(ctx, C5, t + 0.22, 0.32, 0.09, { wave: 'triangle', lowpass: 2500, echo: true });
    }
    // The Days learned counter: one high bell.
    if (name === 'ding') bell(ctx, C7, t, 0.4, 0.09);
    // A badge lands: a soft thump.
    if (name === 'stamp') {
      noise(ctx, t, 0.16, 0.18, 'lowpass', 400);
      note(ctx, 120, t, 0.12, 0.12, { endFrequency: 70 });
    }
    // Floyd: a little disk drive whirr with three clicks.
    if (name === 'whirr') {
      note(ctx, 90, t, 0.3, 0.08, { wave: 'sawtooth', endFrequency: 82, lowpass: 500 });
      noise(ctx, t, 0.025, 0.04, 'highpass', 1800);
      noise(ctx, t + 0.12, 0.02, 0.035, 'highpass', 1800);
      noise(ctx, t + 0.23, 0.02, 0.03, 'highpass', 1800);
    }
    // Bud: a rising bubble.
    if (name === 'bloop') note(ctx, 400, t, 0.2, 0.13, { endFrequency: 900 });
  });
}

/** Plays a sound by name. flip and combo use their first step here; call playFlip or playCombo for more. */
export function playSound(name: SoundName): void {
  if (name === 'tap') playTap();
  else if (name === 'keyPress') playKeyPress();
  else if (name === 'tilePick') playTilePick();
  else if (name === 'tilePlace') playTilePlace();
  else if (name === 'tileReturn') playTileReturn();
  else if (name === 'flip') playFlip(0);
  else if (name === 'correct' || name === 'chime') playCorrect();
  else if (name === 'wrong' || name === 'tock') playWrong();
  else if (name === 'combo') playCombo(1);
  else if (name === 'levelUp') playLevelUp();
  else if (name === 'win') playWin();
  else if (name === 'lose') playLose();
  else if (name === 'lessonComplete') playLessonComplete();
  else if (name === 'heartLost') playHeartLost();
  else if (name === 'streak') playStreak();
  else if (name === 'unlock') playUnlock();
  else playOld(name);
}

/** Every sound name, for the dev sound board. 'chime' and 'tock' are left out: they are the same as 'correct' and 'wrong'. */
export const ALL_SOUNDS: SoundName[] = [
  'tap', 'keyPress', 'tilePick', 'tilePlace', 'tileReturn', 'flip', 'correct', 'wrong', 'combo',
  'levelUp', 'win', 'lose', 'lessonComplete', 'heartLost', 'streak', 'unlock',
  'flick', 'twoNotes', 'ding', 'stamp', 'whirr', 'bloop',
];
