import type { Speaker, TermItem } from '../../engine/types';
import { topicName } from '../screens/listLogic';

export interface RailTips {
  who: Speaker;
  lines: string[];
}

/**
 * Short tips the rail mascot rotates through. Before today's word is played they only name the
 * topic, so nothing gives the answer away. After it is played they talk about the word itself.
 */
export function railTips(item: TermItem | null, finished: boolean): RailTips {
  if (!item) {
    return {
      who: 'floyd',
      lines: ['New words are on the way. Endless is open while you wait!', 'A lesson a day helps the words stick.'],
    };
  }
  // Floyd talks about old tech, Bud about everything else.
  const who: Speaker = item.old_tech ? 'floyd' : 'bud';
  if (!finished) {
    return {
      who: who,
      lines: [
        "Today's word is from " + topicName(item.topic) + '. Ready?',
        'Read each clue slowly. Small words can be big hints.',
        'Play today to keep your streak going!',
      ],
    };
  }
  return {
    who: who,
    lines: [
      'Today\'s word was "' + item.term + '". ' + item.meaning,
      'Try saying "' + item.term + '" out loud today. It helps you remember.',
      'Want more? A lesson or an Endless run fills your goals.',
    ],
  };
}
