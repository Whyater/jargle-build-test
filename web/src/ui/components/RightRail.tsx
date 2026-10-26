import { useEffect, useState } from 'preact/hooks';
import { MascotSays } from './MascotSays';
import { ProgressBar } from './ProgressBar';
import { GameIcon } from './GameIcon';
import { Icon } from './Icons';
import { XpBadge } from './XpBadge';
import { LinkButton } from './Button';
import { railTips } from './railLogic';
import { useApp } from '../store';
import { engine } from '../engine';
import { hrefFor } from '../router';
import { levelFromXp } from '../../engine/api';
import type { RailDay } from '../../engine/api';
import { topicName } from '../screens/listLogic';
import { todayItemId } from '../screens/homeLogic';
import type { ContentBundle, SaveState } from '../../engine/types';

/** The right column on wide screens: a mascot tip, today's goals, level, the last 7 days and the next lesson. */
interface RightRailProps {
  /** The route name of the screen beside the rail. Parts that screen already shows are left out. */
  screen: string;
}

export function RightRail({ screen }: RightRailProps) {
  const app = useApp();
  if (!app.save || !app.content) return null;
  const save = app.save;
  const content = app.content;
  const today = app.today;
  const hv = engine.homeView(save, content, today);
  // Before launch there is no word or streak yet, so the rail would be all zeros.
  if (hv.phase === 'prelaunch') return null;

  return (
    <aside class="rail" aria-label="Your day">
      <RailTip
        save={save}
        content={content}
        today={today}
        finished={!!(hv.today && hv.today.finished)}
        calm={save.settings.reducedMotion || prefersReducedMotion()}
      />
      <RailGoals save={save} content={content} today={today} />
      {/* Me already has a big level card. */}
      {screen === 'me' ? null : <RailLevel xp={save.xp || 0} />}
      <RailWeek days={engine.lastSevenDays(save, today)} streak={hv.streak} />
      {/* Play has a Lessons tile and Learn has the path, so Next up only shows on the other screens. */}
      {screen === 'home' || screen === 'learn' ? null : <RailNext save={save} content={content} today={today} />}
    </aside>
  );
}

interface RailPartProps {
  save: SaveState;
  content: ContentBundle;
  today: string;
}

// How long each tip stays before the next one. Long enough to read twice.
const TIP_MS = 9000;

function prefersReducedMotion(): boolean {
  return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function RailTip({ content, today, finished, calm }: RailPartProps & { finished: boolean; calm: boolean }) {
  const itemId = todayItemId(content, today);
  const item = itemId ? content.items[itemId] || null : null;
  const tips = railTips(item, finished);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    // No automatic changes when the player asked for less motion; tapping the mascot still works.
    // calm is a dependency, so turning on Reduce motion in Settings stops the timer right away.
    if (calm) return;
    const timer = window.setInterval(() => setIndex((old) => old + 1), TIP_MS);
    return () => window.clearInterval(timer);
  }, [itemId, finished, calm]);

  return (
    <section class="rail-card rail-tip" aria-label="Tip">
      <MascotSays who={tips.who} pose="talk" size={72} text={tips.lines[index % tips.lines.length]} lines={tips.lines} />
    </section>
  );
}

function RailGoals({ save, content, today }: RailPartProps) {
  const goals = engine.todayGoals(save, today);
  const lesson = engine.nextLesson(save, content, today);
  const lessonHref = lesson ? hrefFor('lesson', lesson.id) : hrefFor('learn');
  return (
    <section class="rail-card" aria-labelledby="rail-goals-title">
      <div class="rail-head">
        <h2 id="rail-goals-title" class="rail-title">
          Today's goals
        </h2>
        <span class="rail-count">
          {goals.done} of {goals.total}
        </span>
      </div>
      <ProgressBar value={goals.done} max={goals.total} tone="correct" label={goals.done + ' of ' + goals.total + ' goals done'} />
      <ul class="rail-goals">
        <GoalRow done={goals.daily} label="Daily Jargle" href={hrefFor('home')} />
        <GoalRow done={goals.lesson} label="One lesson" href={lessonHref} />
        <GoalRow done={goals.endless} label="An Endless run" href={hrefFor('endless')} />
      </ul>
    </section>
  );
}

function GoalRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <li>
      <a class={done ? 'rail-goal done' : 'rail-goal'} href={href}>
        <span class="rail-check" aria-hidden="true">
          {done ? <Icon name="check" /> : null}
        </span>
        <span class="rail-goal-label">{label}</span>
        <span class="visually-hidden">{done ? ', done' : ', not done yet'}</span>
      </a>
    </li>
  );
}

function RailLevel({ xp }: { xp: number }) {
  const info = levelFromXp(xp);
  return (
    <section class="rail-card rail-level" aria-labelledby="rail-level-title">
      <XpBadge level={info.level} />
      <div class="rail-level-words">
        <h2 id="rail-level-title" class="rail-title">
          Level {info.level}
        </h2>
        <ProgressBar
          value={info.intoLevel}
          max={info.needed}
          tone="sunny"
          label={info.intoLevel + ' of ' + info.needed + ' XP to level ' + (info.level + 1)}
        />
        <p class="rail-note">
          {info.needed - info.intoLevel} XP to level {info.level + 1}
        </p>
      </div>
    </section>
  );
}

function RailWeek({ days, streak }: { days: RailDay[]; streak: number }) {
  return (
    <section class="rail-card" aria-labelledby="rail-week-title">
      <div class="rail-head">
        <h2 id="rail-week-title" class="rail-title">
          This week
        </h2>
        <span class={streak > 0 ? 'rail-streak on' : 'rail-streak'}>
          <GameIcon name="flame" size={18} />
          {streak} {streak === 1 ? 'day' : 'days'}
        </span>
      </div>
      <ol class="rail-week">
        {days.map((day) => {
          let className = 'rail-day';
          if (day.played) className += ' played';
          if (day.isToday) className += ' today';
          return (
            <li key={day.date} class={className}>
              <span class="rail-day-dot" aria-hidden="true">
                {day.played ? <GameIcon name="flame" size={16} /> : null}
              </span>
              <span class="rail-day-letter" aria-hidden="true">
                {day.letter}
              </span>
              <span class="visually-hidden">
                {(day.isToday ? 'Today' : day.date) + (day.played ? ': played' : ': not played')}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RailNext({ save, content, today }: RailPartProps) {
  const lesson = engine.nextLesson(save, content, today);
  return (
    <section class="rail-card rail-next" aria-labelledby="rail-next-title">
      <h2 id="rail-next-title" class="rail-title">
        Next up
      </h2>
      {lesson ? (
        <>
          <p class="rail-next-name">{lesson.title}</p>
          <p class="rail-note">{topicName(lesson.topic)}</p>
          <LinkButton variant="primary" block href={hrefFor('lesson', lesson.id)} gameIcon="play">
            Start lesson
          </LinkButton>
        </>
      ) : (
        <p class="rail-note">You finished every open lesson. New ones open soon.</p>
      )}
    </section>
  );
}
