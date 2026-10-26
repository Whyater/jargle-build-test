import { hrefFor } from '../router';

// The Word of the Day mini lesson rides on the lesson route as "word:<item id>",
// so it needs no route of its own. Lesson ids never start with "word:".
export const WORD_PREFIX = 'word:';

/** Link to the 4 step mini lesson for one word. */
export function wordLessonHref(itemId: string): string {
  return hrefFor('lesson', WORD_PREFIX + itemId);
}

/** Opens the mini lesson for one word (used by the Daily Jargle result screen). */
export function startWordSession(itemId: string): void {
  window.location.hash = wordLessonHref(itemId);
}

/** The item id inside a "word:<id>" route param, or null for a normal lesson id. */
export function wordIdFromParam(param: string): string | null {
  if (param.indexOf(WORD_PREFIX) !== 0) return null;
  const id = param.slice(WORD_PREFIX.length);
  return id ? id : null;
}
