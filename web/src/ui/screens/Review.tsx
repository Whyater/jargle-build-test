import { useState } from 'preact/hooks';
import { engine } from '../engine';
import { commit, useApp } from '../store';
import { hrefFor } from '../router';
import { Screen } from '../components/Screen';
import { Announcer } from '../components/BottomBar';
import { LinkButton } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { Confetti } from '../components/Confetti';
import { Mascot } from '../components/Mascot';
import { MascotSays } from '../components/MascotSays';
import { QuizOption } from './QuizOption';
import '../../styles/screens.css';
import { reviewDoneLine } from '../../engine/api';
import type { ContentBundle, LocalDate, SaveState } from '../../engine/types';

export function ReviewScreen() {
  const app = useApp();
  if (!app.save || !app.content) return null;
  return <ReviewReady save={app.save} content={app.content} today={app.today} />;
}

function ReviewReady({
  save,
  content,
  today,
}: {
  save: SaveState;
  content: ContentBundle;
  today: LocalDate;
}) {
  const [questions, setQuestions] = useState(() => engine.reviewSession(save, content, today));
  const [index, setIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [retried, setRetried] = useState<string[]>([]);

  if (!questions.length)
    return (
      <Screen title="Review">
        <div class="review stack">
          <MascotSays who="bud" pose="happy" text="Review: nothing due today." />
          <p class="soft-note">Daily words come back here 1, 3 and 7 days after you play them, so they stick.</p>
          <LinkButton primary big block href={hrefFor('learn')}>
            Back to Learn
          </LinkButton>
        </div>
        <Announcer message="" />
      </Screen>
    );
  if (index >= questions.length)
    return (
      <Screen title="Review">
        <div class="review stack">
          <div class="win-card is-solved">
            <Confetti burst={1} />
            <div class="win-mascots">
              <Mascot who="floyd" size={76} pose="happy" />
              <Mascot who="bud" size={76} pose="happy" />
            </div>
            <p class="win-shout">All done!</p>
            <p class="result-line">{reviewDoneLine(answeredCount)}</p>
          </div>
          <LinkButton primary big block href={hrefFor('endless')}>
            Play Endless
          </LinkButton>
          <LinkButton block href={hrefFor('learn')}>
            Back to Learn
          </LinkButton>
        </div>
        <Announcer message="" />
      </Screen>
    );

  const question = questions[index];
  function answer(correct: boolean) {
    commit(engine.answerReview(save, question.itemId, correct, today));
    if (retried.indexOf(question.itemId) < 0) setAnsweredCount((count) => count + 1);
    if (!correct && retried.indexOf(question.itemId) < 0) {
      setRetried((current) => current.concat(question.itemId));
      setQuestions((current) => current.concat(question));
    }
  }

  const last = index === questions.length - 1 && retried.indexOf(question.itemId) >= 0;
  return (
    <Screen title="Review" runhead={'Question ' + (index + 1) + ' of ' + questions.length}>
      <div class="review stack">
      <ProgressBar value={index + 1} max={questions.length} tone="sunny" big label={'Question ' + (index + 1) + ' of ' + questions.length} />
      <QuizPrompt prompt={question.prompt} />
      <QuizOption
        key={question.itemId + ':' + index}
        options={question.options}
        answer={question.answer}
        onAnswer={answer}
        last={last}
        onNext={() => setIndex((value) => value + 1)}
      />
      </div>
    </Screen>
  );
}

/** "Which one means: {meaning}?" shown as a small label over the meaning, so the meaning is easy to read. */
function QuizPrompt({ prompt }: { prompt: string }) {
  const lead = 'Which one means: ';
  if (prompt.indexOf(lead) !== 0) return <p class="quiz-prompt">{prompt}</p>;
  return (
    <p class="quiz-prompt split">
      <span class="quiz-lead">Which one means:</span> <span class="quiz-meaning">{prompt.slice(lead.length)}</span>
    </p>
  );
}
