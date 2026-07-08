'use client';

// Clean line-icon set — no emoji anywhere in the UI.
// Usage: <Icon name="trophy" size={18} />

type Props = { name: IconName; size?: number; className?: string; strokeWidth?: number };

export type IconName =
  | 'pawn' | 'rating' | 'games' | 'winrate' | 'trophy' | 'rank'
  | 'gift' | 'play' | 'wallet' | 'fire' | 'target' | 'crown'
  | 'star' | 'bolt' | 'gem' | 'coin' | 'check' | 'bell'
  | 'google' | 'wallet-connect' | 'sound' | 'flag' | 'users' | 'puzzle' | 'clock'
  | 'mail' | 'phone';

const PATHS: Record<IconName, string> = {
  pawn: 'M12 3a3 3 0 0 0-1.6 5.5C9 9.2 8 10.7 8 12.4c0 1.3.7 2.5 1.7 3.2-.5 2.3-1.6 4.6-2.9 6-.4.5-.1 1.4.7 1.4h9c.8 0 1.1-.9.7-1.4-1.3-1.4-2.4-3.7-2.9-6 1-.7 1.7-1.9 1.7-3.2 0-1.7-1-3.2-2.4-3.9A3 3 0 0 0 12 3Z',
  rating: 'M4 19V9|M10 19V5|M16 19v-8|M22 19v-6',
  games: 'M6 12h4M8 10v4|M15 11h.01M18 13h.01|M17.3 5H6.7A4.7 4.7 0 0 0 2 9.7L2 15a3 3 0 0 0 5.1 2.1L9 15h6l1.9 2.1A3 3 0 0 0 22 15l0-5.3A4.7 4.7 0 0 0 17.3 5Z',
  winrate: 'M3 17l6-6 4 4 8-8|M17 7h4v4',
  trophy: 'M6 9V3h12v6a6 6 0 0 1-12 0Z|M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3|M9 21h6M12 15v6',
  rank: 'M6 9V3h12v6a6 6 0 0 1-12 0Z|M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3|M9 21h6M12 15v6',
  gift: 'M20 12v9H4v-9|M2 7h20v5H2z|M12 22V7|M12 7S9 2 6.5 3.5 8 7 12 7|M12 7s3-5 5.5-3.5S16 7 12 7',
  play: 'M6 4l14 8-14 8z',
  wallet: 'M3 6h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M16 13h.01M3 10h18',
  fire: 'M12 3c1 3-1 5-2 6-1-1-1-2-1-3-2 2-3 4-3 7a6 6 0 0 0 12 0c0-3-3-6-3-8-1 1-2 1-3-2Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z|M12 12h.01',
  crown: 'M3 7l4 4 5-6 5 6 4-4v11H3z|M3 20h18',
  star: 'M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19l1-6L3.3 8.9l6-.9z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  gem: 'M6 3h12l3 6-9 12L3 9z|M3 9h18M9 3 6 9l6 12 6-12-3-6',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.7 2.5 1.6c0 2-5 1-5 2.9 0 1 1 1.7 2.5 1.7s2.5-.6 2.5-1.6',
  check: 'M20 6 9 17l-5-5',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0',
  google: 'M21 12.2c0-.6 0-1.2-.2-1.8H12v3.5h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3a9 9 0 0 0 2.8-7Z|M12 21a8.8 8.8 0 0 0 6.1-2.2l-3-2.3a5.4 5.4 0 0 1-8-2.9H4v2.4A9 9 0 0 0 12 21Z|M7.1 13.6a5.3 5.3 0 0 1 0-3.4V7.8H4a9 9 0 0 0 0 8.1z|M12 6.6a4.9 4.9 0 0 1 3.4 1.3l2.6-2.6A8.7 8.7 0 0 0 12 3a9 9 0 0 0-8 4.8l3.1 2.4A5.4 5.4 0 0 1 12 6.6Z',
  'wallet-connect': 'M6 9c3.3-3.2 8.7-3.2 12 0l.4.4-1.7 1.6-.4-.3a6 6 0 0 0-8.6 0l-.4.4L5 9.4z|M9 12.4a3.4 3.4 0 0 1 6 0',
  sound: 'M11 5 6 9H2v6h4l5 4z|M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14',
  flag: 'M4 22V4|M4 4l7 3 4-2 5 2v9l-5-2-4 2-7-3',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  puzzle: 'M4 7h4V5a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4h-4v-2a2 2 0 1 0-4 0v2H4v-4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 7v5l3 2',
  mail: 'M3 6h18v12H3z|M3 7l9 6 9-6',
  phone: 'M7 3h10v18H7z|M11 18h2',
};

// Icons that read better filled
const FILLED: IconName[] = ['pawn', 'play', 'star', 'bolt', 'coin', 'gem'];

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }: Props) {
  const d = PATHS[name];
  const fill = FILLED.includes(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={fill ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
