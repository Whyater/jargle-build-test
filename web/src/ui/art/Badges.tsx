import type { BadgeId } from '../../engine/types';
import { BEIGE, CREAM, NAVY, OUTLINE, YELLOW, AMBER } from './palette';

type BadgeProps = {
  id: BadgeId;
  earned: boolean;
  size?: number;
  title?: string;
};

// The stamp edge: a square with six round bites cut out of each side, like
// the perforations on a postage stamp. Each bite is 4 flat, 7 across, 4 flat,
// so six of them span the 90 units from 3 to 93.
const STAMP_EDGE =
  'M3 3' +
  'h4a3.5 3.5 0 0 0 7 0h4'.repeat(6) +
  'v4a3.5 3.5 0 0 0 0 7v4'.repeat(6) +
  'h-4a3.5 3.5 0 0 0-7 0h-4'.repeat(6) +
  'v-4a3.5 3.5 0 0 0 0-7v-4'.repeat(6) +
  'Z';

// Finger holes on the dial: 10 spots on a ring, with a gap at the lower right
// where the finger stop sits on a real phone.
const DIAL_HOLES = [
  [64.4, 43.6],
  [60, 36],
  [52.4, 31.6],
  [43.6, 31.6],
  [36, 36],
  [31.6, 43.6],
  [31.6, 52.4],
  [36, 60],
  [43.6, 64.4],
  [52.4, 64.4],
];

// The object inside the stamp. Locked badges swap every color for beige so
// only the navy lines and navy shapes are left.
function BadgeIcon({ id, earned }: { id: BadgeId; earned: boolean }) {
  const accent = earned ? YELLOW : BEIGE;
  const warm = earned ? AMBER : BEIGE;
  const light = earned ? CREAM : BEIGE;
  // big navy areas would make a locked badge look as heavy as an earned one
  const dark = earned ? NAVY : BEIGE;
  const groove = earned ? BEIGE : NAVY;

  if (id === 'first-word') {
    // a floppy disk, drawn like Floyd but with a yellow label and no face
    return (
      <g>
        <path d="M24 20H68L76 28V72Q76 76 72 76H24Q20 76 20 72V24Q20 20 24 20Z" fill={dark} />
        <rect x="31" y="20" width="26" height="18" rx="1.5" fill={BEIGE} />
        <rect x="46" y="24" width="6" height="10" rx="1" fill={NAVY} stroke="none" />
        <rect x="26" y="46" width="44" height="30" rx="2" fill={accent} />
        <path d="M33 56H63M33 65H55" fill="none" />
      </g>
    );
  }

  if (id === 'week-one') {
    // a tear-off calendar page with the next page behind it and a 7 drawn as a path
    return (
      <g>
        <rect x="28" y="26" width="46" height="50" rx="3" fill={BEIGE} />
        <rect x="22" y="20" width="46" height="50" rx="3" fill={light} />
        <path d="M22 23Q22 20 25 20H65Q68 20 68 23V32H22Z" fill={warm} />
        <circle cx="32" cy="26" r="2" fill={NAVY} stroke="none" />
        <circle cx="58" cy="26" r="2" fill={NAVY} stroke="none" />
        <path d="M35 42H55L44 62" fill="none" stroke-width="5" />
      </g>
    );
  }

  if (id === 'days-30') {
    // a cassette: label with the tape window, and the trapezoid at the bottom
    return (
      <g>
        <rect x="16" y="26" width="64" height="44" rx="3" fill={accent} />
        <rect x="22" y="31" width="52" height="20" rx="2" fill={light} />
        <rect x="34" y="35" width="28" height="12" rx="6" fill={NAVY} />
        <circle cx="41" cy="41" r="3" fill={light} stroke="none" />
        <circle cx="55" cy="41" r="3" fill={light} stroke="none" />
        <path d="M30 70L35 58H61L66 70Z" fill={warm} />
        <circle cx="42" cy="64" r="1.5" fill={NAVY} stroke="none" />
        <circle cx="54" cy="64" r="1.5" fill={NAVY} stroke="none" />
      </g>
    );
  }

  if (id === 'days-60') {
    // a vinyl record: groove ring and shine arc flip color so they show on the disc
    return (
      <g>
        <circle cx="48" cy="48" r="27" fill={dark} />
        <circle cx="48" cy="48" r="19" fill="none" stroke={groove} stroke-width="1.5" />
        <path d="M64 32Q69 38 68 45" fill="none" stroke={groove} stroke-width="2.5" />
        <circle cx="48" cy="48" r="10" fill={accent} />
        <circle cx="48" cy="48" r="2.5" fill={NAVY} stroke="none" />
      </g>
    );
  }

  if (id === 'first-lesson') {
    // a pencil drawn lying flat, tip on the left, then tilted 45 degrees
    return (
      <g transform="rotate(-45 48 48)">
        <rect x="66" y="39" width="12" height="18" rx="3" fill={warm} />
        <rect x="60" y="39" width="7" height="18" fill={BEIGE} />
        <rect x="28" y="39" width="33" height="18" fill={accent} />
        <path d="M28 39L10 48L28 57Z" fill={light} />
        <path d="M10 48L17 44.5V51.5Z" fill={NAVY} />
        <path d="M30 48H59" fill="none" />
      </g>
    );
  }

  if (id === 'floyds-student') {
    // a rotary phone dial: navy phone body, finger wheel, ten holes, center hub
    return (
      <g>
        <circle cx="48" cy="48" r="28" fill={dark} />
        <circle cx="48" cy="48" r="23.5" fill={light} />
        {DIAL_HOLES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.3" fill={NAVY} stroke="none" />
        ))}
        <circle cx="48" cy="48" r="7" fill={warm} />
      </g>
    );
  }

  // taught-someone: a walkie-talkie with its antenna, knob, side button and speaker
  return (
    <g>
      <rect x="61" y="44" width="9" height="14" rx="2" fill={warm} />
      <rect x="36" y="14" width="7" height="22" rx="2" fill={NAVY} />
      <rect x="51" y="24" width="9" height="12" rx="2" fill={warm} />
      <rect x="29" y="32" width="36" height="50" rx="5" fill={accent} />
      <rect x="35" y="39" width="24" height="11" rx="2" fill={light} />
      <path d="M36 58H58M36 64H58M36 70H58" fill="none" />
    </g>
  );
}

// An achievement badge: an old computer lab object on a perforated stamp.
// Earned badges are in full color, locked ones are navy lines on beige.
export function Badge({ id, earned, size = 64, title }: BadgeProps) {
  let className = 'art art-badge';
  if (earned) className += ' art-badge-earned';

  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      {...OUTLINE}
    >
      {title && <title>{title}</title>}
      {/* stamp paper, then the beige panel the object sits on */}
      <path d={STAMP_EDGE} fill={earned ? CREAM : BEIGE} />
      <rect x="13" y="13" width="70" height="70" rx="2" fill={BEIGE} stroke="none" />
      <BadgeIcon id={id} earned={earned} />
    </svg>
  );
}
