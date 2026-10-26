// Keyboard shortcuts for the question screens: 1-4 pick an answer, T and F answer
// True or False, O and N answer Old or New, C shows another clue.

import { useEffect } from 'preact/hooks';
import type { QuestionKind } from '../../engine/types';

/** The option a key picks, or null if the key does nothing for this question. */
export function choiceForKey(kind: QuestionKind, options: string[], key: string): string | null {
  const lower = key.toLowerCase();
  if (kind === 'truefalse') {
    if (lower === 't') return options[0];
    if (lower === 'f') return options[1];
  }
  if (kind === 'oldnew') {
    if (lower === 'o') return options[0];
    if (lower === 'n') return options[1];
  }
  const number = Number(key);
  if (key.length === 1 && number >= 1 && number <= options.length) {
    return options[number - 1];
  }
  return null;
}

/** True when a key press came from a text field or had a modifier, so we leave it alone. */
export function ignoreKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/** Listens for answer keys while `active` is true. `onOther` gets every other key (the clue key). */
export function useAnswerKeys(
  kind: QuestionKind,
  options: string[],
  active: boolean,
  onPick: (choice: string) => void,
  onOther?: (key: string) => void,
): void {
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (ignoreKey(event)) return;
      const choice = choiceForKey(kind, options, event.key);
      if (choice !== null) {
        event.preventDefault();
        onPick(choice);
        return;
      }
      if (onOther) onOther(event.key);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, options.join('|'), active, onPick, onOther]);
}
