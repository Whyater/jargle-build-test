import { describe, expect, it } from 'vitest';
import { buildContent } from './__fixtures__/content';
import { addDays, dateOfDay } from './dates';
import { homeView, newState, startRound, applyRound } from './api';
import {
  checkGuess,
  cluesShown,
  jargleResultLine,
  jargleShareText,
  jargleView,
  keyboardStates,
  puzzleAnswer,
  scoreGuess,
  submitJargleGuess,
} from './jargle';
import type { ContentBundle, SaveState } from './types';

const C = buildContent();
const D1 = dateOfDay(1);
const D2 = dateOfDay(2);

function contentWithWord(word: string) {
  const c = buildContent({ schedule: ['word'] });
  c.items.word.puzzle = word;
  return c;
}

function playGuess(
  state: SaveState,
  content: ContentBundle,
  today: string,
  guess: string,
) {
  return submitJargleGuess(state, content, today, guess).state;
}

function finishOldRound(state: SaveState, content: ContentBundle) {
  let next = startRound(state, content, 'd:1', 'two-factor-login', 'daily', D1);
  next = applyRound(
    next,
    content,
    'd:1',
    { type: 'select', term: 'two factor login' },
    D1,
  ).state;
  return applyRound(next, content, 'd:1', { type: 'check' }, D1).state;
}

