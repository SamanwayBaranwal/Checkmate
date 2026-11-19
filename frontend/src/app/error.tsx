'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Shown when a page crashes. Keeps the app shell (nav) and offers a retry.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="max-w-md mx-auto px-4 pt-16 pb-16 text-center">
      <p className="eyebrow mb-2">Something went wrong</p>
      <h1 className="text-3xl font-black tracking-tight">That move didn&apos;t work</h1>
      <p className="text-muted font-medium mt-3">An unexpected error happened. Your balance and games are safe.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <button onClick={reset} className="btn-primary h-12 px-6">Try again</button>
        <Link href="/" className="btn-secondary h-12 px-6">Back to home</Link>
      </div>
      {error.digest && <p className="text-xs text-faint mt-6 num">Error ID: {error.digest}</p>}
    </div>
  );
}
