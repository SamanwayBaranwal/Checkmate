import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'The top rated chess players on ELO. Climb the ranks by winning rated games.',
  alternates: { canonical: '/leaderboard' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
