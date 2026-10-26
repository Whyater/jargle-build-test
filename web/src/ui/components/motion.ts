/** True when the player (or their phone) asked for less motion. The store sets this class. */
export function reducedMotion(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('reduce-motion');
}
