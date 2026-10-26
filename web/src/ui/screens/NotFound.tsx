import { Screen } from '../components/Screen';
import { LinkButton } from '../components/Button';
import { MascotSays } from '../components/MascotSays';
import { hrefFor } from '../router';
import '../../styles/screens.css';

export function NotFoundScreen() {
  return (
    <Screen title="Page not found">
      <div class="stack">
        <MascotSays who="floyd" pose="oops" text="Oops! This page isn't part of Jargle." />
        <LinkButton href={hrefFor('home')} primary big block>
          Back to Play
        </LinkButton>
      </div>
    </Screen>
  );
}
