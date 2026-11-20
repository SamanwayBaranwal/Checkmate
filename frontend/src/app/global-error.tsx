'use client';

// Last-resort error screen when the root layout itself fails (no app styles available here).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111112', color: '#F6F6F7', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>ELO is having a moment</h1>
          <p style={{ color: '#A8A8AE', marginTop: 12 }}>Please try again. Your balance and games are safe.</p>
          <button onClick={reset} style={{ marginTop: 24, height: 48, padding: '0 24px', borderRadius: 14, border: 0, background: '#F6F6F7', color: '#111112', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
