import { useEffect, useState } from 'preact/hooks';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'grape' | 'correct' | 'sunny' | 'coral';
  icon?: GameIconName;
}

let nextId = 1;
let current: ToastMessage[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Shows a short message above the tab bar for about 2.4 seconds. */
export function showToast(text: string, tone: ToastMessage['tone'] = 'grape', icon?: GameIconName): void {
  const message = { id: nextId++, text, tone, icon };
  // Only the newest two stay, so a fast run of toasts never stacks up the screen.
  current = current.concat(message).slice(-2);
  notify();
  window.setTimeout(() => {
    current = current.filter((m) => m.id !== message.id);
    notify();
  }, 2400);
}

/** Put once in the app. Toasts are also read out politely by screen readers. */
export function ToastHost() {
  const [messages, setMessages] = useState<ToastMessage[]>(current);
  useEffect(() => {
    const update = () => setMessages(current);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} class={'toast toast-' + m.tone}>
          {m.icon ? <GameIcon name={m.icon} size={20} /> : null}
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  );
}

interface XpFloatProps {
  /** XP just earned. 0 shows nothing. */
  amount: number;
  /** Change to replay the float for a new answer. */
  burst: number;
}

/** "+10 XP" that floats up and fades, placed inside a position: relative parent. */
export function XpFloat({ amount, burst }: XpFloatProps) {
  if (!amount || !burst) return null;
  return (
    <span class="xp-float" key={burst} aria-hidden="true">
      +{amount} XP
    </span>
  );
}
