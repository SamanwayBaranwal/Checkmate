import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Game replay',
  description: 'Replay a rated chess game move by move.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
