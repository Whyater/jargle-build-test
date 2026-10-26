// Rounded icons for the game look, drawn on a 24 px grid. Filled shapes use the current text color.

export type GameIconName =
  | 'play'
  | 'learn'
  | 'me'
  | 'flame'
  | 'star'
  | 'heart'
  | 'bolt'
  | 'back'
  | 'chevron'
  | 'gear'
  | 'help'
  | 'close'
  | 'trophy'
  | 'infinity'
  | 'people'
  | 'clock'
  | 'cards'
  | 'key'
  | 'info'
  | 'download';

interface GameIconProps {
  name: GameIconName;
  size?: number;
}

export function GameIcon({ name, size = 24 }: GameIconProps) {
  let paths;
  let filled = false;
  if (name === 'play') {
    filled = true;
    paths = <path d="M8 5.2c0-1 1.1-1.6 1.9-1.1l9.6 6.3c.8.5.8 1.6 0 2.1l-9.6 6.3c-.8.5-1.9-.1-1.9-1.1Z" />;
  } else if (name === 'learn') {
    paths = (
      <>
        <path d="M3.5 5.5c2.8-1 5.7-.8 8.5 1v13c-2.8-1.8-5.7-2-8.5-1Z" />
        <path d="M20.5 5.5c-2.8-1-5.7-.8-8.5 1v13c2.8-1.8 5.7-2 8.5-1Z" />
      </>
    );
  } else if (name === 'me') {
    paths = (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.6 14.2c1.8 2 5 2 6.8 0" />
        <path d="M9.2 9.6v.6M14.8 9.6v.6" />
      </>
    );
  } else if (name === 'flame') {
    filled = true;
    paths = (
      <path d="M12.6 2.6c.4 2.6 2 4 3.4 5.6 1.5 1.7 2.8 3.6 2.8 6.3a6.8 6.8 0 0 1-13.6 0c0-2.3 1-4 2.4-5.4.3 1.6 1 2.6 2 3.2-.3-3.6 1-7.2 3-9.7Z" />
    );
  } else if (name === 'star') {
    filled = true;
    paths = (
      <path d="M12 2.8l2.6 5.5 6 .8c.8.1 1.1 1.1.5 1.6l-4.4 4.1 1.1 5.9c.1.8-.7 1.4-1.4 1l-5.4-2.9-5.4 2.9c-.7.4-1.5-.2-1.4-1l1.1-5.9-4.4-4.1c-.6-.5-.3-1.5.5-1.6l6-.8L11 2.8c.4-.7 1.6-.7 2 0Z" />
    );
  } else if (name === 'heart') {
    filled = true;
    paths = <path d="M12 20.4S3.2 15.3 3.2 9.1A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.8 2.1c0 6.2-8.8 11.3-8.8 11.3Z" />;
  } else if (name === 'bolt') {
    filled = true;
    paths = (
      <path d="M13.6 2.5 5 13.2c-.4.5 0 1.3.7 1.3h5l-1.3 7c-.1.6.7.9 1.1.4L19 11.2c.4-.5 0-1.3-.7-1.3h-5l1.4-6.9c.1-.6-.7-.9-1.1-.5Z" />
    );
  } else if (name === 'back') {
    paths = <path d="M14.5 5.5 8 12l6.5 6.5" />;
  } else if (name === 'chevron') {
    paths = <path d="M9.5 5.5 16 12l-6.5 6.5" />;
  } else if (name === 'gear') {
    paths = (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
      </>
    );
  } else if (name === 'help') {
    paths = (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.4v.4M12 16.8v.2" />
      </>
    );
  } else if (name === 'close') {
    paths = <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />;
  } else if (name === 'trophy') {
    paths = (
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0Z" />
        <path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8.5 20h7M9.5 17h5" />
      </>
    );
  } else if (name === 'infinity') {
    paths = (
      <path d="M12 12c-1.8-2.4-3.2-3.5-5-3.5a3.5 3.5 0 0 0 0 7c1.8 0 3.2-1.1 5-3.5Zm0 0c1.8 2.4 3.2 3.5 5 3.5a3.5 3.5 0 0 0 0-7c-1.8 0-3.2 1.1-5 3.5Z" />
    );
  } else if (name === 'people') {
    paths = (
      <>
        <circle cx="8.5" cy="8.5" r="3" />
        <circle cx="16.5" cy="9.5" r="2.5" />
        <path d="M3 19c.6-3 2.8-4.8 5.5-4.8S13.4 16 14 19M14.6 14.6c2.6-.6 5.2.8 6 4.4" />
      </>
    );
  } else if (name === 'clock') {
    paths = (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    );
  } else if (name === 'cards') {
    paths = (
      <>
        <rect x="7.5" y="3.5" width="12" height="15" rx="2.5" />
        <path d="M4.5 7.5v10a3 3 0 0 0 3 3h8" />
      </>
    );
  } else if (name === 'key') {
    paths = (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
      </>
    );
  } else if (name === 'info') {
    paths = (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5.5M12 7.8v.2" />
      </>
    );
  } else {
    paths = <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />;
  }
  return (
    <svg
      class="gicon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}
