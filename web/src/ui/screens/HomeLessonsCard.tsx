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
}

/**
 * The Lessons tile in the Play grid. Only wide screens show it (see desktop.css); on a phone
 * the Learn tab is one tap away in the tab bar, so Play stays short.
 */
export function HomeLessonsCard({ save, content, today }: HomeLessonsCardProps) {
  const lesson = engine.nextLesson(save, content, today);
  return (
    <section class="lessons-card" aria-labelledby="lessons-card-title">
      <div class="lessons-head">
        <span class="lessons-icon">
          <GameIcon name="learn" size={28} />
        </span>
        <div class="lessons-words">
          <h2 id="lessons-card-title" class="lessons-title">
            Lessons
          </h2>
          <p class="lessons-text">
            {lesson ? topicName(lesson.topic) + ': ' + lesson.title : 'All caught up. New lessons open soon.'}
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
