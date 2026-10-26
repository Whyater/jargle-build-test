import { engine } from '../engine';
import { useApp } from '../store';
import { Screen } from '../components/Screen';
import { Announcer } from '../components/BottomBar';
import { ProgressBar } from '../components/ProgressBar';
import { Icon } from '../components/Icons';
import { Badge } from '../components/art';
import { shortDate } from '../actions';
import '../../styles/screens.css';

export function BadgesScreen() {
  const app = useApp();
  if (!app.save || !app.content) return null;
  const badges = engine.badgeViews(app.save, app.content, app.today);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  return (
    <Screen title="Badges">
      <div class="stack">
        <p class="badge-count">
          <strong>{earnedCount}</strong> of {badges.length} earned
        </p>
        <div class="badge-shelf">
          {badges.map((badge) => (
            <article class={badge.earned ? 'badge-tile is-earned' : 'badge-tile is-locked'} key={badge.id}>
              <div class="badge-tile-art">
                {/* Locked badges show as a dark silhouette with a lock, so you can see what is coming. */}
                <Badge id={badge.id} earned={Boolean(badge.earned)} size={72} />
                {badge.earned ? null : (
                  <span class="badge-tile-lock" aria-hidden="true">
                    <Icon name="lock" />
                  </span>
                )}
              </div>
              <h2>{badge.name}</h2>
              {badge.earned ? (
                <p class="badge-tile-line">
                  Earned <span class="badge-date">{shortDate(badge.earned)}</span>
                </p>
              ) : (
                <p class="badge-tile-line">{badge.condition}</p>
              )}
              {!badge.earned && badge.progress ? (
                <div class="badge-tile-progress">
                  <ProgressBar
                    value={badge.progress.have}
                    max={badge.progress.need}
                    tone="sunny"
                    label={badge.name + ': ' + badge.progress.have + ' of ' + badge.progress.need}
                  />
                  <span class="badge-tile-num">
                    {badge.progress.have} of {badge.progress.need}
                  </span>
                </div>
              ) : null}
              {badge.note ? <p class="badge-tile-note">{badge.note}</p> : null}
            </article>
          ))}
        </div>
      </div>
      <Announcer message="" />
    </Screen>
  );
}
