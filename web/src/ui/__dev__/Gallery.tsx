// Dev-only screen list. Each entry loads hand-made state and opens one screen,
// so every screen can be checked before the real engine is ready.
// Open /?g=<entry name>#/gallery to jump straight to one entry.

import { useEffect } from 'preact/hooks';
import type { GalleryEntry } from './types';
import { roundGallery } from './fixtures-round';
import { homeGallery } from './fixtures-home';
import { listsGallery } from './fixtures-lists';
import { navigate } from '../router';
import { engine } from '../engine';
import { getApp, setAppForDev } from '../store';
import type { TextSize } from '../../engine/types';

const groups: { title: string; entries: GalleryEntry[] }[] = [
  { title: 'Home and settings', entries: homeGallery },
  { title: 'Rounds', entries: roundGallery },
  { title: 'Lists, lessons and Pass the Phone', entries: listsGallery },
];

// Harmless stand-ins so taps in the gallery do not hit unfinished engine code.
// Each fixture can still replace any of these in its own setup.
function installDevDefaults() {
  engine.dayNumber = (date: string) => {
    const parts = date.split('-');
    const day = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Math.round((day - Date.UTC(2026, 9, 25)) / 86400000) + 1;
  };
  engine.dateOfDay = (day: number) => {
    const d = new Date(Date.UTC(2026, 9, 25) + (day - 1) * 86400000);
    return d.toISOString().slice(0, 10);
  };
  engine.lessonOptions = (lesson, index) => lesson.checks[index].options;
  engine.saveLessonProgress = (state) => state;
  engine.finishLesson = (state) => ({ state, newBadges: ['first-lesson'], xpGained: 30 });
  engine.answerReview = (state) => state;
  engine.nextWord = () => ({ message: "You've done them all." });
  engine.startPtpSet = (state) => state;
}

function open(entry: GalleryEntry) {
  installDevDefaults();
  entry.setup();
  // ?ts=large or ?ts=largest shows the entry at that text size.
  const size = new URLSearchParams(window.location.search).get('ts');
  const save = getApp().save;
  if (save && (size === 'normal' || size === 'large' || size === 'largest')) {
    setAppForDev({ save: { ...save, settings: { ...save.settings, textSize: size as TextSize } } });
  }
  navigate(entry.route, entry.param);
}

/** "Home not played, streak" -> "home-not-played-streak" */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function Gallery() {
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('g');
    if (!wanted) return;
    for (const group of groups) {
      for (const entry of group.entries) {
        if (slug(entry.name) === wanted || entry.name === wanted) open(entry);
      }
    }
  }, []);

  return (
    <div class="sheet">
      <h1 style={{ paddingTop: '1rem' }}>Screen gallery</h1>
      {groups.map((group) => (
        <section key={group.title} class="stack-sm" style={{ marginTop: '1.5rem' }}>
          <h2>{group.title}</h2>
          <ul class="rows">
            {group.entries.map((entry) => (
              <li key={entry.name}>
                <button type="button" class="row-link" onClick={() => open(entry)}>
                  <span class="main">
                    <span class="title">{entry.name}</span>
                    <span class="note">{slug(entry.name)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
