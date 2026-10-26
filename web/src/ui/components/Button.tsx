import type { ComponentChildren } from 'preact';
import { Icon } from './Icons';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';
import { buzz, feedback } from './feedback';

type OldIconName = 'home' | 'settings' | 'help' | 'check' | 'lock' | 'back' | 'copy' | 'share' | 'download';

/** Candy colors. "primary" is grape. "plain" is the white button. */
export type ButtonVariant = 'primary' | 'plain' | 'coral' | 'mint' | 'sunny' | 'correct' | 'ghost';

interface ButtonProps {
  children: ComponentChildren;
  onClick?: () => void;
  /** Same as variant="primary" (kept for older screens). */
  primary?: boolean;
  variant?: ButtonVariant;
  block?: boolean;
  small?: boolean;
  /** The tall main action of a screen. */
  big?: boolean;
  /** Shown as unavailable but stays focusable, so the reason in the label can be read. */
  disabled?: boolean;
  icon?: OldIconName;
  gameIcon?: GameIconName;
  /** Play the tap sound too (the round screens play their own sounds, so it is off by default). */
  sound?: boolean;
  label?: string;
  id?: string;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

function buttonClass(
  variant: ButtonVariant | undefined,
  primary: boolean | undefined,
  block?: boolean,
  small?: boolean,
  big?: boolean,
): string {
  let className = 'btn';
  const chosen = variant || (primary ? 'primary' : 'plain');
  if (chosen !== 'plain') className += ' btn-' + chosen;
  if (block) className += ' btn-block';
  if (small) className += ' btn-small';
  if (big) className += ' btn-big';
  return className;
}

export function Button(props: ButtonProps) {
  function handleClick() {
    if (props.disabled) return;
    if (props.sound) feedback('tap');
    else buzz();
    if (props.onClick) props.onClick();
  }

  return (
    <button
      type="button"
      id={props.id}
      class={buttonClass(props.variant, props.primary, props.block, props.small, props.big)}
      onClick={handleClick}
      aria-disabled={props.disabled ? 'true' : undefined}
      aria-label={props.label}
      ref={props.buttonRef}
    >
      {props.icon ? <Icon name={props.icon} /> : null}
      {props.gameIcon ? <GameIcon name={props.gameIcon} /> : null}
      <span>{props.children}</span>
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  children: ComponentChildren;
  primary?: boolean;
  variant?: ButtonVariant;
  block?: boolean;
  small?: boolean;
  big?: boolean;
  icon?: OldIconName;
  gameIcon?: GameIconName;
  external?: boolean;
}

/** Looks like a button but navigates (a real link, so it works with the Back button). */
export function LinkButton(props: LinkButtonProps) {
  return (
    <a
      class={buttonClass(props.variant, props.primary, props.block, props.small, props.big)}
      href={props.href}
      target={props.external ? '_blank' : undefined}
      rel={props.external ? 'noopener' : undefined}
      onClick={() => buzz()}
    >
      {props.icon ? <Icon name={props.icon} /> : null}
      {props.gameIcon ? <GameIcon name={props.gameIcon} /> : null}
      <span>{props.children}</span>
    </a>
  );
}
