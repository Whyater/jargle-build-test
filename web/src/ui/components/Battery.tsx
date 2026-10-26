interface BatteryProps {
  bars: number;
  /** Bars light one after another (used when a round is solved). */
  lightUp?: boolean;
  small?: boolean;
}

/** Six bars. Full bars are yellow, used bars are a dashed outline. */
export function Battery({ bars, lightUp, small }: BatteryProps) {
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const full = i < bars;
    let className = 'cell';
    if (!full) className += ' used';
    if (full && lightUp) className += ' glow';
    // Each kept bar lights 120 ms after the one before it.
    const style = full && lightUp ? { animationDelay: 250 + i * 120 + 'ms' } : undefined;
    cells.push(<span key={i} class={className} style={style} />);
  }
  const label = bars === 1 ? '1 of 6 bars left' : bars + ' of 6 bars left';
  return (
    <div class={small ? 'battery small' : 'battery'} role="img" aria-label={label}>
      <span class="body">{cells}</span>
      <span class="nub" />
    </div>
  );
}
