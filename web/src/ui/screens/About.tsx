import { LinkButton } from '../components/Button';
import { Screen } from '../components/Screen';
import { Mascot } from '../components/Mascot';
import { sourceUrl } from '../../config';
import './round.css';
import '../../styles/screens.css';

export function AboutScreen() {
  return (
    <Screen title="About this app">
      <div class="about stack-lg">
        <div class="about-hero">
          <div class="win-mascots">
            <Mascot who="floyd" size={72} pose="wave" />
            <Mascot who="bud" size={72} pose="happy" />
          </div>
          <p>
            Jargle is a daily word game for tech words. You guess the word from clues and four answer cards. A wrong
            guess flips over and shows what that word means, so a miss still teaches you something.
          </p>
          <p class="about-maker">Made by Abyan.</p>
        </div>

        <section class="about-card stack-sm">
          <h2>Where the words come from</h2>
          <p>
            Every word lists the sources it is based on under "Where this comes from." Abyan is still checking every word
            by hand. If you spot a mistake, tap "Something wrong? Tell us" under that word.
          </p>
          <p>The app makes its own sounds as you play, so there are no sound files to download.</p>
        </section>

        <section class="about-card stack-sm">
          <h2>Your privacy</h2>
          <p>
            No accounts, no ads, no tracking. Your progress stays on this device. Every clue and answer is fixed
            text that ships with the app.
          </p>
        </section>

        <section class="about-card stack-sm">
          <h2>Fonts and libraries</h2>
          <ul class="plain-list">
            <li>Fredoka, by the Fredoka Project Authors (SIL Open Font License 1.1)</li>
            <li>Preact (MIT License)</li>
            <li>Vite, the build tool (MIT License)</li>
          </ul>
        </section>

        <section class="about-card stack-sm">
          <h2>Source code</h2>
          <p>
            <a class="link" href={sourceUrl} target="_blank" rel="noopener">
              See the source code on GitHub
            </a>
          </p>
        </section>

        <LinkButton block href="?demo=judge">
          Try the demo: 8 days already learned
        </LinkButton>
      </div>
    </Screen>
  );
}
