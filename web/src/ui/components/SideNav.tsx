import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';
import { Streak, XpBadge } from './XpBadge';
import { buzz } from './feedback';
import { hrefFor } from '../router';
import type { TabName } from '../router';
import { useApp } from '../store';
import { engine } from '../engine';
import { levelFromXp } from '../../engine/api';

const links: { name: TabName; label: string; icon: GameIconName; href: string }[] = [
  { name: 'play', label: 'Play', icon: 'play', href: hrefFor('home') },
  { name: 'learn', label: 'Learn', icon: 'learn', href: hrefFor('learn') },
  { name: 'me', label: 'Me', icon: 'me', href: hrefFor('me') },
];

interface SideNavProps {
  active: TabName;
}

/** On wide screens the bottom tab bar becomes this side nav: logo, the three tabs, and streak and level at the bottom. */
export function SideNav({ active }: SideNavProps) {
  const app = useApp();

  return (
    <nav class="sidenav" aria-label="Main">
      <a class="sidenav-logo" href={hrefFor('home')} aria-label="Jargle, go to Play">
        <span class="sidenav-mark" aria-hidden="true">
          J
        </span>
        <span class="sidenav-word" aria-hidden="true">
          Jargle
        </span>
      </a>
      <ul class="sidenav-links">
        {links.map((link) => {
          const on = link.name === active;
          return (
            <li key={link.name}>
              <a
                class={on ? 'sidenav-link on' : 'sidenav-link'}
                href={link.href}
                aria-current={on ? 'page' : undefined}
                onClick={() => buzz()}
              >
                <span class="sidenav-icon">
                  <GameIcon name={link.icon} size={26} />
                </span>
                <span class="sidenav-label">{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <a class="sidenav-help" href={hrefFor('how')}>
        <GameIcon name="help" size={22} />
        <span class="sidenav-label">How to play</span>
      </a>
      {app.save && app.content ? <SideNavStats /> : null}
    </nav>
  );
}

/** Streak flame and level star, a link to the Me tab. */
function SideNavStats() {
  const app = useApp();
  if (!app.save || !app.content) return null;
  const streak = engine.homeView(app.save, app.content, app.today).streak;
  const level = levelFromXp(app.save.xp || 0).level;
  return (
    <a class="sidenav-stats" href={hrefFor('me')}>
      <span class="visually-hidden">{'Level ' + level + ', ' + streak + ' day streak. Open Me.'}</span>
      <span aria-hidden="true" class="sidenav-stat">
        <Streak days={streak} />
      </span>
      <span aria-hidden="true" class="sidenav-stat">
        <XpBadge level={level} />
      </span>
    </a>
  );
}
