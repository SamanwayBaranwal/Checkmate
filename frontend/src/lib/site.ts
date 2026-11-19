// Public site URL used for canonical links, sitemap and social cards. Set NEXT_PUBLIC_SITE_URL in production.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'ELO';
/** Real money is off at launch (free credits, no cash value). Must match the backend's REAL_MONEY. */
export const REAL_MONEY = process.env.NEXT_PUBLIC_REAL_MONEY === 'true';
export const SITE_TITLE = REAL_MONEY ? 'ELO: play chess, win money' : 'ELO: play rated chess, win credits';
export const SITE_DESCRIPTION = REAL_MONEY
  ? 'Play rated chess against real people and win money. Bullet, blitz and rapid, with Stockfish fair-play checks on every game.'
  : 'Play rated chess against real people. Stake free credits, climb the leaderboard. Bullet, blitz and rapid, with Stockfish fair-play checks on every game.';
