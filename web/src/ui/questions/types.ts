import type { EndlessAnswer } from '../../engine/types';

/** Props every question kind takes. */
export interface QuestionProps<Q> {
  question: Q;
  /** The option the player chose, or null while the question is open. */
  picked: string | null;
  onAnswer: (answer: EndlessAnswer) => void;
  /** "+20" that floats up from a right pick. */
  reward?: string | null;
  /** Keys work only while this is true (false behind a dialog or on the game over screen). */
  keysOn?: boolean;
  /** Id for the prompt, so the screen can move focus to it when a new question opens. */
  promptId?: string;
  /** Small label on the card's corner, like "Meaning Match". */
  tag?: string;
}
