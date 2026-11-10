import type { SVGProps } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  draw: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21m0-18C9.5 5.4 8.2 8.4 8.2 12s1.3 6.6 3.8 9M3.6 9h16.8M3.6 15h16.8',
  groups: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  bracket: 'M3 5h5v4H3zM3 15h5v4H3zM8 7h3v10H8m3-5h3m2-2h5v4h-5z',
  road: 'M5 21c0-5 4-6 7-8s4-5 1-7-6 0-6 0M17 3h4v4M12 21h0m7-4a2 2 0 1 0 0 .01',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  poster: 'M5 3h14v18H5zM8 15l3-3 3 3 2-2 3 3M9 8.5a1.5 1.5 0 1 0 0 .01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  check: 'M5 12.5 10 17 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  download: 'M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16',
  upload: 'M12 20V9m0 0 4.5 4.5M12 9l-4.5 4.5M4 4h16',
  share: 'M16 6l-4-4-4 4M12 2v14M5 11v9h14v-9',
  shuffle: 'M3 7h3c5 0 7 10 12 10h3m0 0-3-3m3 3-3 3M3 17h3c1.5 0 2.7-.9 3.7-2.2M21 7h-3c-1.5 0-2.7.9-3.7 2.2M21 7l-3-3m3 3-3 3',
  trophy: 'M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 2v4m-4 4h8m-6-4h4l1 4H9z',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5 3.3 2.4-1.3 3.9H10l-1.3-3.9zM12 3v4.5m3.3 2.4 4.9-1.6M14 13.8l3 4.2M10 13.8 7 18m1.7-8.1L3.8 8.3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  card: 'M7 3h10v18H7z',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8.5v.01',
  alert: 'M12 3 2 20h20zM12 10v4m0 3v.01',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4M8 11h6M11 8v6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4M8 11h6',
  skip: 'M5 5l9 7-9 7zM17 5v14',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  whistle: 'M3 13a5 5 0 0 0 10 0v-3h8l-1 4h-4M8 13h.01M9 4l1 3M4 6l2 2',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const filled = name === 'play' || name === 'pause' || name === 'star';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}
