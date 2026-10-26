import { useState } from 'preact/hooks';
import { engine } from '../engine';
import { commit, useApp } from '../store';
import { hrefFor, useRoute } from '../router';
import { Screen } from '../components/Screen';
import { LinkButton } from '../components/Button';
import { showToast } from '../components/Toast';
import { levelReached, markSeenLevel, readXp } from './homeLogic';
import { NewBadge, Sources } from './RoundAfter';
import { SessionRunner } from '../lesson/SessionRunner';
import { SessionDone } from '../lesson/SessionDone';
import { playLessonSounds } from '../lesson/sound';

export { playLessonSounds };
import { wordIdFromParam } from '../lesson/start';
import type { BadgeId, LessonSession, Source } from '../../engine/types';
import '../../styles/screens.css';

interface Finished {
  stars: number;
  xpGained: number;
  missedCount: number;
  badges: { id: BadgeId; name: string }[];
}

/**
 * A lesson (#/lesson/<id>) or a word's mini lesson (#/lesson/word:<item id>).
 * Both run as a short session of mixed steps, then a celebration.
 */
export function LessonScreen({ lessonId }: { lessonId?: string }) {
  const route = useRoute();
  const param = lessonId || route.param || '';
  const app = useApp();
  const [finished, setFinished] = useState<Finished | null>(null);
  // Bumped by "Practice again" so a fresh session starts.
  const [round, setRound] = useState(0);
  if (!app.save || !app.content) return null;
  const content = app.content;

  const wordId = wordIdFromParam(param);
  const lesson = wordId ? null : content.lessons.filter((item) => item.id === param)[0];
  const item = wordId ? content.items[wordId] : null;
  // The same lesson on the same day gives the same steps; a replay shuffles again.
  const seed = param + ':' + app.today + ':' + round;
  let start: LessonSession | null = null;
  if (lesson) start = engine.buildLessonSession(lesson, content, seed);
  else if (wordId) start = engine.buildWordSession(wordId, content, seed);

  const title = lesson ? lesson.title : item ? item.term : 'Lesson';
  const backHref = lesson ? hrefFor('learn') : hrefFor('home');
  if (!start) {
    return (
      <Screen title={title}>
        <p>{wordId ? 'This word has no mini lesson yet.' : 'Lesson not found.'}</p>
        <LinkButton href={backHref}>{lesson ? 'Back to Learn' : 'Back to Play'}</LinkButton>
      </Screen>
    );
  }
  const sources: Source[] = lesson ? lesson.sources : item ? item.sources : [];

  const finish = (session: LessonSession) => {
    const result = engine.finishLessonSession(app.save!, content, session, app.today);
    commit(result.state);
    const views = engine.badgeViews(result.state, content, app.today);
    playLessonSounds(result.newBadges.length);
    // A lesson that crosses into a new level says so here, and Play does not cheer it again later.
    const xpAfter = readXp(result.state);
    const newLevel = levelReached(xpAfter - result.xpGained, xpAfter);
    if (newLevel) {
      showToast('Level ' + newLevel + '!', 'sunny', 'star');
      markSeenLevel(newLevel);
    }
    setFinished({
      stars: result.stars,
      xpGained: result.xpGained,
      missedCount: session.missedItems.length,
      badges: result.newBadges.map((id) => {
        const view = views.filter((badge) => badge.id === id)[0];
        return { id, name: view ? view.name : String(id) };
      }),
    });
  };

  if (finished) {
    return (
      <Screen title={title} focusKey="done">
        <SessionDone
          title={title}
          stars={finished.stars}
          xpGained={finished.xpGained}
          missedCount={finished.missedCount}
          fresh
        >
          {finished.badges.map((badge) => (
            <NewBadge key={badge.id} id={badge.id} name={badge.name} />
          ))}
          <div class="ls-done-actions stack">
            <LinkButton primary big block href={backHref}>
              {lesson ? 'Back to Learn' : 'Back to Play'}
            </LinkButton>
            <LinkButton block href={hrefFor('endless')}>
              Play Endless
            </LinkButton>
            <button
              type="button"
              class="ls-again-link"
              onClick={() => {
                setFinished(null);
                setRound(round + 1);
              }}
            >
              Practice this again
            </button>
          </div>
          <Sources sources={sources} />
        </SessionDone>
      </Screen>
    );
  }

  return (
    <Screen title={title} runhead={lesson ? 'Lesson ' + lesson.number : 'Word of the Day'}>
      <SessionRunner key={seed} start={start} onFinish={finish} />
    </Screen>
  );
}
