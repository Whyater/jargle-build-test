import { describe, expect, it, vi } from 'vitest';

type ParamCall = { kind: string; value: number; time: number };

class MockAudioParam {
  value = 0;
  calls: ParamCall[] = [];

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ kind: 'set', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ kind: 'exponential', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ kind: 'linear', value, time });
  }
}

class MockNode {
  connections: unknown[] = [];
  disconnectCalls = 0;

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

class MockGainNode extends MockNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockNode {
  frequency = new MockAudioParam();
  type: OscillatorType = 'sine';
  starts: number[] = [];
  stops: number[] = [];
  onended: (() => void) | null = null;

  start(time: number): void {
    this.starts.push(time);
  }

  stop(time: number): void {
    this.stops.push(time);
  }
}

class MockBufferSourceNode extends MockNode {
  buffer: AudioBuffer | null = null;
  starts: number[] = [];
  stops: number[] = [];
  onended: (() => void) | null = null;

  start(time: number, _offset?: number): void {
    this.starts.push(time);
  }

  stop(time: number): void {
    this.stops.push(time);
  }
}

class MockFilterNode extends MockNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam();
}

class MockDelayNode extends MockNode {
  delayTime = new MockAudioParam();
}

class MockCompressorNode extends MockNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockAudioBuffer {
  private data: Float32Array;

  constructor(length: number) {
    this.data = new Float32Array(length);
  }

  getChannelData(_channel: number): Float32Array {
    return this.data;
  }
}

class MockAudioContext {
  static throwOscillator = false;
  static last: MockAudioContext | null = null;
  readonly currentTime = 10;
  readonly sampleRate = 8000;
  readonly destination = new MockNode();
  state: AudioContextState = 'running';
  resumeCalls = 0;
  gains: MockGainNode[] = [];
  oscillators: MockOscillatorNode[] = [];
  bufferSources: MockBufferSourceNode[] = [];
  filters: MockFilterNode[] = [];
  delays: MockDelayNode[] = [];
  compressors: MockCompressorNode[] = [];

  constructor() {
    MockAudioContext.last = this;
  }

  createGain(): MockGainNode {
    const node = new MockGainNode();
    this.gains.push(node);
    return node;
  }

