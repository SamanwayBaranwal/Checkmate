import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Public, indexable pages only. Account pages (wallet, settings, friends, admin) and live games are excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/leaderboard`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
  ];
}
