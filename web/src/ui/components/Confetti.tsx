import { reducedMotion } from './motion';

interface ConfettiProps {
  /** Change this number to fire a new burst (0 shows nothing). */
  burst: number;
}

const colors = ['var(--grape)', 'var(--coral)', 'var(--mint)', 'var(--sunny)', 'var(--correct)'];
const count = 18;

/**
 * A burst of paper bits from the center, pure CSS. Each bit gets its own angle and distance
 * through custom properties, and the whole thing is skipped when motion is reduced.
 */
export function Confetti({ burst }: ConfettiProps) {
  if (!burst || reducedMotion()) return null;
  const bits = [];
  for (let i = 0; i < count; i++) {
    // Spread the bits around a circle, with a little wobble so it does not look like a clock face.
    const angle = (360 / count) * i + ((i * 37) % 20);
    const distance = 90 + ((i * 53) % 70);
    const style = {
      background: colors[i % colors.length],
      '--angle': angle + 'deg',
      '--distance': distance + 'px',
      '--spin': (i % 2 ? 1 : -1) * (180 + i * 20) + 'deg',
      animationDelay: (i % 4) * 30 + 'ms',
    };
    bits.push(<span key={i} class={i % 3 === 0 ? 'bit round' : 'bit'} style={style} />);
  }
  return (
    <div class="confetti" key={burst} aria-hidden="true">
      {bits}
    </div>
  );
}
