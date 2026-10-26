// Brand colors. Every yellow or amber shape needs a navy outline,
// because those colors are too light to stand out on cream by themselves.
export const NAVY = '#1F3A68';
export const CREAM = '#F6EFDC';
export const BEIGE = '#D8CBB0';
export const YELLOW = '#FFD23F';
export const AMBER = '#E08A1E';
export const WHITE = '#FFFFFF';

// Shared outline settings, set once on the <svg> so every shape inherits them.
export const OUTLINE = {
  stroke: NAVY,
  'stroke-width': 2,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
} as const;