describe('Jargle scoring', () => {
  it('scores basic guesses', () => {
    expect(scoreGuess('CLOUD', 'CLOUD')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
    expect(scoreGuess('CLOUD', 'ABBEY')).toEqual([
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
    ]);
    expect(scoreGuess('CLOUD', 'COBRA')).toEqual([
      'correct',
      'present',
      'absent',
      'absent',
      'absent',
    ]);
  });

  it('scores duplicate letters in ABBEY and BABES', () => {
    // B at 0 uses the answer B, A at 1 is present, B at 2 and E at 3 are exact, S is absent.
    expect(scoreGuess('ABBEY', 'BABES')).toEqual([
      'present',
      'present',
      'correct',
      'correct',
      'absent',
    ]);
  });

  it('scores duplicate letters in CLOUD and LLAMA', () => {
    // L at 1 is exact, so L at 0 has no unmatched L left and is absent.
    expect(scoreGuess('CLOUD', 'LLAMA')).toEqual([
      'absent',
      'correct',
      'absent',
      'absent',
      'absent',
    ]);
  });

  it('scores duplicate letters in EMOJI and EERIE', () => {
    // E at 0 is exact, E at 1 and 2 have no copies, I at 3 is present because the answer has J there and I at 4, and R is absent.
    expect(scoreGuess('EMOJI', 'EERIE')).toEqual([
      'correct',
      'absent',
      'absent',
      'present',
      'absent',
    ]);
  });

  it('scores duplicate letters in SPAM and MAMS', () => {
    // M at 0 and A at 1 are present, M at 2 is absent, and S at 3 is present.
    expect(scoreGuess('SPAM', 'MAMS')).toEqual([
      'present',
      'present',
      'absent',
      'present',
    ]);
  });

  it('scores duplicate letters in BOBBY and BOOBY', () => {
    // O at 1 is exact, O at 2 has no second answer copy, and the other letters are exact.
    expect(scoreGuess('BOBBY', 'BOOBY')).toEqual([
      'correct',
      'correct',
      'absent',
      'correct',
      'correct',
    ]);
  });

  it('scores duplicate letters in ALLEY and LLAMA', () => {
    // L at 0 is present, L at 1 is exact, L at 2 is present, and M and A are absent.
    expect(scoreGuess('ALLEY', 'LLAMA')).toEqual([
      'present',
      'correct',
      'present',
      'absent',
      'absent',
    ]);
  });

  it('is case-insensitive', () => {
    expect(scoreGuess('cloud', 'ClOuD')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('keeps the best keyboard state', () => {
    expect(keyboardStates('CLOUD', ['ABBEY', 'CLOUD']).C).toBe('correct');
    expect(keyboardStates('CLOUD', ['ABBEY', 'COBRA']).O).toBe('present');
  });

  it('never downgrades a correct keyboard letter', () => {
    expect(keyboardStates('WORD', ['WORD', 'ABCD']).W).toBe('correct');
  });
});

describe('Jargle engine', () => {
  it('checks guesses and puzzle fallback', () => {
    expect(checkGuess('AB', 4, null)).toBe('short');
    expect(checkGuess('AB!D', 4, null)).toBe('letters');
    expect(checkGuess('ABCD', 4, new Set(['WORD']))).toBe('notword');
    expect(checkGuess('word', 4, new Set(['WORD']))).toBe('ok');
    expect(checkGuess('word', 4, null)).toBe('ok');
    expect(puzzleAnswer({ ...C.items.emoji, puzzle: 'EmOjI' })).toBe('EMOJI');
  });

  it('shows clues as wrong guesses unlock them', () => {
    const c = contentWithWord('WORD');
    expect(cluesShown(c.items.word, 0, 'playing')).toEqual(['Clue 1 for word']);
    expect(cluesShown(c.items.word, 1, 'playing')).toHaveLength(2);
    expect(cluesShown(c.items.word, 4, 'playing')).toHaveLength(5);
    expect(cluesShown(c.items.word, 4, 'playing')[4]).toBe('It starts with W.');
    expect(cluesShown(c.items.word, 5, 'playing')).toHaveLength(5);
    expect(cluesShown(c.items.word, 0, 'won')).toHaveLength(5);
    expect(cluesShown(c.items.word, 0, 'lost')).toHaveLength(5);
    expect(cluesShown(c.items.word, 5, 'playing')).not.toContain('Clue 5 for word');
  });

  it('returns null for unavailable Jargle games', () => {
    const c = contentWithWord('WORD');
    expect(jargleView(newState(), c, '2026-10-24')).toBeNull();
    expect(jargleView(newState(), buildContent({ schedule: [] }), D1)).toBeNull();

    const tooLong = buildContent({ schedule: ['word'] });
    tooLong.items.word.term = 'too longg';
    expect(jargleView(newState(), tooLong, D1)).toBeNull();
  });

  it('uses term letters when puzzle is missing and rejects other lengths', () => {
    const c = buildContent({ schedule: ['word'] });
    expect(puzzleAnswer(c.items.word)).toBe('WORD');
    delete c.items.word.puzzle;
    expect(puzzleAnswer(c.items.word)).toBe('WORD');
    c.items.word.term = 'abc';
    expect(puzzleAnswer(c.items.word)).toBe('');
  });

  it('shows a playing view with hidden answer and countdown', () => {
    const c = contentWithWord('WORD');
    let s = newState();
    s = playGuess(s, c, D1, 'ABCD');
    const v = jargleView(s, c, D1);
    expect(v?.answer).toBeNull();
    expect(v?.triesLeft).toBe(5);
  });

  it('submits wins with the right XP and uppercase guesses', () => {
    const c = contentWithWord('WORD');
    const one = submitJargleGuess(newState(), c, D1, 'word');
    expect(one.xpGained).toBe(70);
    expect(one.state.jargle?.['1'].guesses).toEqual(['WORD']);
    expect(one.state.countedDays).toContain(1);
    expect(one.state.finishedDays).toContain(1);
    expect(jargleView(one.state, c, D1)?.answer).toBe('WORD');
    expect(jargleView(one.state, c, D1)?.clues).toHaveLength(5);

    let threeState = newState();
    threeState = playGuess(threeState, c, D1, 'WORE');
    threeState = playGuess(threeState, c, D1, 'WARD');
    const three = submitJargleGuess(threeState, c, D1, 'WORD');
    expect(three.xpGained).toBe(50);

    let sixState = newState();
    for (let i = 0; i < 5; i++) sixState = playGuess(sixState, c, D1, 'ABCD');
    const six = submitJargleGuess(sixState, c, D1, 'WORD');
    expect(six.xpGained).toBe(20);
  });

  it('submits a loss with XP and four review dates', () => {
    const c = contentWithWord('WORD');
    let s = newState();
    for (let i = 0; i < 6; i++) s = playGuess(s, c, D1, 'ABCD');
    const review = s.review.word;
    expect(review).toEqual([addDays(D1, 1), addDays(D1, 2), addDays(D1, 3), addDays(D1, 7)]);
    expect(s.xp).toBe(10);
    const again = submitJargleGuess(s, c, D1, 'WORD');
    expect(again.outcome).toBe('ignored');
    expect(again.state).toBe(s);
  });

  it('does not mutate input state and returns next with no XP', () => {
    const c = contentWithWord('WORD');
    const s = newState();
    const before = JSON.stringify(s);
    const result = submitJargleGuess(s, c, D1, 'WORE');
    expect(JSON.stringify(s)).toBe(before);
    expect(result.outcome).toBe('next');
    expect(result.xpGained).toBe(0);
    expect(result.state.countedDays).toEqual([]);
  });

  it('ignores invalid length without changing state', () => {
    const c = contentWithWord('WORD');
    const s = newState();
    const result = submitJargleGuess(s, c, D1, 'NO');
    expect(result.outcome).toBe('ignored');
    expect(result.state).toBe(s);
  });

  it('shows exact share text for a three-guess win', () => {
    const c = contentWithWord('WORD');
    let s = newState();
    s = playGuess(s, c, D1, 'WORE');
    s = playGuess(s, c, D1, 'WARD');
    s = playGuess(s, c, D1, 'WORD');
    expect(jargleShareText(s, c, 1, { appUrl: 'https://jargle.test', demo: false })).toBe(
      'Jargle Day 1 3/6\n\n🟩🟩🟩⬜\n🟩⬜🟩🟩\n🟩🟩🟩🟩\n\nhttps://jargle.test',
    );
  });

  it('shows exact share text for a loss and demo title', () => {
    const c = contentWithWord('WORD');
    let s = newState();
    for (let i = 0; i < 6; i++) s = playGuess(s, c, D1, 'ABCD');
    expect(jargleShareText(s, c, 1, { appUrl: 'https://jargle.test', demo: false })).toBe(
      'Jargle Day 1 X/6\n\n⬜⬜⬜🟩\n⬜⬜⬜🟩\n⬜⬜⬜🟩\n⬜⬜⬜🟩\n⬜⬜⬜🟩\n⬜⬜⬜🟩\n\nhttps://jargle.test',
    );
    let win = newState();
    win = playGuess(win, c, D1, 'WORE');
    win = playGuess(win, c, D1, 'WARD');
    win = playGuess(win, c, D1, 'WORD');
    expect(jargleShareText(win, c, 1, { appUrl: 'https://jargle.test', demo: true })).toContain('Jargle demo 3/6');
  });

  it('returns an empty share string while playing', () => {
    expect(jargleShareText(newState(), contentWithWord('WORD'), 1, { appUrl: 'https://jargle.test', demo: false })).toBe('');
  });

  it('returns the right result line', () => {
    const c = contentWithWord('WORD');
    const first = submitJargleGuess(newState(), c, D1, 'WORD').state;
    expect(jargleResultLine(jargleView(first, c, D1)!)).toBe('First try! Wow.');

    let three = newState();
    three = playGuess(three, c, D1, 'WORE');
    three = playGuess(three, c, D1, 'WARD');
    three = playGuess(three, c, D1, 'WORD');
    expect(jargleResultLine(jargleView(three, c, D1)!)).toBe('You got it in 3!');

    let lost = newState();
    for (let i = 0; i < 6; i++) lost = playGuess(lost, c, D1, 'ABCD');
    expect(jargleResultLine(jargleView(lost, c, D1)!)).toBe("Good try! Here's today's word.");
    expect(jargleResultLine(jargleView(newState(), c, D1)!)).toBeNull();
  });
});

describe('Jargle and Home', () => {
  it('adds a Jargle win to yesterday\'s old clue round streak', () => {
    const c = buildContent({ schedule: ['two-factor-login', 'word'] });
    c.items.word.puzzle = 'WORD';
    let s = finishOldRound(newState(), c);
    s = playGuess(s, c, D2, 'WORD');
    const home = homeView(s, c, D2);
    expect(home.streak).toBe(2);
    expect(home.phase).toBe('played');
  });

  it('marks a playing Jargle game as started but unfinished on Home', () => {
    const c = contentWithWord('WORD');
    const s = playGuess(newState(), c, D1, 'WORE');
    const home = homeView(s, c, D1);
    expect(home.today?.started).toBe(true);
    expect(home.today?.finished).toBe(false);
  });
});
