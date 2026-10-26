import { Confetti } from '../components/Confetti';
import { GameIcon } from '../components/GameIcon';
import { Mascot } from '../components/Mascot';
import { Pill } from '../components/Pill';
import { XpFloat } from '../components/Toast';
import { Announcer } from '../components/BottomBar';
import type { ComponentChildren } from 'preact';
import '../screens/round.css';
import './lesson.css';

interface SessionDoneProps {
  title: string;
  stars: number;
  xpGained: number;
  /** Words that go to Review because they were missed. */
  missedCount: number;
  /** Plays the confetti and the XP float once, right after finishing. */
  fresh: boolean;
  children?: ComponentChildren;
}

function starLine(stars: number): string {
  if (stars >= 3) return 'Perfect. Not one miss!';
  if (stars === 2) return 'So close to perfect.';
  return 'Done! Practice makes it stick.';
}

/** The "lesson complete" celebration: both mascots cheer, stars pop in, XP floats up. */
export function SessionDone({ title, stars, xpGained, missedCount, fresh, children }: SessionDoneProps) {
  const starIcons = [];
  for (let i = 1; i <= 3; i++) {
    starIcons.push(
      <span key={i} class={'ls-star' + (i <= stars ? ' is-on' : '')} style={{ animationDelay: 120 + i * 140 + 'ms' }}>
        <GameIcon name="star" size={40} />
      </span>,
    );
  }
  return (
    <div class="ls-done stack">
      <div class="win-card is-solved ls-done-card">
        <Confetti burst={fresh ? 1 : 0} />
        <div class="win-mascots">
          <Mascot who="floyd" size={88} pose="happy" />
          <Mascot who="bud" size={88} pose="happy" />
        </div>
        <p class="win-shout">Lesson complete!</p>
        <p class="ls-done-title">{title}</p>
        <div class="ls-stars" role="img" aria-label={stars + ' of 3 stars'}>
          {starIcons}
        </div>
        <p class="ls-done-line">{starLine(stars)}</p>
        {xpGained ? (
          <div class="win-stats">
            <span class="win-xp">
              <Pill tone="sunny" icon="star">
                +{xpGained} XP
              </Pill>
              <XpFloat amount={xpGained} burst={fresh ? 1 : 0} />
            </span>
          </div>
        ) : null}
        {missedCount > 0 ? (
          <p class="ls-done-review">
            {missedCount === 1 ? '1 word goes to Review so it sticks.' : missedCount + ' words go to Review so they stick.'}
          </p>
        ) : null}
      </div>
      {children}
      <Announcer message={'Lesson complete. ' + stars + ' of 3 stars.'} />
    </div>
  );
}
