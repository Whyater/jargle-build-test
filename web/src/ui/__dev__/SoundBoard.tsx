// Dev-only sound board: one button per game sound, so each one can be heard and tuned.
// It sits at the top of the screen gallery (/#/gallery).

import { useState } from 'preact/hooks';
import { ALL_SOUNDS, playCombo, playFlip, playSound, setVolume, unlockAudio } from '../../platform/audio';

// Plays a whole Wordle row the way the game will: one flip per column, a beat apart.
function flipRow(length: number) {
  for (let column = 0; column < length; column += 1) {
    window.setTimeout(() => playFlip(column), column * 250);
  }
}

// Plays combo steps 1 to 8 like a long streak of right answers.
function comboRun() {
  for (let level = 1; level <= 8; level += 1) {
    window.setTimeout(() => playCombo(level), (level - 1) * 450);
  }
}

export function SoundBoard() {
  const [level, setLevel] = useState(50);

  // The first tap normally unlocks audio, but the board makes sure.
  function hear(play: () => void) {
    unlockAudio();
    play();
  }

  function changeVolume(value: number) {
    setLevel(value);
    setVolume(value / 100);
  }

  return (
    <section class="stack-sm" style={{ marginTop: '1.5rem' }}>
      <h2>Sound board</h2>
      <label class="stack-sm">
        <span>Volume {level}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={level}
          onInput={(event) => changeVolume(Number((event.target as HTMLInputElement).value))}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {ALL_SOUNDS.map((name) => (
          <button key={name} type="button" class="btn btn-small" onClick={() => hear(() => playSound(name))}>
            {name}
          </button>
        ))}
      </div>
      <h3>Flip by column</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((column) => (
          <button key={column} type="button" class="btn btn-small" onClick={() => hear(() => playFlip(column))}>
            {column}
          </button>
        ))}
        <button type="button" class="btn btn-small" onClick={() => hear(() => flipRow(5))}>
          Row of 5
        </button>
      </div>
      <h3>Combo by level</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
          <button key={step} type="button" class="btn btn-small" onClick={() => hear(() => playCombo(step))}>
            {step}
          </button>
        ))}
        <button type="button" class="btn btn-small" onClick={() => hear(comboRun)}>
          Streak 1 to 8
        </button>
      </div>
    </section>
  );
}
