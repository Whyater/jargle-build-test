// The Endless screen calls the engine through this one object, so tests and the
// screen preview can swap in a stand-in while the real engine is being finished.

import * as api from '../../engine/api';

export const endlessApi = {
  startEndless: api.startEndless,
  answerEndless: api.answerEndless,
  nextEndlessQuestion: api.nextEndlessQuestion,
  finishEndless: api.finishEndless,
  comboMultiplier: api.comboMultiplier,
  levelFromXp: api.levelFromXp,
  isCorrect: api.isCorrect,
  ENDLESS_HEARTS: api.ENDLESS_HEARTS,
};

export type EndlessApi = typeof endlessApi;

/** Swaps the functions the screen uses. Pass null to go back to the real engine. */
let current: EndlessApi = endlessApi;
export function getEndlessApi(): EndlessApi {
  return current;
}
export function setEndlessApi(next: EndlessApi | null): void {
  current = next || endlessApi;
}
