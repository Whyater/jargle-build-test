import type { ComponentChildren } from 'preact';

export type ChoiceState = 'idle' | 'right' | 'wrong' | 'dim';

/** How one option looks after an answer: the right one goes green, a wrong pick goes red. */
export function choiceState(option: string, answer: string, picked: string | null): ChoiceState {
  if (picked === null) return 'idle';
  if (option === answer) return 'right';
  if (option === picked) return 'wrong';
  return 'dim';
}

/** What a screen reader hears after the answer, added to the option's name. */
function stateWords(state: ChoiceState, isPicked: boolean): string {
  if (state === 'right') return isPicked ? ', your answer, correct' : ', correct answer';
  if (state === 'wrong') return ', your answer, not correct';
  return '';
}

interface ChoiceProps {
  option: string;
  answer: string;
  picked: string | null;
  onPick: (choice: string) => void;
  /** Little key hint in the corner, like "1" or "T". */
  keyHint?: string;
  /** "+20" that floats up from a right pick. */
  reward?: string | null;
  /** Extra class for the layout: 'row' (long text), 'tile' (short word), 'big' (True/False). */
  look: 'row' | 'tile' | 'big';
  /** Extra color for the two-button kinds. */
  tone?: 'coral' | 'mint';
  children?: ComponentChildren;
  /** What a screen reader hears when the visible text is not enough. */
  label?: string;
}

/** One answer button. It stays in place after the answer and only changes color, so nothing jumps. */
export function Choice(props: ChoiceProps) {
  const state = choiceState(props.option, props.answer, props.picked);
  const isPicked = props.picked === props.option;
  const locked = props.picked !== null;

  let className = 'choice-btn look-' + props.look + ' is-' + state;
  if (props.tone) className += ' tone-' + props.tone;
  if (isPicked) className += ' picked';

  function pick() {
    // The screen plays the right or wrong sound, so the button itself stays quiet.
    if (locked) return;
    props.onPick(props.option);
  }

  const name = (props.label || props.option) + stateWords(state, isPicked);

  return (
    <button
      type="button"
      class={className}
      onClick={pick}
      aria-disabled={locked ? 'true' : undefined}
      aria-label={name}
      data-option={props.option}
    >
      {props.keyHint ? (
        // The letter comes from CSS (data-key), so it is not part of the button's text.
        <span class="choice-key" aria-hidden="true" data-key={props.keyHint} />
      ) : null}
      <span class="choice-body" aria-hidden="true">
        {props.children || props.option}
      </span>
      <span class="choice-mark" aria-hidden="true">
        {state === 'right' ? <CheckMark /> : null}
        {state === 'wrong' ? <CrossMark /> : null}
      </span>
      {isPicked && state === 'right' && props.reward ? (
        <span class="choice-reward" aria-hidden="true">
          {props.reward}
        </span>
      ) : null}
    </button>
  );
}

export function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export function CrossMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}
