import type { ComponentChildren } from 'preact';
import { buzz } from './feedback';

export type CardTone = 'plain' | 'grape' | 'coral' | 'mint' | 'sunny';

interface CardProps {
  children: ComponentChildren;
  /** Background color family. Plain is white. */
  tone?: CardTone;
  /** A card with href or onClick is one big pressable target. */
  href?: string;
  onClick?: () => void;
  /** Accessible name for a pressable card, when its text alone is not clear. */
  label?: string;
  class?: string;
}

/** A rounded white (or tinted) panel. Pressable cards sink a little on tap. */
export function Card({ children, tone = 'plain', href, onClick, label, class: extra }: CardProps) {
  let className = 'card card-' + tone;
  if (href || onClick) className += ' card-press';
  if (extra) className += ' ' + extra;

  if (href) {
    return (
      <a
        class={className}
        href={href}
        aria-label={label}
        onClick={() => {
          buzz();
          if (onClick) onClick();
        }}
      >
        {children}
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        class={className}
        aria-label={label}
        onClick={() => {
          buzz();
          onClick();
        }}
      >
        {children}
      </button>
    );
  }
  return <div class={className}>{children}</div>;
}
