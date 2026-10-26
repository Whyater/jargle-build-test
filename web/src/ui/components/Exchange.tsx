import type { ExchangeLine } from '../../engine/types';
import { Bud, Floyd } from './art';
import type { Mood } from './art';

interface ExchangeProps {
  lines: ExchangeLine[];
  budMood?: Mood;
}

/** Floyd and Bud talking, one line each, with a small portrait beside each line. */
export function Exchange({ lines, budMood }: ExchangeProps) {
  return (
    <ul class="exchange">
      {lines.map((line, i) => (
        <li key={i}>
          <span class="who">
            {line.speaker === 'floyd' ? <Floyd size={68} /> : <Bud size={68} mood={budMood || 'idle'} />}
          </span>
          <p class="said">
            <span class="name">{line.speaker === 'floyd' ? 'Floyd' : 'Bud'}</span>
            {line.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
