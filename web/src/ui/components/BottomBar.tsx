import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { TextSize } from '../../engine/types';

/**
 * Decides once whether the bottom bar is pinned to the bottom of the screen.
 * Pinned only at Normal and Large, on screens 568 px tall or more, and only if the bar
 * (sized for its tallest message) takes 40% of the screen or less. It is checked when the
 * screen opens and when the text size changes, never after a tap, so it never jumps mid-round.
 */
export function usePinned(textSize: TextSize) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(window.innerHeight >= 568 && textSize !== 'largest');
  // While measuring, the strip holds the tallest message so the 40% test uses the worst case.
  const [measuring, setMeasuring] = useState(true);

  useLayoutEffect(() => {
    setMeasuring(true);
  }, [textSize]);

  useLayoutEffect(() => {
    if (!measuring) return;
    const screenHeight = window.innerHeight;
    let canPin = screenHeight >= 568 && textSize !== 'largest';
    if (canPin && barRef.current) {
      barRef.current.classList.add('pinned');
      if (barRef.current.offsetHeight > screenHeight * 0.4) canPin = false;
    }
    setPinned(canPin);
    setMeasuring(false);
  }, [measuring, textSize]);

  return { barRef, pinned, measuring };
}

interface BottomBarProps {
  pinned: boolean;
  measuring: boolean;
  barRef: { current: HTMLDivElement | null };
  /** Shown in the bar only when pinned; unpinned screens show it next to what changed. */
  message: string;
  /** The longest message this screen can show, used only for the pinning test. */
  tallestMessage: string;
  children: ComponentChildren;
}

export function BottomBar(props: BottomBarProps) {
  // The pinned bar covers the bottom of the screen, so reserve its height as padding at the
  // very end of the page. A spacer where the bar sits in the markup would leave a blank band
  // in the middle of Home.
  useLayoutEffect(() => {
    const height = props.pinned && props.barRef.current ? props.barRef.current.offsetHeight : 0;
    document.body.style.paddingBottom = height ? height + 'px' : '';
  });
  useLayoutEffect(() => {
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, []);

  const showStrip = props.pinned || props.measuring;
  const text = props.measuring ? props.tallestMessage : props.message;
  // The first-round label and a strip message never show together (the first tap hides the
  // label), so the label is hidden while measuring the worst case.
  let barClass = props.pinned ? 'bottom-bar pinned' : 'bottom-bar';
  if (props.measuring) barClass += ' measuring';
  return (
    <>
      <div class={barClass} ref={props.barRef}>
        <div class="inner">
          {showStrip && text ? (
            <div class="strip" aria-hidden="true">
              {text}
            </div>
          ) : null}
          {props.children}
        </div>
      </div>
    </>
  );
}

/** The message strip placed right below what the last tap changed (unpinned layout). */
export function InlineStrip({ message, stripRef }: { message: string; stripRef?: (el: HTMLDivElement | null) => void }) {
  if (!message) return null;
  return (
    <div class="strip-inline" aria-hidden="true" ref={stripRef}>
      {message}
    </div>
  );
}

/** The one polite live region on a screen. The visible strips repeat its text for sighted players. */
export function Announcer({ message }: { message: string }) {
  return (
    <div class="visually-hidden" aria-live="polite" role="status">
      {message}
    </div>
  );
}
