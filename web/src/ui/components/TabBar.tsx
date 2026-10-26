import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';
import { hrefFor } from '../router';
import type { TabName } from '../router';
import { buzz } from './feedback';

const tabs: { name: TabName; label: string; icon: GameIconName; href: string }[] = [
  { name: 'play', label: 'Play', icon: 'play', href: hrefFor('home') },
  { name: 'learn', label: 'Learn', icon: 'learn', href: hrefFor('learn') },
  { name: 'me', label: 'Me', icon: 'me', href: hrefFor('me') },
];

interface TabBarProps {
  active: TabName;
}

/** The bottom bar with Play, Learn and Me. Fixed to the bottom, clear of the phone's home bar. */
export function TabBar({ active }: TabBarProps) {
  return (
    <nav class="tabbar" aria-label="Main">
      <ul>
        {tabs.map((tab) => {
          const on = tab.name === active;
          return (
            <li key={tab.name}>
              <a
                class={on ? 'tab-link on' : 'tab-link'}
                href={tab.href}
                aria-current={on ? 'page' : undefined}
                onClick={() => buzz()}
              >
                <span class="tab-icon">
                  <GameIcon name={tab.icon} size={26} />
                </span>
                <span class="tab-label">{tab.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
