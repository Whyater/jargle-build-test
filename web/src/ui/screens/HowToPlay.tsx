import { Screen } from '../components/Screen';
import { LinkButton } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import { Mascot } from '../components/Mascot';
import { hrefFor } from '../router';
// The demo tiles are the real game tiles, so they look exactly like Daily Jargle.
import '../../styles/jargle.css';
import '../../styles/screens.css';

// Word is CABLE: C is in the right spot, L is in the word but too early, the rest are not in it.
const DEMO_GUESS = [
  { letter: 'C', state: 'correct' },
  { letter: 'L', state: 'present' },
  { letter: 'O', state: 'absent' },
  { letter: 'U', state: 'absent' },
  { letter: 'D', state: 'absent' },
];

export function HowToPlayScreen() {
  const demoTiles = DEMO_GUESS.map((tile) => (
    <span key={tile.letter} class={'jg-tile ' + tile.state}>
      {tile.letter}
    </span>
  ));
  return (
    <Screen title="How to play">
      <div class="how stack-lg">
        <p class="how-goal">Guess today's tech word in 6 tries. One new word every day.</p>
        <ol class="how-steps">
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                1
              </span>
              Read the first clue
            </p>
            {/* The demos are only pictures, so screen readers skip them. */}
            <div class="how-demo how-clue" aria-hidden="true">
              <p class="how-clue-count">
                Clue 1 of 5
                <span class="jg-dots">
                  <span class="jg-dot on" />
                  <span class="jg-dot" />
                  <span class="jg-dot" />
                  <span class="jg-dot" />
                  <span class="jg-dot" />
                </span>
              </p>
              <p class="how-clue-text">You plug it in to charge your phone.</p>
            </div>
          </li>
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                2
              </span>
              Type a guess and press Enter
            </p>
            <p>The word has 4 to 7 letters. Each tile tells you how close you are.</p>
            <p>
              A <strong>Key word</strong> tag means the answer is one word that goes with a longer term, like LOGIN for
              two-factor login.
            </p>
            <div class="how-demo jg" aria-hidden="true">
              <div class="how-row jg-row">{demoTiles}</div>
            </div>
            <ul class="how-key">
              <li>
                <span class="jg-mini-tile correct" aria-hidden="true" />
                <span>Green: right letter, right spot</span>
              </li>
              <li>
                <span class="jg-mini-tile present" aria-hidden="true" />
                <span>Yellow: in the word, wrong spot</span>
              </li>
              <li>
                <span class="jg-mini-tile" aria-hidden="true" />
                <span>Gray: not in the word</span>
              </li>
            </ul>
          </li>
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                3
              </span>
              Missed? You get a new clue
            </p>
            <div class="how-demo how-clue" aria-hidden="true">
              <p class="how-clue-count">
                Clue 2 of 5
                <span class="jg-dots">
                  <span class="jg-dot on" />
                  <span class="jg-dot on" />
                  <span class="jg-dot" />
                  <span class="jg-dot" />
                  <span class="jg-dot" />
                </span>
              </p>
              <p class="how-clue-text">It has a plug on each end.</p>
            </div>
            <p>Every miss unlocks one more clue.</p>
          </li>
        </ol>
        <div class="how-notes stack-sm">
          <p>
            <GameIcon name="cards" size={20} />
            <span>Win or lose, you see what the word means. Then you can learn it in a short lesson.</span>
          </p>
          <p>
            <GameIcon name="learn" size={20} />
            <span>
              <strong>Lessons:</strong> in the Learn tab, short lessons mix cards, matching, fill the blank, scam or
              safe, and spelling. Misses come back at the end and later in Review. Earn stars.
            </span>
          </p>
          <p>
            <GameIcon name="infinity" size={20} />
            <span>
              <strong>Endless:</strong> play as long as you like. Watch your hearts, build combos, and spell words with
              letter tiles.
            </span>
          </p>
          <p>
            <GameIcon name="flame" size={20} />
            <span>
              <strong>Streak:</strong> it ends only if you miss two days in a row. A day counts when you finish the
              Daily Jargle.
            </span>
          </p>
        </div>
        <div class="how-meet">
          <div class="win-mascots">
            <Mascot who="floyd" size={80} pose="wave" />
            <Mascot who="bud" size={80} pose="wave" />
          </div>
          <p>Meet Floyd and Bud. Tap either one to say hi.</p>
        </div>
        <LinkButton primary big block href={hrefFor('home')}>
          Let's play
        </LinkButton>
        <p class="desktop-tip">Tip: type your letters, Backspace to delete, Enter to guess.</p>
      </div>
    </Screen>
  );
}
