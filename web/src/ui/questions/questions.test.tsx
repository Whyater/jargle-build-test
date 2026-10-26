// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { EndlessAnswer, Question, QuestionKind } from '../../engine/types';
import { endlessContent } from '../screens/endlessFixture';
import { fakeQuestion } from '../screens/endlessFake';
import { choiceState } from './Choice';
import { cluePoints } from './ClueClimb';
import { QuestionView } from './QuestionView';
import { choiceForKey } from './keys';

const roots: HTMLElement[] = [];

function mount(node: preact.ComponentChildren) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  roots.push(root);
  // act also runs the effects right away, like the browser does before anyone can click.
  act(() => {
    render(node, root);
  });
  return root;
}

// Take every mounted question off the page so old key listeners go away.
afterEach(() => {
  for (const root of roots) {
    render(null, root);
    root.remove();
  }
  roots.length = 0;
});

// Lets Preact run its effects, like adding the keydown listener.
async function flush() {
  await act(() => {});
}

async function pressKey(key: string) {
  await act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

async function clickButton(button: HTMLElement) {
  await act(() => {
    button.click();
  });
}

const kinds: QuestionKind[] = ['meaning', 'name', 'truefalse', 'oldnew', 'clue'];

function expectedCount(kind: QuestionKind): number {
  if (kind === 'truefalse' || kind === 'oldnew') return 2;
  return 4;
}

function wrongChoice(question: Question): string {
  for (const option of question.options) {
    if (option !== question.answer) return option;
  }
  throw new Error('no wrong option');
}

function optionButtons(root: HTMLElement) {
  return root.querySelectorAll<HTMLButtonElement>('[data-option]');
}

describe('choiceState', () => {
  it('is idle before anything is picked', () => {
    expect(choiceState('a', 'a', null)).toBe('idle');
    expect(choiceState('b', 'a', null)).toBe('idle');
  });

  it('is right for the answer once something is picked', () => {
    expect(choiceState('a', 'a', 'a')).toBe('right');
    expect(choiceState('a', 'a', 'b')).toBe('right');
  });

  it('is wrong for a wrong pick', () => {
    expect(choiceState('b', 'a', 'b')).toBe('wrong');
  });

  it('is dim for every other option', () => {
    expect(choiceState('c', 'a', 'b')).toBe('dim');
    expect(choiceState('c', 'a', 'a')).toBe('dim');
  });
});

describe('choiceForKey', () => {
  const four = ['one', 'two', 'three', 'four'];
  const trueFalse = ['True', 'False'];
  const oldNew = ['Old tech', "Today's tech"];

  it('maps the number keys 1 to 4', () => {
    expect(choiceForKey('meaning', four, '1')).toBe('one');
    expect(choiceForKey('meaning', four, '2')).toBe('two');
    expect(choiceForKey('name', four, '3')).toBe('three');
    expect(choiceForKey('clue', four, '4')).toBe('four');
  });

  it('maps T and F for true or false, in either case', () => {
    expect(choiceForKey('truefalse', trueFalse, 't')).toBe('True');
    expect(choiceForKey('truefalse', trueFalse, 'T')).toBe('True');
    expect(choiceForKey('truefalse', trueFalse, 'f')).toBe('False');
    expect(choiceForKey('truefalse', trueFalse, 'F')).toBe('False');
  });

  it('maps O and N for old or new, in either case', () => {
    expect(choiceForKey('oldnew', oldNew, 'o')).toBe('Old tech');
    expect(choiceForKey('oldnew', oldNew, 'O')).toBe('Old tech');
    expect(choiceForKey('oldnew', oldNew, 'n')).toBe("Today's tech");
    expect(choiceForKey('oldnew', oldNew, 'N')).toBe("Today's tech");
  });

  it('gives null for numbers out of range', () => {
    expect(choiceForKey('meaning', four, '0')).toBeNull();
    expect(choiceForKey('meaning', four, '5')).toBeNull();
    expect(choiceForKey('truefalse', trueFalse, '3')).toBeNull();
    expect(choiceForKey('oldnew', oldNew, '4')).toBeNull();
  });

  it('gives null for other keys', () => {
    expect(choiceForKey('meaning', four, 'x')).toBeNull();
    expect(choiceForKey('meaning', four, 'Enter')).toBeNull();
    expect(choiceForKey('meaning', four, 't')).toBeNull();
    expect(choiceForKey('truefalse', trueFalse, 'o')).toBeNull();
    expect(choiceForKey('oldnew', oldNew, 't')).toBeNull();
    expect(choiceForKey('clue', four, 'c')).toBeNull();
  });

  it('does not treat a long key as a number', () => {
    expect(choiceForKey('meaning', four, '12')).toBeNull();
  });
});

describe('every question kind', () => {
  for (const kind of kinds) {
    describe(kind, () => {
      const question = fakeQuestion(endlessContent, 'pixel', kind, 4);

      it('renders the right number of option buttons', () => {
        const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
        expect(optionButtons(root)).toHaveLength(expectedCount(kind));
      });

      it('shows every option text on a button', () => {
        const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
        const buttons = optionButtons(root);
        for (let i = 0; i < buttons.length; i++) {
          expect(buttons[i].dataset.option).toBe(question.options[i]);
        }
      });

      it('calls onAnswer with the clicked choice', async () => {
        const onAnswer = vi.fn();
        const root = mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} keysOn={false} />);
        const buttons = optionButtons(root);
        await clickButton(buttons[1]);
        expect(onAnswer).toHaveBeenCalledTimes(1);
        const expected: EndlessAnswer = { choice: question.options[1] };
        if (kind === 'clue') expected.cluesUsed = 1;
        expect(onAnswer).toHaveBeenCalledWith(expected);
      });

      it('marks a right pick: right is green, the rest are dim, all locked', async () => {
        const onAnswer = vi.fn();
        const root = mount(
          <QuestionView question={question} picked={question.answer} onAnswer={onAnswer} keysOn={false} />,
        );
        const buttons = optionButtons(root);
        for (const button of buttons) {
          expect(button.getAttribute('aria-disabled')).toBe('true');
          if (button.dataset.option === question.answer) {
            expect(button.classList.contains('is-right')).toBe(true);
          } else {
            expect(button.classList.contains('is-dim')).toBe(true);
          }
        }
        expect(root.querySelectorAll('.is-wrong')).toHaveLength(0);
        await clickButton(buttons[0]);
        await clickButton(buttons[1]);
        expect(onAnswer).not.toHaveBeenCalled();
      });

      it('marks a wrong pick: wrong is red, the answer is green, the rest are dim', async () => {
        const onAnswer = vi.fn();
        const wrong = wrongChoice(question);
        const root = mount(<QuestionView question={question} picked={wrong} onAnswer={onAnswer} keysOn={false} />);
        const buttons = optionButtons(root);
        let wrongCount = 0;
        let rightCount = 0;
        let dimCount = 0;
        for (const button of buttons) {
          expect(button.getAttribute('aria-disabled')).toBe('true');
          if (button.dataset.option === wrong) {
            expect(button.classList.contains('is-wrong')).toBe(true);
            wrongCount++;
          } else if (button.dataset.option === question.answer) {
            expect(button.classList.contains('is-right')).toBe(true);
            rightCount++;
          } else {
            expect(button.classList.contains('is-dim')).toBe(true);
            dimCount++;
          }
        }
        expect(wrongCount).toBe(1);
        expect(rightCount).toBe(1);
        expect(dimCount).toBe(expectedCount(kind) - 2);
        for (const button of buttons) await clickButton(button);
        expect(onAnswer).not.toHaveBeenCalled();
      });

      it('has no disabled look before an answer', () => {
        const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
        for (const button of optionButtons(root)) {
          expect(button.getAttribute('aria-disabled')).toBeNull();
          expect(button.classList.contains('is-idle')).toBe(true);
        }
      });
    });
  }
});

