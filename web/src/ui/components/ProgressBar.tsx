interface ProgressBarProps {
  /** How much is filled, from 0 to max. */
  value: number;
  max: number;
  tone?: 'grape' | 'sunny' | 'mint' | 'coral' | 'correct';
  /** Read by screen readers, for example "Level 3: 20 of 70 XP". */
  label: string;
  /** Thicker bar for headers. */
  big?: boolean;
}

/** A rounded track with a candy fill. The fill grows smoothly when value changes. */
export function ProgressBar({ value, max, tone = 'grape', label, big }: ProgressBarProps) {
  let part = max > 0 ? value / max : 0;
  if (part < 0) part = 0;
  if (part > 1) part = 1;
  return (
    <div
      class={'progress progress-' + tone + (big ? ' progress-big' : '')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
    >
      {/* scaleX instead of width, so growing the bar never re-lays out the page. */}
      <span class="fill" style={{ transform: 'scaleX(' + part + ')' }} />
    </div>
  );
}
