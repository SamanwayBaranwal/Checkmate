// Public site URL used for canonical links, sitemap and social cards. Set NEXT_PUBLIC_SITE_URL in production.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'ELO';
export const SITE_DESCRIPTION = 'Play rated chess against real people and win money. Bullet, blitz and rapid, with Stockfish fair-play checks on every game.';
