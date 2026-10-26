import { Screen } from '../components/Screen';
import { GameIcon } from '../components/GameIcon';
import type { GameIconName } from '../components/GameIcon';
import { ProgressBar } from '../components/ProgressBar';
import { RowLink } from '../components/RowLink';
import { XpBadge } from '../components/XpBadge';
import { SettingsControls } from './Settings';
import { useApp } from '../store';
import { engine } from '../engine';
import { hrefFor } from '../router';
import { fallbackLevel, readEndlessBest, readXp } from './homeLogic';

export function MeScreen() {
  const app = useApp();
  if (!app.save || !app.content) return <Screen title="Me" children={null} />;

  const save = app.save;
  const hv = engine.homeView(save, app.content, app.today);
  const xp = readXp(save);
  const info = fallbackLevel(xp);
  const badgeCount = Object.keys(save.badges).length;

  return (
    <Screen title="Me">
      <div class="me">
        <section class="card me-level" aria-label="Your level">
          <XpBadge level={info.level} big />
          <div class="me-level-words">
            <p class="me-level-title">Level {info.level}</p>
            <p class="me-level-note">
              {info.needed - info.intoLevel} XP to level {info.level + 1}
            </p>
            <ProgressBar
              value={info.intoLevel}
              max={info.needed}
              tone="sunny"
              big
              label={'Level ' + info.level + ': ' + info.intoLevel + ' of ' + info.needed + ' XP'}
            />
          </div>
        </section>

        <ul class="stat-grid" aria-label="Your stats">
          <Stat icon="flame" tone="coral" num={hv.streak} label="day streak" />
          <Stat
            icon="star"
            tone="grape"
            num={hv.daysLearned}
            label={hv.daysLearned === 1 ? 'day learned' : 'days learned'}
          />
          <Stat icon="infinity" tone="mint" num={readEndlessBest(save)} label="Endless best" />
          <Stat icon="trophy" tone="sunny" num={badgeCount} label={badgeCount === 1 ? 'badge' : 'badges'} />
        </ul>

        <ul class="rows">
          <li>
            <RowLink href={hrefFor('badges')} icon="trophy" title="Badges" note="See what you've earned" />
          </li>
        </ul>

        <h2 class="me-section-title">Settings</h2>
        <div class="me-settings">
          <SettingsControls save={save} />
        </div>

        <h2 class="me-section-title">Your progress</h2>
        <ul class="rows">
          <li>
            <RowLink href={hrefFor('code')} icon="key" title="Get a progress code" note="Move to another phone" />
          </li>
          <li>
            <RowLink href={hrefFor('codeUse')} icon="download" title="Use a progress code" />
          </li>
        </ul>

        <h2 class="me-section-title">More</h2>
        <ul class="rows">
          <li>
            <RowLink href={hrefFor('how')} icon="help" title="How to play" />
          </li>
          <li>
            <RowLink href={hrefFor('get')} icon="download" title="Get Jargle" note="Add it to your phone or computer" />
          </li>
          <li>
            <RowLink href="?demo=judge" icon="play" title="Try the demo" note="8 days already learned" />
          </li>
          <li>
            <RowLink href={hrefFor('about')} icon="info" title="About Jargle" />
          </li>
        </ul>
      </div>
    </Screen>
  );
}

interface StatProps {
  icon: GameIconName;
  tone: 'coral' | 'grape' | 'mint' | 'sunny';
  num: number;
  label: string;
}

function Stat({ icon, tone, num, label }: StatProps) {
  return (
    <li class="stat">
      <span class={'mini-icon ' + tone}>
        <GameIcon name={icon} size={20} />
      </span>
      <span>
        <span class="stat-num">{num}</span>
        <span class="stat-label">{label}</span>
      </span>
    </li>
  );
}
