import type { ComponentChildren } from 'preact';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';

export type PillTone = 'plain' | 'grape' | 'coral' | 'mint' | 'sunny' | 'flame' | 'correct' | 'wrong';

interface PillProps {
  children: ComponentChildren;
  tone?: PillTone;
  icon?: GameIconName;
  /** Read instead of the visible text, for example "3 day streak" for a pill showing "3". */
  label?: string;
  class?: string;
}

/** A small rounded chip for counts and tags: streak, XP, "New", "Done". */
export function Pill({ children, tone = 'plain', icon, label, class: extra }: PillProps) {
  return (
    <span class={'pill pill-' + tone + (extra ? ' ' + extra : '')} role={label ? 'img' : undefined} aria-label={label}>
      {icon ? <GameIcon name={icon} size={18} /> : null}
      <span aria-hidden={label ? 'true' : undefined}>{children}</span>
    </span>
  );
}
