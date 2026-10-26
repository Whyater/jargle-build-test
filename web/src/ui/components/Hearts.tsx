import { GameIcon } from './GameIcon';

interface HeartsProps {
  /** Hearts still full. */
  left: number;
  total?: number;
}

/** Lives in Endless. A lost heart turns grey and pops once. */
export function Hearts({ left, total = 3 }: HeartsProps) {
  const hearts = [];
  for (let i = 0; i < total; i++) {
    const full = i < left;
    hearts.push(
      <span key={i} class={full ? 'heart' : 'heart lost'}>
        <GameIcon name="heart" size={26} />
      </span>,
    );
  }
  const label = left === 1 ? '1 heart left' : left + ' hearts left';
  return (
    <div class="hearts" role="img" aria-label={label}>
      {hearts}
    </div>
  );
}