describe('keyboard answers', () => {
  it('2 picks the second option of a meaning question', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('2');
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[1] });
  });

  it('1 to 4 pick the matching option of a name question', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'name', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    for (let i = 0; i < 4; i++) {
      await pressKey(String(i + 1));
      expect(onAnswer).toHaveBeenLastCalledWith({ choice: question.options[i] });
    }
  });

  it('t picks True and f picks False', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'truefalse', 5);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('t');
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: 'True' });
    await pressKey('f');
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: 'False' });
  });

  it('o picks Old tech and n picks Today\'s tech', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'oldnew', 5);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('o');
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: 'Old tech' });
    await pressKey('n');
    expect(onAnswer).toHaveBeenLastCalledWith({ choice: "Today's tech" });
  });

  it('a number key picks an option of a clue question with the clue count', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'clue', 6);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('3');
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[2], cluesUsed: 1 });
  });

  it('ignores keys that mean nothing for the question', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('t');
    await pressKey('9');
    await pressKey('x');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier held down', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('does nothing when keysOn is false', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} keysOn={false} />);
    await flush();
    await pressKey('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('does nothing after the question was answered', async () => {
    const question = fakeQuestion(endlessContent, 'pixel', 'meaning', 4);
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={question.answer} onAnswer={onAnswer} />);
    await flush();
    await pressKey('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('ClueClimb', () => {
  const question = fakeQuestion(endlessContent, 'pixel', 'clue', 6);

  function openClues(root: HTMLElement) {
    return root.querySelectorAll('.q-clue.open');
  }

  it('starts with one open clue out of three', () => {
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    expect(openClues(root)).toHaveLength(1);
    expect(root.querySelectorAll('.q-clue')).toHaveLength(3);
  });

  it('hides the text of clues that are not open yet', () => {
    if (question.kind !== 'clue') throw new Error('wrong kind');
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    expect(root.textContent).toContain(question.clues[0]);
    expect(root.textContent).not.toContain(question.clues[1]);
    expect(root.textContent).not.toContain(question.clues[2]);
  });

  it('opens the next clue when Another clue is clicked', async () => {
    if (question.kind !== 'clue') throw new Error('wrong kind');
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    const more = root.querySelector<HTMLButtonElement>('.q-more')!;
    expect(more.textContent).toContain('Another clue');
    await clickButton(more);
    expect(openClues(root)).toHaveLength(2);
    expect(root.textContent).toContain(question.clues[1]);
    await clickButton(more);
    expect(openClues(root)).toHaveLength(3);
  });

  it('stops at three clues and says all clues are shown', async () => {
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    const more = root.querySelector<HTMLButtonElement>('.q-more')!;
    await clickButton(more);
    await clickButton(more);
    await clickButton(more);
    expect(openClues(root)).toHaveLength(3);
    expect(more.textContent).toContain('All clues shown');
    expect(more.getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the next clue with the c key', async () => {
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} />);
    await flush();
    await pressKey('c');
    expect(openClues(root)).toHaveLength(2);
    await pressKey('C');
    expect(openClues(root)).toHaveLength(3);
    await pressKey('c');
    expect(openClues(root)).toHaveLength(3);
  });

  it('does not open clues after the question was answered', async () => {
    const root = mount(<QuestionView question={question} picked={question.answer} onAnswer={vi.fn()} />);
    await flush();
    await clickButton(root.querySelector<HTMLButtonElement>('.q-more')!);
    await pressKey('c');
    expect(openClues(root)).toHaveLength(1);
  });

  it('shows Worth as 30, 20, 10 times the multiplier', async () => {
    const multipliers = [1, 2, 3];
    for (const multiplier of multipliers) {
      const root = mount(
        <QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} multiplier={multiplier} />,
      );
      const worth = root.querySelector('.q-worth')!;
      const more = root.querySelector<HTMLButtonElement>('.q-more')!;
      expect(worth.textContent).toBe('Worth ' + 30 * multiplier);
      await clickButton(more);
      expect(worth.textContent).toBe('Worth ' + 20 * multiplier);
      await clickButton(more);
      expect(worth.textContent).toBe('Worth ' + 10 * multiplier);
    }
  });

  it('shows Worth 30 when there is no multiplier prop', () => {
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    expect(root.querySelector('.q-worth')!.textContent).toBe('Worth 30');
  });

  it('reports one clue used when answered right away', async () => {
    const onAnswer = vi.fn();
    const root = mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} keysOn={false} />);
    await clickButton(optionButtons(root)[0]);
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[0], cluesUsed: 1 });
  });

  it('reports two clues used after one extra clue', async () => {
    const onAnswer = vi.fn();
    const root = mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} keysOn={false} />);
    await clickButton(root.querySelector<HTMLButtonElement>('.q-more')!);
    await clickButton(optionButtons(root)[2]);
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[2], cluesUsed: 2 });
  });

  it('reports three clues used after two extra clues', async () => {
    const onAnswer = vi.fn();
    const root = mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} keysOn={false} />);
    const more = root.querySelector<HTMLButtonElement>('.q-more')!;
    await clickButton(more);
    await clickButton(more);
    await clickButton(optionButtons(root)[3]);
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[3], cluesUsed: 3 });
  });

  it('reports the clues shown when answering with a key', async () => {
    const onAnswer = vi.fn();
    mount(<QuestionView question={question} picked={null} onAnswer={onAnswer} />);
    await flush();
    await pressKey('c');
    await pressKey('c');
    await pressKey('1');
    expect(onAnswer).toHaveBeenCalledWith({ choice: question.options[0], cluesUsed: 3 });
  });

  it('goes back to one clue for a new question', async () => {
    const second = fakeQuestion(endlessContent, 'cache', 'clue', 7);
    const root = mount(<QuestionView question={question} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    await clickButton(root.querySelector<HTMLButtonElement>('.q-more')!);
    expect(openClues(root)).toHaveLength(2);
    await act(() => {
      render(<QuestionView question={second} picked={null} onAnswer={vi.fn()} keysOn={false} />, root);
    });
    expect(openClues(root)).toHaveLength(1);
  });
});

