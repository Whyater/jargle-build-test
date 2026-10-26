import { Screen } from '../components/Screen';
import { Battery } from '../components/Battery';
import { LinkButton } from '../components/Button';
import { GameIcon } from '../components/GameIcon';
import { Mascot } from '../components/Mascot';
import { hrefFor } from '../router';
import './round.css';
import '../../styles/screens.css';

export function HowToPlayScreen() {
  return (
    <Screen title="How to play">
      <div class="how stack-lg">
        <p class="how-goal">Guess today's tech word from clues. One new word every day.</p>
        <ol class="how-steps">
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                1
              </span>
              Read the clue
            </p>
            {/* Small pictures of the real round. They are only pictures, so screen readers skip them. */}
            <div class="how-demo clue-stack" aria-hidden="true">
              <div class="clue newest">
                <span class="n">1</span>
                <span class="clue-text">You tap it to save a file.</span>
              </div>
            </div>
          </li>
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                2
              </span>
              Tap a word, then tap Check
            </p>
            <div class="how-demo play-cards" aria-hidden="true">
              <div class="answer-card">
                <span class="term">Cloud</span>
              </div>
              <div class="answer-card is-picked">
                <span class="term">Floppy disk</span>
                <span class="state-icon picked" />
              </div>
            </div>
          </li>
          <li class="how-step">
            <p class="how-step-title">
              <span class="how-num" aria-hidden="true">
                3
              </span>
              Not sure? Get another clue
            </p>
            <div class="how-demo energy" aria-hidden="true">
              <div class="energy-top">
                <span class="energy-bolt">
                  <GameIcon name="bolt" size={22} />
                </span>
                <Battery bars={5} />
                <span class="energy-count">5</span>
              </div>
            </div>
            <p>You start with 6 bars. An extra clue costs 1. A wrong guess costs 3. More bars left is better.</p>
          </li>
        </ol>
        <div class="how-notes stack-sm">
          <p>
            <GameIcon name="cards" size={20} />
            <span>A wrong word flips over and shows what it means, so a miss still teaches you a word.</span>
          </p>
          <p>
            <GameIcon name="star" size={20} />
            <span>If your bars run out, we show you the answer, and it still counts.</span>
          </p>
          <p>
            <GameIcon name="flame" size={20} />
            <span>Your streak ends only if you miss two days in a row.</span>
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
        <p class="desktop-tip">Tip: press 1 to 4 to pick, Enter to check.</p>
      </div>
    </Screen>
  );
}
