import type { ContentBundle, SaveState, Speaker } from './types';

export function pickMissLine(
  state: SaveState,
  content: ContentBundle,
  itemId: string,
  nextClueEnabled: boolean,
): { text: string; speaker: Speaker } | null {
  const speaker: Speaker = itemId === 'floppy-disk' ? 'bud' : 'floyd';
  const lines = speaker === 'bud'
    ? content.missLines.either
    : content.missLines.either.concat(content.missLines.floyd);
  if (lines.length === 0) return null;

  if (!state.missLineQueue) {
    state.missLineQueue = { floyd: [], bud: [] };
  }
  if (!state.missLineIndex) {
    state.missLineIndex = { floyd: 0, bud: 0 };
  }
  if (!state.missLineQueue[speaker]) state.missLineQueue[speaker] = [];
  const queue = state.missLineQueue[speaker];
  // A content update can shorten the lists, so drop indexes that no longer exist.
  for (let i = queue.length - 1; i >= 0; i--) {
    const index = queue[i];
    if (typeof index !== 'number' || index % 1 !== 0 || index < 0 || index >= lines.length) {
      queue.splice(i, 1);
    }
  }
  if (queue.length === 0) {
    for (let i = 0; i < lines.length; i++) queue.push(i);
  }

  const firstIndex = queue[0];
  const firstLine = lines[firstIndex];
  let pickedPosition = 0;
  if (firstLine.needs_clue && !nextClueEnabled) {
    pickedPosition = -1;
    for (let i = 1; i < queue.length; i++) {
      if (!lines[queue[i]].needs_clue) {
        pickedPosition = i;
        break;
      }
    }
    if (pickedPosition === -1) return null;
  }
  const pickedIndex = queue[pickedPosition];
  const pickedLine = lines[pickedIndex];
  queue.splice(pickedPosition, 1);
  state.missLineIndex[speaker]++;
  return { text: pickedLine.text, speaker: speaker };
}