describe('cluePoints', () => {
  it('is 30, 20, 10 for one, two and three clues', () => {
    expect(cluePoints(1)).toBe(30);
    expect(cluePoints(2)).toBe(20);
    expect(cluePoints(3)).toBe(10);
  });
});

describe('TrueFalse glyphs', () => {
  // The check mark path starts "M5 12.5" and the cross path starts "M7 7".
  function glyphOf(button: Element): string {
    const path = button.querySelector('.big-icon path');
    if (!path) return 'none';
    const d = path.getAttribute('d') || '';
    if (d.indexOf('M5 12.5') === 0) return 'check';
    if (d.indexOf('M7 7') === 0) return 'cross';
    return 'other';
  }

  function falseQuestion(): Question {
    const base = fakeQuestion(endlessContent, 'pixel', 'truefalse', 5);
    if (base.kind !== 'truefalse') throw new Error('wrong kind');
    return { ...base, answer: 'False' };
  }

  function trueQuestion(): Question {
    const base = fakeQuestion(endlessContent, 'pixel', 'truefalse', 5);
    if (base.kind !== 'truefalse') throw new Error('wrong kind');
    return { ...base, answer: 'True' };
  }

  it('shows a check on True and a cross on False before an answer', () => {
    const root = mount(<QuestionView question={falseQuestion()} picked={null} onAnswer={vi.fn()} keysOn={false} />);
    const buttons = optionButtons(root);
    expect(buttons[0].dataset.option).toBe('True');
    expect(glyphOf(buttons[0])).toBe('check');
    expect(glyphOf(buttons[1])).toBe('cross');
  });

  it('shows a check, not a cross, on a right False pick', () => {
    const root = mount(<QuestionView question={falseQuestion()} picked="False" onAnswer={vi.fn()} keysOn={false} />);
    const buttons = optionButtons(root);
    expect(buttons[1].dataset.option).toBe('False');
    expect(buttons[1].classList.contains('is-right')).toBe(true);
    expect(glyphOf(buttons[1])).toBe('check');
    expect(buttons[1].querySelector('.big-icon')!.querySelectorAll('svg')).toHaveLength(1);
  });

  it('shows no glyph on the dim True after a right False pick', () => {
    const root = mount(<QuestionView question={falseQuestion()} picked="False" onAnswer={vi.fn()} keysOn={false} />);
    expect(glyphOf(optionButtons(root)[0])).toBe('none');
  });

  it('shows a cross on a wrong True pick and a check on the right False', () => {
    const root = mount(<QuestionView question={falseQuestion()} picked="True" onAnswer={vi.fn()} keysOn={false} />);
    const buttons = optionButtons(root);
    expect(buttons[0].classList.contains('is-wrong')).toBe(true);
    expect(glyphOf(buttons[0])).toBe('cross');
    expect(glyphOf(buttons[1])).toBe('check');
  });

  it('shows a check on a right True pick', () => {
    const root = mount(<QuestionView question={trueQuestion()} picked="True" onAnswer={vi.fn()} keysOn={false} />);
    const buttons = optionButtons(root);
    expect(glyphOf(buttons[0])).toBe('check');
    expect(glyphOf(buttons[1])).toBe('none');
  });
});