  createOscillator(): MockOscillatorNode {
    if (MockAudioContext.throwOscillator) throw new Error('oscillator failed');
    const node = new MockOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter(): MockFilterNode {
    const node = new MockFilterNode();
    this.filters.push(node);
    return node;
  }

  createBufferSource(): MockBufferSourceNode {
    const node = new MockBufferSourceNode();
    this.bufferSources.push(node);
    return node;
  }

  createBuffer(_channels: number, length: number, _rate: number): MockAudioBuffer {
    return new MockAudioBuffer(length);
  }

  createDelay(_maxDelay?: number): MockDelayNode {
    const node = new MockDelayNode();
    this.delays.push(node);
    return node;
  }

  createDynamicsCompressor(): MockCompressorNode {
    const node = new MockCompressorNode();
    this.compressors.push(node);
    return node;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

function installAudioContext(): void {
  MockAudioContext.throwOscillator = false;
  MockAudioContext.last = null;
  const win = { AudioContext: MockAudioContext };
  globalThis.window = win as unknown as Window & typeof globalThis;
}

async function loadAudio(): Promise<typeof import('./audio')> {
  vi.resetModules();
  return import('./audio');
}

function getContext(): MockAudioContext {
  return MockAudioContext.last!;
}

const playNames = [
  'playTap', 'playKeyPress', 'playTilePick', 'playTilePlace', 'playTileReturn',
  'playCorrect', 'playWrong', 'playLevelUp', 'playWin', 'playLose',
  'playLessonComplete', 'playHeartLost', 'playStreak', 'playUnlock',
] as const;

describe('game audio', () => {
  it('does nothing before unlock, including named sounds', async () => {
    installAudioContext();
    const audio = await loadAudio();
    const calls = [
      ...playNames.map((name) => () => audio[name]()),
      () => audio.playFlip(0), () => audio.playCombo(1),
      ...audio.ALL_SOUNDS.map((name) => () => audio.playSound(name)),
    ];
    for (const call of calls) expect(() => call()).not.toThrow();
    expect(MockAudioContext.last).toBeNull();
  });

  it('creates short, stopped sources for every sound after unlock', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    const ctx = getContext();
    const calls = [
      () => audio.playTap(), () => audio.playKeyPress(), () => audio.playTilePick(),
      () => audio.playTilePlace(), () => audio.playTileReturn(), () => audio.playFlip(0),
      () => audio.playFlip(4), () => audio.playCorrect(), () => audio.playWrong(),
      () => audio.playCombo(1), () => audio.playCombo(8), () => audio.playLevelUp(),
      () => audio.playWin(), () => audio.playLose(), () => audio.playLessonComplete(),
      () => audio.playHeartLost(), () => audio.playStreak(), () => audio.playUnlock(),
      ...audio.ALL_SOUNDS.map((name) => () => audio.playSound(name)),
    ];
    for (const call of calls) {
      const before = ctx.oscillators.length + ctx.bufferSources.length;
      expect(() => call()).not.toThrow();
      expect(ctx.oscillators.length + ctx.bufferSources.length).toBeGreaterThan(before);
    }
    for (const source of [...ctx.oscillators, ...ctx.bufferSources]) {
      expect(source.starts.length).toBeGreaterThan(0);
      expect(source.stops.length).toBeGreaterThan(0);
      expect(source.stops[0]).toBeGreaterThan(source.starts[0]);
      expect(source.stops[0] - ctx.currentTime).toBeLessThan(2);
    }
  });

  it('turning sound off blocks sounds and turning it on restores them', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    const ctx = getContext();
    audio.setSoundOn(false);
    audio.playTap();
    expect(ctx.oscillators.length + ctx.bufferSources.length).toBe(0);
    audio.setSoundOn(true);
    audio.playTap();
    expect(ctx.oscillators.length + ctx.bufferSources.length).toBeGreaterThan(0);
  });

  it('does nothing when AudioContext is unavailable', async () => {
    globalThis.window = {} as Window & typeof globalThis;
    const audio = await loadAudio();
    expect(() => {
      audio.unlockAudio();
      audio.playTap();
      audio.playFlip(1);
      audio.playSound('win');
    }).not.toThrow();
  });

  it('keeps every sound gain peak at or below 0.3', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    const ctx = getContext();
    // Every sound, plus the highest flip and combo steps.
    for (const name of audio.ALL_SOUNDS) audio.playSound(name);
    audio.playFlip(6);
    audio.playCombo(8);
    const envelopeGains = ctx.gains.filter((gain) => gain.gain.calls.some((call) => call.kind === 'exponential'));
    for (const gain of envelopeGains) {
      expect(Math.max(...gain.gain.calls.map((call) => call.value))).toBeLessThanOrEqual(0.3);
    }
  });

  it('reuses one master compressor and clamps volume', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    audio.unlockAudio();
    audio.playWin();
    audio.playLose();
    const ctx = getContext();
    expect(ctx.compressors).toHaveLength(1);
    audio.setVolume(2);
    const master = ctx.gains.find((gain) => gain.connections.includes(ctx.compressors[0]))!;
    expect(master.gain.calls.at(-1)!.value).toBe(1);
    audio.setVolume(-1);
    expect(master.gain.calls.at(-1)!.value).toBe(0);
  });

  it('resumes a suspended context when a sound plays', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    const ctx = getContext();
    ctx.state = 'suspended';
    const resumesBeforeSound = ctx.resumeCalls;
    audio.playTap();
    expect(ctx.resumeCalls).toBeGreaterThan(resumesBeforeSound);
  });

  it('disconnects sources when ended handlers run', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    audio.playTap();
    const ctx = getContext();
    for (const source of [...ctx.oscillators, ...ctx.bufferSources]) source.onended?.();
    expect([...ctx.oscillators, ...ctx.bufferSources].every((source) => source.disconnectCalls > 0)).toBe(true);
  });

  it('raises flip and combo pitch with their level', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    const ctx = getContext();
    audio.playFlip(0);
    const flipLow = ctx.oscillators[0].frequency.calls[0].value;
    audio.playFlip(3);
    const flipHigh = ctx.oscillators[1].frequency.calls[0].value;
    const comboStart = ctx.oscillators.length;
    audio.playCombo(1);
    const comboLow = ctx.oscillators[comboStart].frequency.calls[0].value;
    const comboHighStart = ctx.oscillators.length;
    audio.playCombo(5);
    const comboHigh = ctx.oscillators[comboHighStart].frequency.calls[0].value;
    expect(flipHigh).toBeGreaterThan(flipLow);
    expect(comboHigh).toBeGreaterThan(comboLow);
  });

  it('swallows oscillator creation errors', async () => {
    installAudioContext();
    const audio = await loadAudio();
    audio.unlockAudio();
    MockAudioContext.throwOscillator = true;
    expect(() => audio.playTap()).not.toThrow();
  });
});
