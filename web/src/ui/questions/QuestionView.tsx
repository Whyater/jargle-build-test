import type { Question } from '../../engine/types';
import { ClueClimb } from './ClueClimb';
import { MeaningMatch } from './MeaningMatch';
import { NameIt } from './NameIt';
import { OldNew } from './OldNew';
import { TrueFalse } from './TrueFalse';
import type { QuestionProps } from './types';

interface QuestionViewProps extends QuestionProps<Question> {
  multiplier?: number;
}

/** Shows any question with the right component for its kind. */
export function QuestionView(props: QuestionViewProps) {
  const q = props.question;
  // The key makes a fresh component for each question, so no state leaks from the last one.
  if (q.kind === 'meaning') return <MeaningMatch key={q.id} {...props} question={q} />;
  if (q.kind === 'name') return <NameIt key={q.id} {...props} question={q} />;
  if (q.kind === 'truefalse') return <TrueFalse key={q.id} {...props} question={q} />;
  if (q.kind === 'oldnew') return <OldNew key={q.id} {...props} question={q} />;
  return <ClueClimb key={q.id} {...props} question={q} />;
}

/** The short name of each kind, for headers and screen readers. */
export const KIND_NAMES: Record<Question['kind'], string> = {
  meaning: 'Meaning Match',
  name: 'Name It',
  truefalse: 'True or False',
  oldnew: 'Old or New',
  clue: 'Clue Climb',
};
