import { useEffect, useErrorBoundary, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { tabForRoute, useRoute } from './ui/router';
import { useApp, initApp } from './ui/store';
import { Button } from './ui/components/Button';
import { HomeScreen } from './ui/screens/Home';
import { RoundScreen } from './ui/screens/Round';
import { ReviewScreen } from './ui/screens/Review';
import { LearnScreen } from './ui/screens/Learn';
import { LessonScreen } from './ui/screens/Lesson';
import { PracticeScreen } from './ui/screens/Practice';
import { OldTechScreen } from './ui/screens/OldTech';
import { PtpScreen } from './ui/screens/Ptp';
import { BadgesScreen } from './ui/screens/Badges';
import { SettingsScreen } from './ui/screens/Settings';
import { HowToPlayScreen } from './ui/screens/HowToPlay';
import { AboutScreen } from './ui/screens/About';
import { GetCodeScreen, UseCodeScreen } from './ui/screens/ProgressCode';
import { GetJargleScreen } from './ui/screens/GetJargle';
import { NotFoundScreen } from './ui/screens/NotFound';
import { MeScreen } from './ui/screens/Me';
import { EndlessScreen } from './ui/screens/Endless';
import { TabBar } from './ui/components/TabBar';
import { ToastHost } from './ui/components/Toast';
import { UpdateBanner } from './ui/components/UpdateBanner';
import { SideNav } from './ui/components/SideNav';
import { RightRail } from './ui/components/RightRail';
import { useWide } from './ui/components/useWide';
import { setLayoutClasses } from './ui/layoutClasses';

export default function App() {
  const route = useRoute();
  const tab = tabForRoute(route.name);
  const wide = useWide();
  // Set the layout classes during render, not in an effect: a screen's own effects run before
  // App's, and a game screen measures its pinned bar at the root font size focus mode sets.
  setLayoutClasses(tab !== null);
  // On wide screens the tab bar becomes a side nav, and a rail of today's progress sits on the right.
  const desktop = wide && tab !== null;
  return (
    <>
      <div class={desktop ? 'shell shell-wide' : 'shell'}>
        {desktop && tab ? <SideNav active={tab} /> : null}
        <div class="shell-main">
          <ScreenGuard key={route.name + ':' + (route.param || '')} />
        </div>
        {desktop ? <RightRail screen={route.name} /> : null}
      </div>
      {tab && !wide ? <TabBar active={tab} /> : null}
      <ToastHost />
      <UpdateBanner />
    </>
  );
}

// If a screen throws, show a way home instead of a blank page.
function ScreenGuard() {
  const [error, resetError] = useErrorBoundary();
  if (error) {
    return (
      <div class="sheet">
        <div class="stack" style={{ paddingTop: '2rem' }}>
          <h1 tabIndex={-1}>Something went wrong on this screen</h1>
          <p>Your progress is saved. Go back to Home and try again.</p>
          <a
            class="btn btn-primary btn-block"
            href="#/"
            onClick={() => {
              resetError();
            }}
          >
            <span>Home</span>
          </a>
        </div>
      </div>
    );
  }
  return <Routes />;
}

function Routes() {
  const app = useApp();
  const route = useRoute();

  // The dev gallery works without content, so it skips the loading states.
  if (import.meta.env.DEV && route.name === 'gallery') return <DevGallery />;

  // Pages that need no saved game can show while the words load.
  if (route.name === 'get') return <GetJargleScreen />;
  if (route.name === 'about') return <AboutScreen />;

  if (app.status === 'loading') return <div class="sheet" aria-busy="true" />;
  if (app.status === 'error') return <LoadError />;

  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'play':
      return <RoundScreen key={route.param || ''} roundKey={route.param || ''} />;
    case 'review':
      return <ReviewScreen />;
    case 'learn':
      return <LearnScreen />;
    case 'lesson':
      return <LessonScreen key={route.param || ''} lessonId={route.param || ''} />;
    case 'practice':
      return <PracticeScreen />;
    case 'oldtech':
      return <OldTechScreen />;
    case 'ptp':
      return <PtpScreen />;
    case 'badges':
      return <BadgesScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'me':
      return <MeScreen />;
    case 'endless':
      return <EndlessScreen />;
    case 'how':
      return <HowToPlayScreen />;
    case 'code':
      return <GetCodeScreen />;
    case 'codeUse':
      return <UseCodeScreen />;
    default:
      return <NotFoundScreen />;
  }
}

function LoadError() {
  return (
    <div class="sheet">
      <div class="stack" style={{ paddingTop: '2rem' }}>
        <h1 tabIndex={-1}>Jargle can't load its words</h1>
        <p>Check your internet connection, then try again.</p>
        <Button primary onClick={() => initApp()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

// Loaded only in development; the production build drops this branch.
function DevGallery() {
  const [Gallery, setGallery] = useState<FunctionComponent | null>(null);
  useEffect(() => {
    import('./ui/__dev__/Gallery').then((module) => setGallery(() => module.Gallery));
  }, []);
  return Gallery ? <Gallery /> : <div class="sheet" />;
}
