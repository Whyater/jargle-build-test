import { useEffect } from 'preact/hooks';
import { engine } from '../engine';
import { useApp } from '../store';
import { hrefFor } from '../router';
import { Screen } from '../components/Screen';
import { Announcer } from '../components/BottomBar';
import { Card } from '../components/Card';
import { GameIcon } from '../components/GameIcon';
import { Icon } from '../components/Icons';
import { Mascot } from '../components/Mascot';
import { showToast } from '../components/Toast';
import { buzz } from '../components/feedback';
import { TOPIC_ORDER } from '../../engine/types';
import type { LessonStatus } from '../../engine/api';
import { currentLessonIndex, pathOffset, topicName } from './listLogic';
import '../../styles/screens.css';
import '../lesson/learn-map.css';

export function LearnScreen() {
  const app = useApp();
  // If the next lesson is below the fold, bring it up so the main thing to tap is on screen.
  // It waits a moment because the screen frame scrolls to the top when it opens.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const node = document.querySelector('.path-node.is-current');
      if (!node) return;
      const box = node.getBoundingClientRect();
      const tabBar = document.querySelector('.tabbar');
      const bottom = tabBar ? tabBar.getBoundingClientRect().top : window.innerHeight;
      if (box.bottom + 48 > bottom) window.scrollBy(0, box.bottom + 48 - bottom);
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);
  if (!app.save || !app.content) return null;
  const statuses = engine.lessonStatuses(app.save, app.content, app.today);
  const home = engine.homeView(app.save, app.content, app.today);

  // One path in topic order. Each topic starts with a small banner.
  const ordered: LessonStatus[] = [];
  for (const topic of TOPIC_ORDER) {
    for (const status of statuses) {
      if (status.lesson.topic === topic) ordered.push(status);
    }
  }
  const current = currentLessonIndex(ordered);
  const doneCount = ordered.filter((s) => s.done).length;

  const rows = [];
  let lastTopic = '';
  for (let i = 0; i < ordered.length; i++) {
    const status = ordered[i];
    if (status.lesson.topic !== lastTopic) {
      lastTopic = status.lesson.topic;
      rows.push(
        <li class="path-topic" key={'topic-' + lastTopic}>
          <span>{topicName(lastTopic)}</span>
        </li>,
      );
    }
    const record = app.save.lessons[status.lesson.id];
    const stars = status.done && record && record.stars ? record.stars : 0;
    rows.push(<PathStop key={status.lesson.id} status={status} index={i} current={i === current} stars={stars} />);
  }

  return (
    <Screen title="Learn">
      <div class="learn stack-lg">
        <div class="learn-quick">
          <Card href={hrefFor('review')} tone="coral" class="quick-card" label={home.reviewLink}>
            <span class="quick-icon" aria-hidden="true">
              <GameIcon name="bolt" size={24} />
              {home.reviewDue > 0 ? <span class="quick-count">{home.reviewDue}</span> : null}
            </span>
            <span class="quick-title">Review</span>
          </Card>
          <Card href={hrefFor('practice')} tone="grape" class="quick-card">
            <span class="quick-icon" aria-hidden="true">
              <GameIcon name="cards" size={24} />
            </span>
            <span class="quick-title">Practice</span>
          </Card>
          <Card href={hrefFor('oldtech')} tone="sunny" class="quick-card">
            <span class="quick-icon" aria-hidden="true">
              <GameIcon name="clock" size={24} />
            </span>
            <span class="quick-title">Old Tech</span>
          </Card>
        </div>
        <section aria-labelledby="path-title">
          <div class="path-head">
            <h2 id="path-title">Lessons</h2>
            <span class="path-count">
              {doneCount} of {ordered.length} done
            </span>
          </div>
          <ol class="path">{rows}</ol>
        </section>
      </div>
      <Announcer message="" />
    </Screen>
  );
}

/** One round stop on the lesson path: done, up next, open, or locked. */
function PathStop({ status, index, current, stars }: { status: LessonStatus; index: number; current: boolean; stars: number }) {
  const lesson = status.lesson;
  const offset = pathOffset(index);
  const name = lesson.number + '. ' + lesson.title;
  let kind = 'is-open';
  if (status.done) kind = 'is-done';
  if (current) kind = 'is-current';
  if (!status.open) kind = 'is-locked';

  let icon = <span class="path-num">{lesson.number}</span>;
  if (status.done) icon = <Icon name="check" />;
  if (current) icon = <GameIcon name="play" size={30} />;
  if (!status.open) icon = <Icon name="lock" />;

  // The stop moves sideways with transform, and its label gets narrower by the same amount,
  // so the path winds without anything poking past the screen edge.
  const shift = Math.abs(offset) * 2;
  const stopStyle = { transform: 'translateX(' + offset + 'px)', maxWidth: 'calc(100% - ' + shift + 'px)' };

  let label = name;
  if (status.done) label += '. Done';
  if (stars) label += ', ' + stars + ' of 3 stars';
  if (current) label += '. Up next';

  return (
    <li class={'path-row ' + kind}>
      <div class="path-stop" style={stopStyle}>
        {/* The chip sits above the node and points down at it, like a pin on a map. */}
        {current ? (
          <span class="path-next" aria-hidden="true">
            Start here
          </span>
        ) : null}
        {status.open ? (
          <a class={'path-node ' + kind} href={hrefFor('lesson', lesson.id)} aria-label={label} onClick={() => buzz()}>
            {icon}
          </a>
        ) : (
          <button
            type="button"
            class={'path-node ' + kind}
            aria-disabled="true"
            aria-label={name + '. Locked. ' + (status.lockLine || '')}
            onClick={() => {
              buzz();
              showToast(status.lockLine || 'This lesson opens soon.', 'grape');
            }}
          >
            {icon}
          </button>
        )}
        {/* Done lessons show their best stars, like a level on a game map. */}
        {status.done && stars ? <PathStars stars={stars} /> : null}
        <span class="path-name" aria-hidden="true">
          {name}
        </span>
      </div>
      {current ? (
        <div class={offset < 0 ? 'path-buddies on-right' : 'path-buddies'}>
          <Mascot who="floyd" size={72} pose="wave" />
          <Mascot who="bud" size={72} pose="happy" />
        </div>
      ) : null}
    </li>
  );
}

/** Three small stars under a done lesson. Lessons finished before stars existed show no stars. */
function PathStars({ stars }: { stars: number }) {
  const icons = [];
  for (let i = 1; i <= 3; i++) {
    icons.push(
      <span key={i} class={i <= stars ? 'path-star is-on' : 'path-star'}>
        <GameIcon name="star" size={20} />
      </span>,
    );
  }
  return (
    <span class="path-stars" aria-hidden="true">
      {icons}
    </span>
  );
}
