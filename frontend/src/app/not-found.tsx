import Link from 'next/link';
import type { Metadata } from 'next';
import BoardPreview from '@/components/BoardPreview';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

// A lone king on an empty board: the page you wanted isn't here.
export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 pt-10 pb-16 text-center">
      <div className="w-40 mx-auto mb-8"><BoardPreview fen="8/8/8/8/3K4/8/8/8" /></div>
      <p className="eyebrow mb-2">Error 404</p>
      <h1 className="text-3xl font-black tracking-tight">This square is empty</h1>
      <p className="text-muted font-medium mt-3">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href="/" className="btn-primary h-12 px-6">Back to home</Link>
        <Link href="/leaderboard" className="btn-secondary h-12 px-6">Leaderboard</Link>
      </div>
    </div>
  );
}
