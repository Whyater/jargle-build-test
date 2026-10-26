// Small line icons drawn on a 24 px grid with a 2 px navy stroke, so they match the card borders.

interface IconProps {
  name: 'home' | 'settings' | 'help' | 'check' | 'lock' | 'back' | 'copy' | 'share' | 'download';
}

export function Icon({ name }: IconProps) {
  let paths;
  if (name === 'home') {
    paths = <path d="M3 11 12 4l9 7M6 9.5V20h12V9.5M10 20v-5h4v5" />;
  } else if (name === 'settings') {
    paths = (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <rect x="14" y="5" width="4" height="4" />
        <rect x="6" y="15" width="4" height="4" />
      </>
    );
  } else if (name === 'help') {
    paths = (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17v.5" />
      </>
    );
  } else if (name === 'check') {
    paths = <path d="M4 12.5 9.5 18 20 6" />;
  } else if (name === 'lock') {
    paths = (
      <>
        <rect x="5" y="11" width="14" height="9" rx="1" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    );
  } else if (name === 'back') {
    paths = <path d="M10 6 4 12l6 6M4 12h16" />;
  } else if (name === 'copy') {
    paths = (
      <>
        <rect x="8" y="8" width="12" height="12" rx="1" />
        <path d="M16 8V4H4v12h4" />
      </>
    );
  } else if (name === 'share') {
    paths = <path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" />;
  } else {
    paths = <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />;
  }
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="square"
      stroke-linejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}
