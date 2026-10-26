import { GameIcon } from '../components/GameIcon';
import { LinkButton } from '../components/Button';
import { engine } from '../engine';
import { hrefFor } from '../router';
import { topicName } from './listLogic';
import type { ContentBundle, SaveState } from '../../engine/types';

interface HomeLessonsCardProps {
  save: SaveState;
  content: ContentBundle;
  today: string;
  /** Also show it on phones (Play passes true once today's word is done). */
  onPhone?: boolean;
}

/** True once every lesson is done, so the card never promises new lessons that are not coming. */
export function allLessonsDone(save: SaveState, content: ContentBundle, today: string): boolean {
  const statuses = engine.lessonStatuses(save, content, today);
  for (const status of statuses) {
    if (!status.done) return false;
  }
  return statuses.length > 0;
}

/**
 * The Lessons tile in the Play grid. Wide screens always show it (see desktop.css). On a phone it
 * shows once today's word is done, so Play stays short until then.
 */
export function HomeLessonsCard({ save, content, today, onPhone }: HomeLessonsCardProps) {
  const lesson = engine.nextLesson(save, content, today);
  let note = 'All caught up. New lessons open soon.';
  if (!lesson && allLessonsDone(save, content, today)) note = 'You finished every lesson. Each daily word has its own mini lesson too.';
  return (
    <section class={onPhone ? 'lessons-card on-phone' : 'lessons-card'} aria-labelledby="lessons-card-title">
      <div class="lessons-head">
        <span class="lessons-icon">
          <GameIcon name="learn" size={28} />
        </span>
        <div class="lessons-words">
          <h2 id="lessons-card-title" class="lessons-title">
            Lessons
          </h2>
          <p class="lessons-text">
            {lesson ? topicName(lesson.topic) + ': ' + lesson.title : note}
          </p>
        </div>
      </div>
      <div class="lessons-foot">
        <LinkButton variant="mint" href={lesson ? hrefFor('lesson', lesson.id) : hrefFor('learn')} gameIcon="play">
          {lesson ? 'Start lesson' : 'See the path'}
        </LinkButton>
      </div>
    </section>
  );
}
