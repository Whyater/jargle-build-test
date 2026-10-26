import { render } from 'preact';
import './index.css';
import App from './App.tsx';
import { unlockAudio } from './platform/audio';
import { registerServiceWorker } from './platform/sw-register';
import { initApp } from './ui/store';

// Sound can only start after the first tap or key press.
function firstGesture() {
  unlockAudio();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
}
window.addEventListener('pointerdown', firstGesture);
window.addEventListener('keydown', firstGesture);

// Show the focus ring only for keyboard use.
window.addEventListener('pointerdown', () => document.documentElement.classList.add('mouse'));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') document.documentElement.classList.remove('mouse');
});

const root = document.getElementById('root')!;
// Clear the "still starting" note if a slow connection showed it.
root.innerHTML = '';
render(<App />, root);
document.documentElement.setAttribute('data-started', '1');
// The dev gallery fills the store itself.
const inGallery = import.meta.env.DEV && window.location.hash.indexOf('#/gallery') === 0;
if (!inGallery) initApp();
registerServiceWorker();
