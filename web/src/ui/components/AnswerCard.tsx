import { useEffect, useRef, useState } from 'preact/hooks';
import type { CardView } from '../../engine/api';
import { Icon } from './Icons';

interface AnswerCardProps {
  card: CardView;
  /** 1-based position, used for the keyboard hint and to vary the tab shape. */
  index: number;
  onPick: (term: string) => void;
  /** Lets the round screen focus or scroll to this card. */
  cardRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * One index card. Live cards are buttons with aria-pressed. A flipped card stays a
 * focusable button (so focus is never lost) but does nothing when tapped.
 */
export function AnswerCard({ card, index, onPick, cardRef }: AnswerCardProps) {
  // Play the flip only when the state changes while the card is on screen, not on first render.
  const lastState = useRef(card.state);
  const lastSelected = useRef(card.selected);
  const [motion, setMotion] = useState('');

  useEffect(() => {
    if (lastState.current !== card.state) {
      setMotion('flip');
    } else if (!lastSelected.current && card.selected) {
      setMotion('lift');
    }
    lastState.current = card.state;
    lastSelected.current = card.selected;
  }, [card.state, card.selected]);

  let className = 'answer-card';
  if (card.state === 'missed') className += ' is-missed';
  if (card.state === 'answer') className += ' is-answer';
  if (motion) className += ' ' + motion;

  const live = card.state === 'live';
  // Wrong-card tabs cycle through three shapes.
  const tabClass = 'tab tab-' + (((index - 1) % 3) + 1);

  return (
    <button
      type="button"
      class={className}
      ref={cardRef}
      aria-pressed={card.selected ? 'true' : 'false'}
      aria-disabled={live ? undefined : 'true'}
      onClick={() => {
        if (live) onPick(card.term);
      }}
      onAnimationEnd={() => setMotion('')}
    >
      {card.state === 'missed' ? <span class={tabClass}>Not this one</span> : null}
      {card.state === 'answer' ? <span class="visually-hidden">Right answer: </span> : null}
      <span class="term">{card.term}</span>
      {card.state === 'answer' ? (
        <span class="state-icon">
          <Icon name="check" />
        </span>
      ) : null}
      {live && card.selected ? (
        <span class="state-icon picked" />
      ) : null}
      {card.state !== 'live' && card.meaning ? <span class="meaning">{card.meaning}</span> : null}
    </button>
  );
}
