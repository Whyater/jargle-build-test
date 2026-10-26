import { useEffect, useState } from 'preact/hooks';
import { engine } from '../engine';
import { ProgressBar } from '../components/ProgressBar';
import type { LessonSession, SessionStep } from '../../engine/types';
import { LearnStep } from './LearnStep';
import { PairsStep } from './PairsStep';
import { BlankStep } from './BlankStep';
import { ChoiceStep } from './ChoiceStep';
import { BuildStep } from './BuildStep';
import { RecapStep } from './RecapStep';
import { StepFeedback } from './StepFeedback';
import './lesson.css';

interface SessionRunnerProps {
  start: LessonSession;
  /** Called once with the finished session. */
  onFinish: (session: LessonSession) => void;
}

interface Result {
  correct: boolean;
  why: string;
  comesBack: boolean;
}

/** The why line a step shows after an answer. Pairs pass their own. */
function whyFor(step: SessionStep): string {
  if (step.kind === 'blank' || step.kind === 'situation' || step.kind === 'meaning' || step.kind === 'build') {
    return step.why;
  }
  return '';
}

/** Runs one lesson session: a progress bar on top, one step at a time, feedback after each answer. */
export function SessionRunner({ start, onFinish }: SessionRunnerProps) {
  const [session, setSession] = useState(start);
  const [result, setResult] = useState<Result | null>(null);
  const step = session.steps[session.index];

  // Each new step starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session.index]);

  function goNext(current: LessonSession) {
    const next = engine.nextStep(current);
    setResult(null);
    if (engine.sessionDone(next)) onFinish(next);
    else setSession(next);
  }

  function answer(correct: boolean, why?: string, pairMisses?: string[]) {
    if (!step || result) return;
    const after = engine.answerStep(session, correct, pairMisses);
    // A wrong step comes back at the end when the engine added a copy of it.
    const comesBack = !correct && after.steps.length > session.steps.length;
    setSession(after);
    setResult({ correct, why: why || whyFor(step), comesBack });
  }

  if (!step) return null;
  // Done steps count toward the bar, and the answered step counts as soon as it is answered.
  const doneCount = session.index + (result ? 1 : 0);
  const key = step.id + ':' + session.index;

  let body = null;
  if (step.kind === 'learn') body = <LearnStep key={key} step={step} onDone={() => goNext(session)} />;
  else if (step.kind === 'recap') body = <RecapStep key={key} step={step} onDone={() => goNext(session)} />;
  else if (step.kind === 'pairs') body = <PairsStep key={key} step={step} onAnswer={answer} />;
  else if (step.kind === 'blank') body = <BlankStep key={key} step={step} onAnswer={answer} />;
  else if (step.kind === 'build') body = <BuildStep key={key} step={step} onAnswer={answer} />;
  else body = <ChoiceStep key={key} step={step} onAnswer={answer} />;

  return (
    <div class="ls-stage stack">
      <ProgressBar
        value={doneCount}
        max={session.steps.length}
        tone="mint"
        big
        label={'Step ' + Math.min(session.index + 1, session.steps.length) + ' of ' + session.steps.length}
      />
      <div class={'ls-step ls-step-' + step.kind} key={key}>
        {body}
      </div>
      {result ? (
        <StepFeedback correct={result.correct} why={result.why} comesBack={result.comesBack} onContinue={() => goNext(session)} />
      ) : null}
    </div>
  );
}
