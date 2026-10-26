// The small colored grid on the Word of the Day card once today's Jargle is done.
// It never shows letters, just like the shared result.

import type { JargleView } from '../../engine/api';

export function JargleMini({ view }: { view: JargleView }) {
  const won = view.status === 'won';
  const tries = view.rows.length;
  const summary = won ? 'Solved in ' + tries + ' of 6 tries.' : 'Not solved this time.';
  const rows = view.rows.map((row, r) => (
    <span key={r} class="jg-mini-row">
      {row.tiles.map((tile, c) => (
        <span key={c} class={'jg-mini-tile ' + tile} />
      ))}
    </span>
  ));
  return (
    <div class="jg-mini">
      <span class="jg-mini-grid" role="img" aria-label={summary}>
        {rows}
      </span>
      <p class="wotd-text">
        {won ? 'Got it in ' + tries + ' of 6. Nice!' : "Today's word was " + view.item.term + '.'}
      </p>
    </div>
  );
}
