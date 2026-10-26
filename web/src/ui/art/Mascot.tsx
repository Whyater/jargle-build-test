import { useEffect, useState } from 'preact/hooks';
import type { Speaker } from '../../engine/types';
import './mascot.css';

export type MascotPose = 'idle' | 'talk' | 'happy' | 'oops' | 'think' | 'wave';

type MascotProps = {
  who: Speaker;
  pose?: MascotPose;
  size?: number;
  // While true the mouth opens and closes, for when a speech bubble is typing out.
  talking?: boolean;
  title?: string;
  wiggle?: boolean;
};

// How long each mouth frame stays up while talking.
export const TALK_FRAME_MS = 140;

// The renders are square, with the same framing for every pose, so the feet
// stay on the same spot when the pose changes.
function spriteUrl(who: Speaker, frame: string, small: boolean) {
  return import.meta.env.BASE_URL + 'mascots/' + who + '-' + frame + (small ? '@1x' : '') + '.webp';
}

function srcSet(who: Speaker, frame: string) {
  return spriteUrl(who, frame, true) + ' 192w, ' + spriteUrl(who, frame, false) + ' 384w';
}

function motionIsReduced() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('reduce-motion')) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Fetch the frames that show up most, once, so the first swap does not flash.
let preloaded = false;
function preloadFrames() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  // Most mascots show at 56 to 96 px, so phones up to 2x screens pick the 192 px files.
  const small = typeof window === 'undefined' || (window.devicePixelRatio || 1) < 2.5;
  const frames = ['idle', 'talk', 'happy', 'blink', 'wave'];
  for (const who of ['floyd', 'bud'] as const) {
    for (const frame of frames) {
      const img = new Image();
      img.src = spriteUrl(who, frame, small);
    }
  }
}

/** Floyd or Bud as a pre-rendered picture, with a gentle bob and a blink. */
export function Mascot({ who, pose = 'idle', size = 96, talking = false, title, wiggle = false }: MascotProps) {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    preloadFrames();
  }, []);

  useEffect(() => {
    setMouthOpen(false);
    if (!talking || motionIsReduced()) return;
    const timer = window.setInterval(() => setMouthOpen((open) => !open), TALK_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [talking]);

  // When talking, the base frame is idle and the talk frame flips on top of it.
  // Keeping both pictures in the page means the swap never waits for a download.
  const base = talking ? 'idle' : pose;
  const showBlink = base === 'idle' && !talking;

  let className = 'mascot mascot-' + who;
  if (wiggle) className += ' art-wiggle';

  const imgProps = {
    class: 'mascot-img',
    width: size,
    height: size,
    sizes: size + 'px',
    alt: '',
    draggable: false,
    decoding: 'async' as const,
  };

  return (
    <span
      class={className}
      style={{ width: size + 'px', height: size + 'px' }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <span class="mascot-bob">
        <img {...imgProps} src={spriteUrl(who, base, false)} srcset={srcSet(who, base)} data-frame={base} />
        {talking && (
          <img
            {...imgProps}
            class={'mascot-img mascot-layer' + (mouthOpen ? '' : ' mascot-off')}
            src={spriteUrl(who, 'talk', false)}
            srcset={srcSet(who, 'talk')}
            data-frame="talk"
          />
        )}
        {showBlink && (
          <img
            {...imgProps}
            class="mascot-img mascot-layer mascot-blink"
            src={spriteUrl(who, 'blink', false)}
            srcset={srcSet(who, 'blink')}
            data-frame="blink"
          />
        )}
      </span>
    </span>
  );
}
