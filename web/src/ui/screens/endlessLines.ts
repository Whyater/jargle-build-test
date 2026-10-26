// What Floyd and Bud say during Endless. Floyd is an old floppy disk who is proud
// of his 1.44 MB. Bud is a phone who gets excited about everything.
// Keep lines short so a bubble never needs more than two lines on a small phone.

import type { Speaker } from '../../engine/types';

export type LineMood = 'hello' | 'right' | 'combo' | 'wrong' | 'over' | 'best' | 'levelUp';

export const ENDLESS_LINES: Record<Speaker, Record<LineMood, string[]>> = {
  floyd: {
    hello: ['Ready? I saved my best questions for you.', 'Back in my day, games had 3 lives too!'],
    right: [
      'Nailed it!',
      'Yes! Saving that to memory.',
      'Correct! You make it look easy.',
      "Spot on. I'm so proud.",
      'That one was worth all 1.44 MB.',
    ],
    combo: ["You're on fire! Careful, I melt.", 'Combo! My shutter is spinning.', 'Look at you go!'],
    wrong: [
      'Oops! Happens to the best disks.',
      "Close one. Here's the scoop.",
      'No worries. I mix them up too.',
      'Not quite, but now you know!',
    ],
    over: ["What a run! Let's go again.", 'Out of hearts, not out of brains.'],
    best: ["A new best! I'm writing that down."],
    levelUp: ['Look at you go! I need a bigger disk.'],
  },
  bud: {
    hello: ["Hi! Let's see how far you can go.", "Battery full. Brain full. Let's play!"],
    right: [
      "Woohoo! That's right!",
      'Ding! Correct!',
      'Yes yes yes!',
      'Big brain moment.',
      "Right! I'm buzzing.",
    ],
    combo: ['Combo! My screen is glowing.', 'Streak alert! Keep it going.', "You're unstoppable!"],
    wrong: [
      'Oops! Quick tip coming up.',
      "So close! Here's the answer.",
      'No problem, tricky one.',
      "Hey, now you know it!",
    ],
    over: ['Great game! One more?', 'That was fun. Play again?'],
    best: ['New best score! Screenshot worthy!'],
    levelUp: ["Whoa, you grew! I'm so proud."],
  },
};

/** Picks one line. `turn` moves through the list so the same line does not repeat right away. */
export function pickLine(who: Speaker, mood: LineMood, turn: number): string {
  const list = ENDLESS_LINES[who][mood];
  const index = Math.abs(turn) % list.length;
  return list[index];
}
