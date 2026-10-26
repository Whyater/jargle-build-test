import { useEffect, useRef, useState } from 'preact/hooks';
import { playSound } from '../../platform/audio';

interface CounterProps {
  value: number;
  label: string;
  /** Roll up from this value with a typewriter ding (the Done card). */
  from?: number;
}

/** A number shown in fixed digit cells, like an odometer. Each changed digit rolls in. */
export function Counter({ value, label, from }: CounterProps) {
  const [shown, setShown] = useState(from !== undefined ? from : value);
  const [rolling, setRolling] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (shown === value) return;
    // Roll once, shortly after the card appears, so the change is seen.
    if (started.current) {
      setShown(value);
      return;
    }
    started.current = true;
    const timer = window.setTimeout(() => {
      setShown(value);
      setRolling(true);
      playSound('ding');
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  // One cell per digit, like an odometer. Empty cells looked like something failed to load.
  const digits = String(shown).split('');
  const previous = from !== undefined ? String(from) : '';
  return (
    <div class="counter">
      <span class="label">
        {label}: <span class="visually-hidden">{shown}</span>
      </span>
      <span class="cells" aria-hidden="true">
        {digits.map((d, i) => {
          const changed = rolling && previous.charAt(previous.length - digits.length + i) !== d;
          return (
            <span key={i + ':' + d} class={d === '' ? 'digit blank' : changed ? 'digit roll' : 'digit'}>
              <span>{d}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
}
