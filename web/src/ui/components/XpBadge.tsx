import { GameIcon } from './GameIcon';

interface XpBadgeProps {
  level: number;
  /** Bigger badge for the Me tab. */
  big?: boolean;
}

/** The level number on a sunny star. */
export function XpBadge({ level, big }: XpBadgeProps) {
  return (
    <span class={big ? 'xp-badge big' : 'xp-badge'} role="img" aria-label={'Level ' + level}>
      <GameIcon name="star" size={big ? 72 : 40} />
      <span class="num" aria-hidden="true">
        {level}
      </span>
    </span>
  );
}

interface StreakProps {
  days: number;
}

/** The streak flame with its day count. Grey when there is no streak yet. */
export function Streak({ days }: StreakProps) {
  const label = days === 1 ? '1 day streak' : days + ' day streak';
  return (
    <span class={days > 0 ? 'streak-flame on' : 'streak-flame'} role="img" aria-label={label}>
      <GameIcon name="flame" size={26} />
      <span class="num" aria-hidden="true">
        {days}
      </span>
    </span>
  );
}
