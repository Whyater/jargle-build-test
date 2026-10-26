import { useEffect, useState } from 'preact/hooks';
import { engine } from '../engine';
import { playSound } from '../../platform/audio';
import { commit, useApp } from '../store';
import { hrefFor, useRoute } from '../router';
import { Screen } from '../components/Screen';
import { Button, LinkButton } from '../components/Button';
import { Announcer } from '../components/BottomBar';
import { ProgressBar } from '../components/ProgressBar';
import { Confetti } from '../components/Confetti';
import { XpFloat, showToast } from '../components/Toast';
import { Pill } from '../components/Pill';
import { Mascot } from '../components/Mascot';
import { MascotSays } from '../components/MascotSays';
import { feedback } from '../components/feedback';
import { QuizOption } from './QuizOption';
import { levelReached, markSeenLevel, readXp } from './homeLogic';
import { NewBadge, Sources } from './RoundAfter';
import type { BadgeId } from '../../engine/types';
import '../../styles/screens.css';

export function LessonScreen({ lessonId }: { lessonId?: string }) {
  const route = useRoute();
  const id = lessonId || route.param || '';
  const app = useApp();
  const [card, setCard] = useState(() => (app.save && app.save.lessons[id] ? app.save.lessons[id].card : 0));
  const [check, setCheck] = useState(() =>
    app.save && app.save.lessons[id] ? app.save.lessons[id].answers.length : 0,
  );
  // The screen title stays the same between cards, so start each new card or question at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [card, check]);
  const [newBadges, setNewBadges] = useState<{ id: BadgeId; name: string }[]>([]);
  // Set only when the lesson is finished on this visit, so the confetti plays once.
  const [justDone, setJustDone] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [done, setDone] = useState(
    () => !!(app.save && app.save.lessons[id] && app.save.lessons[id].finished_on),
  );
  if (!app.save || !app.content) return null;

  const lesson = app.content.lessons.filter((item) => item.id === id)[0];
  if (!lesson) {
    return (
      <Screen title="Lesson">
        <p>Lesson not found.</p>
        <LinkButton href={hrefFor('learn')}>Back to Learn</LinkButton>
      </Screen>
    );
  }

  const finish = () => {
    const result = engine.finishLesson(app.save!, app.content!, id, app.today);
    commit(result.state);
    const views = engine.badgeViews(result.state, app.content!, app.today);
    if (result.newBadges.length) playSound('stamp');
    else feedback('levelUp');
    // A lesson that crosses into a new level says so here, and Play does not cheer it again later.
    const xpAfter = readXp(result.state);
    const newLevel = levelReached(xpAfter - result.xpGained, xpAfter);
    if (newLevel) {
      showToast('Level ' + newLevel + '!', 'sunny', 'star');
      markSeenLevel(newLevel);
    }
    // XP comes only with the first finish of a lesson (0 after that).
    setXpGained(result.xpGained);
    setJustDone(true);
    setNewBadges(
      result.newBadges.map((id) => {
        const view = views.filter((badge) => badge.id === id)[0];
        return { id, name: view ? view.name : String(id) };
      }),
    );
    setDone(true);
  };

  const totalSteps = lesson.cards.length + lesson.checks.length;

  if (done) {
    const earned = newBadges;
    return (
      <Screen title={lesson.title} runhead={'Lesson ' + lesson.number}>
        <div class="lesson stack">
          <div class="win-card is-solved">
            <Confetti burst={justDone ? 1 : 0} />
            <div class="win-mascots">
              <Mascot who="floyd" size={76} pose="happy" />
              <Mascot who="bud" size={76} pose="happy" />
            </div>
            <p class="win-shout">Lesson done.</p>
            {xpGained ? (
              <div class="win-stats">
                <span class="win-xp">
                  <Pill tone="sunny" icon="star">
                    +{xpGained} XP
                  </Pill>
                  <XpFloat amount={xpGained} burst={justDone ? 1 : 0} />
                </span>
              </div>
            ) : null}
          </div>
          <div class="lesson-card takeaway">
            <p class="lesson-card-label">Remember this</p>
            <p>{lesson.takeaway}</p>
          </div>
          {earned.map((badge) => (
            <NewBadge key={badge.id} id={badge.id} name={badge.name} />
          ))}
          <LinkButton primary big block href={hrefFor('learn')}>
            Back to Learn
          </LinkButton>
          <LinkButton block href={hrefFor('endless')}>
            Play Endless
          </LinkButton>
          <Sources sources={lesson.sources} />
          <Announcer message="Lesson done." />
        </div>
      </Screen>
    );
  }

  if (card < lesson.cards.length) {
    const learnCard = lesson.cards[card];
    const nextCard = card + 1;
    return (
      <Screen
        title={lesson.title}
        runhead={'Lesson ' + lesson.number}
        runheadRight={'Card ' + (card + 1) + ' of ' + lesson.cards.length}
      >
        <div class="lesson stack">
          <ProgressBar value={card + 1} max={totalSteps} tone="mint" big label={'Step ' + (card + 1) + ' of ' + totalSteps} />
          <div class="lesson-card" key={card}>
            <p>{learnCard.text}</p>
          </div>
          <MascotSays key={'says-' + card} who={learnCard.mascot} text={learnCard.line} pose="talk" size={72} />
          <Button
            primary
            big
            block
            onClick={() => {
              commit(engine.saveLessonProgress(app.save!, id, { card: nextCard }));
              setCard(nextCard);
            }}
          >
            {nextCard === lesson.cards.length ? 'Start the questions' : 'Next'}
          </Button>
          <Sources sources={lesson.sources} />
          <Announcer message="" />
        </div>
      </Screen>
    );
  }

  const checkIndex = check < lesson.checks.length ? check : lesson.checks.length - 1;
  const checkData = lesson.checks[checkIndex];
  const options = engine.lessonOptions(lesson, checkIndex).map((term) => ({
    term,
    meaning: checkData.why,
  }));
  const step = lesson.cards.length + checkIndex + 1;

  return (
    <Screen
      title={lesson.title}
      runhead={'Lesson ' + lesson.number}
      runheadRight={'Question ' + (checkIndex + 1) + ' of ' + lesson.checks.length}
    >
      <div class="lesson stack">
        <ProgressBar value={step} max={totalSteps} tone="mint" big label={'Step ' + step + ' of ' + totalSteps} />
        <p class="quiz-prompt">{checkData.prompt}</p>
        <QuizOption
          key={checkIndex}
          options={options}
          answer={checkData.answer}
          last={checkIndex === lesson.checks.length - 1}
          onAnswer={(_correct, term) => {
            commit(engine.saveLessonProgress(app.save!, id, { answer: term }));
          }}
          onNext={() => {
            if (checkIndex + 1 < lesson.checks.length) setCheck(checkIndex + 1);
            else finish();
          }}
        />
        <Sources sources={lesson.sources} />
      </div>
    </Screen>
  );
}
