export type SoundName =
  | 'flick'
  | 'tap'
  | 'tock'
  | 'chime'
  | 'twoNotes'
  | 'ding'
  | 'stamp'
  | 'whirr'
  | 'bloop';

type AudioContextLike = AudioContext & { createGain: AudioContext['createGain'] };

let context: AudioContextLike | null = null;
let noiseBuffer: AudioBuffer | null = null;
let unlocked = false;
let soundOn = true;

function getContext(): AudioContextLike | null {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Context = window.AudioContext || win.webkitAudioContext;
  if (!Context) return null;
  try {
    context = new Context() as AudioContextLike;
    return context;
  } catch (_error) {
    return null;
  }
}

function makeNoise(ctx: AudioContextLike): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
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

function gain(ctx: AudioContextLike, value: number, start: number, end: number): GainNode {
  const node = ctx.createGain();
  node.gain.setValueAtTime(value, start);
  node.gain.exponentialRampToValueAtTime(0.0001, end);
  node.connect(ctx.destination);
  return node;
}

function tone(ctx: AudioContextLike, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number): void {
  const oscillator = ctx.createOscillator();
  const output = gain(ctx, volume, start, start + duration);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  oscillator.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    output.disconnect();
  };
}

function noise(ctx: AudioContextLike, start: number, duration: number, volume: number, filterType: BiquadFilterType, frequency: number): void {
  if (!noiseBuffer) noiseBuffer = makeNoise(ctx);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const output = gain(ctx, volume, start, start + duration);
  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  source.connect(filter);
  filter.connect(output);
  source.start(start);
  source.stop(start + duration + 0.02);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    output.disconnect();
  };
}

export function playSound(name: SoundName): void {
  if (!soundOn || !unlocked || !context) return;
  try {
    const ctx = context;
    const start = ctx.currentTime + 0.005;
    if (name === 'flick') noise(ctx, start, 0.12, 0.18, 'bandpass', 2500);
    if (name === 'tap') {
      noise(ctx, start, 0.045, 0.12, 'lowpass', 1800);
      tone(ctx, 180, start, 0.06, 0.08, 'sine');
    }
    if (name === 'tock') {
      tone(ctx, 620, start, 0.15, 0.16, 'sine', 260);
      noise(ctx, start, 0.025, 0.06, 'highpass', 2200);
    }
    if (name === 'chime') {
      tone(ctx, 880, start, 0.7, 0.12, 'sine');
      tone(ctx, 1320, start + 0.015, 0.62, 0.07, 'sine');
    }
    if (name === 'twoNotes') {
      tone(ctx, 660, start, 0.24, 0.1, 'triangle');
      tone(ctx, 550, start + 0.24, 0.26, 0.1, 'triangle');
    }
    if (name === 'ding') {
      tone(ctx, 2100, start, 0.4, 0.13, 'sine');
      tone(ctx, 2760, start, 0.22, 0.045, 'sine');
    }
    if (name === 'stamp') noise(ctx, start, 0.18, 0.2, 'lowpass', 400);
    if (name === 'whirr') {
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const output = gain(ctx, 0.1, start, start + 0.3);
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(90, start);
      oscillator.frequency.linearRampToValueAtTime(105, start + 0.14);
      oscillator.frequency.linearRampToValueAtTime(82, start + 0.3);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, start);
      oscillator.connect(filter);
      filter.connect(output);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        output.disconnect();
      };
      noise(ctx, start, 0.025, 0.04, 'highpass', 1800);
      noise(ctx, start + 0.12, 0.02, 0.035, 'highpass', 1800);
      noise(ctx, start + 0.23, 0.02, 0.03, 'highpass', 1800);
    }
    if (name === 'bloop') tone(ctx, 400, start, 0.2, 0.14, 'sine', 900);
  } catch (_error) {
    // Audio should never interrupt a round.
  }
}
