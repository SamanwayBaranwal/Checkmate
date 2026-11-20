import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Rate limits. Keyed by the logged-in user when there is a token (many Indian mobile users share one IP
// behind Jio / Airtel CGNAT, so IP-only limits would block strangers), falling back to the client IP.
// In-memory store: fine for the single API instance we run. Move to a Redis store before scaling out.

const enabled = process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT === '1';

function key(req: Request): string {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return 'u:' + crypto.createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 32);
  }
  return 'ip:' + (req.ip || 'unknown');
}

const make = (windowMs: number, limit: number, byIp = false) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: byIp ? (req) => 'ip:' + (req.ip || 'unknown') : key,
    skip: () => !enabled,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
  });

/** Every API route: generous, stops scripted floods. */
export const apiLimiter = make(60_000, 300);
/** Login / account creation: per IP, so one machine can't mint accounts in a loop. */
export const authLimiter = make(15 * 60_000, 40, true);
/** Free credits, daily bonus, withdrawals, reports: money-adjacent, low volume by design. */
export const sensitiveLimiter = make(60_000, 15);
/** Admin: per IP, slows down secret guessing. */
export const adminLimiter = make(15 * 60_000, 100, true);

/** Per-socket event throttle: drops a client sending more than `limit` events per `windowMs`. */
export function socketThrottle(limit = 40, windowMs = 5_000) {
  let count = 0;
  let windowStart = Date.now();
  return (): boolean => {
    if (!enabled) return true;
    const now = Date.now();
    if (now - windowStart > windowMs) { windowStart = now; count = 0; }
    count++;
    return count <= limit;
  };
}
