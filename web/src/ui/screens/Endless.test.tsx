// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { ContentBundle, EndlessRun, Question, SaveState } from '../../engine/types';
import { getApp, setAppForDev } from '../store';
import { EndlessScreen } from './Endless';
import { setEndlessApi } from './endlessEngine';
import { fakeEndlessApi } from './endlessFake';
import { endlessContent, endlessSave } from './endlessFixture';
import { ENDLESS_LINES, pickLine } from './endlessLines';
import {
  answersGiven,
  comboMeter,
  finishRunOnce,
  isNewBest,
  newSeed,
  reactionMood,
  shouldSaveOnLeave,
  speakerFor,
} from './endlessLogic';

const TODAY = '2026-10-26';
const SEED = 12345;

let root: HTMLElement;
// The newest question the screen was given, so a test knows which button is right.
let current: Question | null = null;

// The fake engine, but it remembers each question it hands to the screen.
const watchedApi = {
  ...fakeEndlessApi,
  startEndless(state: SaveState, content: ContentBundle, today: string, seed: number): EndlessRun {
    const run = fakeEndlessApi.startEndless(state, content, today, seed);
    current = run.question;
    return run;
  },
  nextEndlessQuestion(run: EndlessRun, content: ContentBundle): EndlessRun {
    const moved = fakeEndlessApi.nextEndlessQuestion(run, content);
    current = moved.question;
    return moved;
  },
};

