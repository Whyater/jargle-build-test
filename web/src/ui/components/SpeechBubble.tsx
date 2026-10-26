import { useEffect, useState } from 'preact/hooks';
import { reducedMotion } from './motion';

interface SpeechBubbleProps {
  text: string;
  /** Which side the little tail points to (toward the mascot). */
  tail?: 'left' | 'right' | 'bottom';
  /** Called with true while letters are still appearing, so the mascot can move its mouth. */
  onTyping?: (typing: boolean) => void;
  /** Milliseconds per letter. */
  speed?: number;
}

/**
 * A speech bubble that types its line out letter by letter. Tapping it shows the whole line at
 * once. The full line is always in the page for screen readers; only the look is typed out.
 */
export function SpeechBubble({ text, tail = 'left', onTyping, speed = 28 }: SpeechBubbleProps) {
  const [shown, setShown] = useState(() => (reducedMotion() ? text.length : 0));

  useEffect(() => {
    if (reducedMotion()) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let count = 0;
    if (onTyping) onTyping(true);
    const timer = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= text.length) {
        window.clearInterval(timer);
        if (onTyping) onTyping(false);
      }
    }, speed);
    return () => {
      window.clearInterval(timer);
      // Leaving mid-line must not leave the mascot talking.
      if (onTyping) onTyping(false);
    };
  }, [text, speed]);

  const done = shown >= text.length;

  function skip() {
    if (done) return;
    setShown(text.length);
    if (onTyping) onTyping(false);
  }

  return (
    <p class={'bubble tail-' + tail} onClick={skip}>
      <span class="visually-hidden">{text}</span>
      {/* The hidden rest of the line keeps the bubble its final size, so nothing jumps while typing. */}
      <span aria-hidden="true">
        {text.slice(0, shown)}
        <span class="bubble-rest">{text.slice(shown)}</span>
      </span>
    </p>
  );
}