function setApp(save: SaveState) {
  setAppForDev({
    status: 'ready',
    content: endlessContent,
    save,
    today: TODAY,
    demo: null,
    storageKey: 'jargle:v1',
    canSave: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(Date, 'now').mockReturnValue(SEED);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  localStorage.clear();
  current = null;
  setEndlessApi(watchedApi);
  setApp(endlessSave);
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  act(() => {
    render(null, root);
  });
  root.remove();
  setEndlessApi(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function showScreen() {
  await act(() => {
    render(<EndlessScreen />, root);
  });
}

async function click(element: Element) {
  await act(() => {
    (element as HTMLElement).click();
  });
}

function buttonWithText(text: string): HTMLButtonElement {
  const buttons = root.querySelectorAll<HTMLButtonElement>('button');
  for (const button of buttons) {
    if ((button.textContent || '').trim() === text) return button;
  }
  throw new Error('No button says "' + text + '"');
}

function hasButtonWithText(text: string): boolean {
  const buttons = root.querySelectorAll<HTMLButtonElement>('button');
  for (const button of buttons) {
    if ((button.textContent || '').trim() === text) return true;
  }
  return false;
}

function options(): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-option]'));
}

function optionNamed(name: string): HTMLButtonElement {
  for (const button of options()) {
    if (button.dataset.option === name) return button;
  }
  throw new Error('No option named ' + name);
}

function wrongOption(question: Question): HTMLButtonElement {
  for (const button of options()) {
    if (button.dataset.option !== question.answer) return button;
  }
  throw new Error('No wrong option');
}

function heartsLabel(): string | null {
  const hearts = root.querySelector('.hearts');
  return hearts ? hearts.getAttribute('aria-label') : null;
}

function scoreLabel(): string | null {
  const score = root.querySelector('.en-score');
  return score ? score.getAttribute('aria-label') : null;
}

async function startGame() {
  await showScreen();
  await click(buttonWithText('Start'));
}

async function answerRight() {
  await click(optionNamed(current!.answer));
}

async function answerWrong() {
  await click(wrongOption(current!));
}

async function pressNext() {
  const bar = root.querySelector('.en-nextbar')!;
  await click(bar.querySelector('button')!);
}

async function waitForAdvance() {
  await act(() => {
    vi.advanceTimersByTime(900);
  });
}

// The first question the stand-in engine gives for the stubbed seed.
function firstQuestion(): Question {
  const run = fakeEndlessApi.startEndless(endlessSave, endlessContent, TODAY, SEED);
  return run.question!;
}

describe('Endless start screen', () => {
  it('shows a Start button and no best score yet', async () => {
    await showScreen();
    expect(hasButtonWithText('Start')).toBe(true);
    expect(root.textContent).toContain('No best yet');
    expect(options()).toHaveLength(0);
  });

  it('shows the best score when there is one', async () => {
    setApp({ ...endlessSave, endlessBest: 120 });
    await showScreen();
    expect(root.textContent).toContain('120');
    expect(root.textContent).not.toContain('No best yet');
  });

  it('renders nothing until the save is loaded', async () => {
    setAppForDev({ status: 'loading', save: null, content: null });
    await showScreen();
    expect(root.textContent).toBe('');
  });
});

describe('Endless run', () => {
  it('starts with 3 hearts, score 0 and the first question', async () => {
    const first = firstQuestion();
    expect(first.kind).toBe('meaning');
    await startGame();
    expect(heartsLabel()).toBe('3 hearts left');
    expect(scoreLabel()).toBe('Score 0');
    const shown = options();
    expect(shown).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(shown[i].dataset.option).toBe(first.options[i]);
    }
    expect(root.textContent).toContain('Meaning Match');
    expect(hasButtonWithText('Start')).toBe(false);
  });

  it('adds points for a right answer and shows no why line', async () => {
    await startGame();
    await answerRight();
    expect(scoreLabel()).toBe('Score 10');
    expect(heartsLabel()).toBe('3 hearts left');
    expect(root.querySelector('.en-why')).toBeNull();
    expect(root.querySelector('.en-nextbar')).toBeNull();
  });

  it('shows the next question 900 ms after a right answer', async () => {
    await startGame();
    const first = current!;
    await answerRight();
    await act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(current!.id).toBe(first.id);
    expect(optionNamed(first.answer).classList.contains('is-right')).toBe(true);
    await act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(current!.id).not.toBe(first.id);
    const shown = options();
    expect(shown).toHaveLength(current!.options.length);
    for (let i = 0; i < shown.length; i++) {
      expect(shown[i].dataset.option).toBe(current!.options[i]);
    }
    expect(scoreLabel()).toBe('Score 10');
    expect(root.querySelectorAll('.is-right, .is-wrong, .is-dim')).toHaveLength(0);
  });

  it('shows the why line and a Next button after a wrong answer', async () => {
    await startGame();
    const first = current!;
    await answerWrong();
    const why = root.querySelector('.en-why')!;
    expect(why.textContent).toBe(first.why);
    const bar = root.querySelector('.en-nextbar')!;
    expect(bar.querySelector('button')!.textContent!.trim()).toBe('Next');
    expect(heartsLabel()).toBe('2 hearts left');
    expect(scoreLabel()).toBe('Score 0');
  });

  it('waits for Next after a wrong answer instead of moving on by itself', async () => {
    await startGame();
    const first = current!;
    await answerWrong();
    await act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(current!.id).toBe(first.id);
    expect(root.querySelector('.en-why')).not.toBeNull();
  });

  it('moves to a new question when Next is pressed', async () => {
    await startGame();
    const first = current!;
    await answerWrong();
    await pressNext();
    expect(current!.id).not.toBe(first.id);
    expect(root.querySelector('.en-why')).toBeNull();
    expect(root.querySelector('.en-nextbar')).toBeNull();
    expect(heartsLabel()).toBe('2 hearts left');
    expect(root.querySelectorAll('.is-right, .is-wrong, .is-dim')).toHaveLength(0);
  });

  it('ignores a second tap after the question was answered', async () => {
    await startGame();
    const first = current!;
    const wrong = wrongOption(first);
    await click(wrong);
    await click(wrong);
    expect(heartsLabel()).toBe('2 hearts left');
  });

  it('builds a combo with right answers in a row', async () => {
    await startGame();
    for (let i = 0; i < 3; i++) {
      await answerRight();
      await waitForAdvance();
    }
    const combo = root.querySelector('.en-combo')!;
    expect(combo.getAttribute('aria-label')).toContain('Combo 3');
    expect(combo.getAttribute('aria-label')).toContain('times 2');
  });
});

describe('Endless game over', () => {
  async function playUntilOver() {
    await startGame();
    await answerRight();
    await waitForAdvance();
    await answerWrong();
    await pressNext();
    await answerWrong();
    await pressNext();
    await answerWrong();
  }

  it('says See my score on the last wrong answer', async () => {
    await startGame();
    await answerWrong();
    expect(buttonWithText('Next')).toBeTruthy();
    await pressNext();
    await answerWrong();
    expect(buttonWithText('Next')).toBeTruthy();
    await pressNext();
    await answerWrong();
    expect(heartsLabel()).toBe('0 hearts left');
    expect(buttonWithText('See my score')).toBeTruthy();
    expect(hasButtonWithText('Next')).toBe(false);
  });

  it('shows Game over and a Play again button', async () => {
    await playUntilOver();
    await click(buttonWithText('See my score'));
    expect(root.textContent).toContain('Game over');
    expect(root.textContent).toContain('Your score');
    expect(hasButtonWithText('Play again')).toBe(true);
    expect(options()).toHaveLength(0);
  });

  it('saves the game count, best score and XP', async () => {
    const before = getApp().save!;
    expect(before.endlessGames || 0).toBe(0);
    await playUntilOver();
    await click(buttonWithText('See my score'));
    const after = getApp().save!;
    expect(after.endlessGames).toBe(1);
    expect(after.endlessBest).toBe(10);
    expect(after.xp).toBe((before.xp || 0) + 10);
    expect(root.textContent).toContain('New best!');
  });

  it('shows a level up and marks it seen so Play does not cheer again', async () => {
    await startGame();
    // Three right answers give 30 XP, which is level 2.
    for (let i = 0; i < 3; i++) {
      await answerRight();
      await waitForAdvance();
    }
    expect(localStorage.getItem('jargle:seenLevel')).toBe('2');
    await answerWrong();
    await pressNext();
    await answerWrong();
    await pressNext();
    await answerWrong();
    await click(buttonWithText('See my score'));
    expect(root.textContent).toContain('Level up! You reached level 2');
  });

  it('does not save a run twice', async () => {
    await playUntilOver();
    await click(buttonWithText('See my score'));
    act(() => {
      render(null, root);
    });
    expect(getApp().save!.endlessGames).toBe(1);
  });

  it('keeps a higher old best', async () => {
    setApp({ ...endlessSave, endlessBest: 500, endlessGames: 4 });
    await playUntilOver();
    await click(buttonWithText('See my score'));
    expect(getApp().save!.endlessBest).toBe(500);
    expect(getApp().save!.endlessGames).toBe(5);
    expect(root.textContent).not.toContain('New best!');
  });

  it('starts a fresh run with Play again', async () => {
    await playUntilOver();
    await click(buttonWithText('See my score'));
    await click(buttonWithText('Play again'));
    expect(heartsLabel()).toBe('3 hearts left');
    expect(scoreLabel()).toBe('Score 0');
    expect(options().length).toBeGreaterThan(0);
    expect(current!.id).toBe(firstQuestion().id);
    expect(getApp().save!.endlessGames).toBe(1);
  });
});

describe('Endless End run button', () => {
  it('goes back to the start screen before any answer', async () => {
    await startGame();
    const gamesBefore = getApp().save!.endlessGames || 0;
    await click(root.querySelector('[aria-label="End run"]')!);
    expect(hasButtonWithText('Start')).toBe(true);
    expect(options()).toHaveLength(0);
    expect(getApp().save!.endlessGames || 0).toBe(gamesBefore);
  });

  it('shows the score and saves the run after an answer', async () => {
    await startGame();
    await answerWrong();
    await click(root.querySelector('[aria-label="End run"]')!);
    expect(root.textContent).toContain('Game over');
    expect(getApp().save!.endlessGames).toBe(1);
  });

  it('saves a run that is left in the middle', async () => {
    await startGame();
    await answerWrong();
    act(() => {
      render(null, root);
    });
    expect(getApp().save!.endlessGames).toBe(1);
  });

  it('saves a run once when End run is followed by leaving the screen', async () => {
    await startGame();
    await answerWrong();
    await click(root.querySelector('[aria-label="End run"]')!);
    act(() => {
      render(null, root);
    });
    expect(getApp().save!.endlessGames).toBe(1);
  });

  it('saves a finished run once when End run is tapped on the last wrong answer and then the screen is left', async () => {
    await startGame();
    await answerWrong();
    await pressNext();
    await answerWrong();
    await pressNext();
    await answerWrong();
    await click(root.querySelector('[aria-label="End run"]')!);
    act(() => {
      render(null, root);
    });
    expect(getApp().save!.endlessGames).toBe(1);
  });

  it('saves nothing when the screen is left before any answer', async () => {
    await startGame();
    act(() => {
      render(null, root);
    });
    expect(getApp().save!.endlessGames || 0).toBe(0);
  });
});

describe('comboMeter', () => {
  it('fills toward x2 for combos 0 to 2', () => {
    expect(comboMeter(0)).toEqual({ filled: 0, next: 2 });
    expect(comboMeter(1)).toEqual({ filled: 1, next: 2 });
    expect(comboMeter(2)).toEqual({ filled: 2, next: 2 });
  });

  it('fills toward x3 for combos 3 to 5', () => {
    expect(comboMeter(3)).toEqual({ filled: 0, next: 3 });
    expect(comboMeter(4)).toEqual({ filled: 1, next: 3 });
    expect(comboMeter(5)).toEqual({ filled: 2, next: 3 });
  });

  it('stays full from combo 6', () => {
    expect(comboMeter(6)).toEqual({ filled: 3, next: null });
    expect(comboMeter(9)).toEqual({ filled: 3, next: null });
  });
});

describe('reactionMood', () => {
  function result(correct: boolean, comboAfter: number) {
    return {
      run: fakeEndlessApi.startEndless(endlessSave, endlessContent, TODAY, SEED),
      correct,
      points: correct ? 10 : 0,
      xpGained: correct ? 10 : 0,
      comboAfter,
      multiplier: 1,
    };
  }

  it('is wrong for a wrong answer', () => {
    expect(reactionMood(result(false, 0))).toBe('wrong');
  });

  it('is combo when the combo reaches 3 or 6', () => {
    expect(reactionMood(result(true, 3))).toBe('combo');
    expect(reactionMood(result(true, 6))).toBe('combo');
  });

  it('is combo at every fifth step after 6', () => {
    expect(reactionMood(result(true, 10))).toBe('combo');
    expect(reactionMood(result(true, 15))).toBe('combo');
    expect(reactionMood(result(true, 7))).toBe('right');
  });

  it('is right for other right answers', () => {
    expect(reactionMood(result(true, 1))).toBe('right');
    expect(reactionMood(result(true, 2))).toBe('right');
    expect(reactionMood(result(true, 4))).toBe('right');
  });
});

describe('speakerFor', () => {
  it('lets Bud and Floyd take turns', () => {
    expect(speakerFor(0)).toBe('bud');
    expect(speakerFor(1)).toBe('floyd');
    expect(speakerFor(2)).toBe('bud');
    expect(speakerFor(3)).toBe('floyd');
  });
});

describe('answersGiven and shouldSaveOnLeave', () => {
  function makeRun(asked: number, answered: boolean): EndlessRun {
    return {
      seed: 1,
      today: TODAY,
      pool: ['floppy'],
      used: [],
      question: null,
      answered,
      asked,
      correct: 0,
      score: 0,
      hearts: 3,
      combo: 0,
      bestCombo: 0,
      xp: 0,
      over: false,
    };
  }

  it('counts no answers while the first question is open', () => {
    expect(answersGiven(makeRun(1, false))).toBe(0);
  });

  it('counts the current question once it is answered', () => {
    expect(answersGiven(makeRun(1, true))).toBe(1);
    expect(answersGiven(makeRun(3, true))).toBe(3);
  });

  it('does not count a new question that is still open', () => {
    expect(answersGiven(makeRun(3, false))).toBe(2);
  });

  it('does not save when there is no run', () => {
    expect(shouldSaveOnLeave(null, false)).toBe(false);
  });

  it('does not save before the first answer', () => {
    expect(shouldSaveOnLeave(makeRun(1, false), false)).toBe(false);
  });

  it('saves after at least one answer', () => {
    expect(shouldSaveOnLeave(makeRun(1, true), false)).toBe(true);
    expect(shouldSaveOnLeave(makeRun(2, false), false)).toBe(true);
  });

  it('does not save a run that was already saved', () => {
    expect(shouldSaveOnLeave(makeRun(4, true), true)).toBe(false);
  });
});

describe('isNewBest', () => {
  it('needs a score above zero', () => {
    expect(isNewBest(0, 0)).toBe(false);
  });

  it('is true when the score beats the old best', () => {
    expect(isNewBest(10, 0)).toBe(true);
    expect(isNewBest(30, 20)).toBe(true);
  });

  it('is false when the score ties or falls short', () => {
    expect(isNewBest(20, 20)).toBe(false);
    expect(isNewBest(10, 20)).toBe(false);
  });
});

describe('newSeed', () => {
  it('keeps a small time as it is', () => {
    expect(newSeed(12345)).toBe(12345);
  });

  it('wraps a big time into a whole number below 2147483647', () => {
    expect(newSeed(2147483647)).toBe(0);
    expect(newSeed(2147483647 + 5.7)).toBe(5);
  });
});

describe('Endless lines', () => {
  const emDash = '\u2014';

  it('has no em dash and no line over 60 characters', () => {
    const speakers = Object.keys(ENDLESS_LINES) as Array<keyof typeof ENDLESS_LINES>;
    let count = 0;
    for (const speaker of speakers) {
      const moods = Object.keys(ENDLESS_LINES[speaker]) as Array<keyof (typeof ENDLESS_LINES)['bud']>;
      for (const mood of moods) {
        for (const line of ENDLESS_LINES[speaker][mood]) {
          expect(line.indexOf(emDash)).toBe(-1);
          expect(line.length).toBeLessThanOrEqual(60);
          expect(line.length).toBeGreaterThan(0);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(20);
  });

  it('has at least one line for every mood of both speakers', () => {
    expect(ENDLESS_LINES.bud.hello.length).toBeGreaterThan(0);
    expect(ENDLESS_LINES.floyd.hello.length).toBeGreaterThan(0);
    expect(ENDLESS_LINES.bud.levelUp.length).toBeGreaterThan(0);
    expect(ENDLESS_LINES.floyd.best.length).toBeGreaterThan(0);
  });

  it('pickLine cycles through the list', () => {
    const list = ENDLESS_LINES.bud.right;
    for (let turn = 0; turn < list.length; turn++) {
      expect(pickLine('bud', 'right', turn)).toBe(list[turn]);
    }
    expect(pickLine('bud', 'right', list.length)).toBe(list[0]);
    expect(pickLine('bud', 'right', list.length + 1)).toBe(list[1]);
  });

  it('pickLine gives different lines for the next turns', () => {
    expect(pickLine('floyd', 'wrong', 0)).not.toBe(pickLine('floyd', 'wrong', 1));
  });

  it('pickLine uses the speaker and mood asked for', () => {
    expect(ENDLESS_LINES.floyd.over).toContain(pickLine('floyd', 'over', 0));
    expect(ENDLESS_LINES.bud.over).toContain(pickLine('bud', 'over', 0));
    expect(pickLine('bud', 'best', 0)).toBe(ENDLESS_LINES.bud.best[0]);
  });
});

describe('finishRunOnce', () => {
  it('runs the finish only the first time', () => {
    const saved = { current: false };
    let calls = 0;
    expect(finishRunOnce(saved, () => calls++)).toBe(true);
    expect(finishRunOnce(saved, () => calls++)).toBe(false);
    expect(finishRunOnce(saved, () => calls++)).toBe(false);
    expect(calls).toBe(1);
    expect(saved.current).toBe(true);
  });

  it('runs again after the flag is reset for a new run', () => {
    const saved = { current: true };
    let calls = 0;
    saved.current = false;
    finishRunOnce(saved, () => calls++);
    expect(calls).toBe(1);
  });
});
