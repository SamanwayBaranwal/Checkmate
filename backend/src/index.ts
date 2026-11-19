import 'dotenv/config';
import express from 'express';
// Express 4 ignores errors thrown in async route handlers, which left requests hanging forever
// (e.g. GET /api/users/<not-a-uuid>). This forwards them to the error handler below.
import 'express-async-errors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

import authRouter from './routes/auth';
import walletRouter from './routes/wallet';
import gamesRouter from './routes/games';
import usersRouter from './routes/users';
import devRouter from './routes/dev';
import tournamentsRouter from './routes/tournaments';
import friendsRouter from './routes/friends';
import notificationsRouter from './routes/notifications';
import missionsRouter from './routes/missions';
import reportsRouter from './routes/reports';
import puzzlesRouter from './routes/puzzles';
import adminRouter from './routes/admin';
import { apiLimiter, authLimiter, sensitiveLimiter, adminLimiter, socketThrottle } from './middleware/rateLimit';

import { setupMatchmaking, registerUser, unregisterUser } from './socket/matchmaking';
import { setupGameRoom, startTimeoutChecker, registerGamePlayer } from './socket/gameRoom';
import { setupSpectator } from './socket/spectator';
import { setupChallenge } from './socket/challenge';
import { setupTournament } from './socket/tournament';
import { startDepositWatcher } from './services/deposit';
import { startCronJobs } from './services/cron';
import { addOnlineSocket, removeOnlineSocket } from './services/onlineUsers';
import { setIo } from './services/notifications';
import { db } from './db/client';
import { redis } from './db/redis';
import { ensureFairplaySchema, resumePendingAnalysis } from './services/fairplay/service';
import { runMigrations } from './db/migrate';
import { startHoldReleaser, recordIdentifiers, clientIp } from './services/fairplay/trust';

const IS_PROD = process.env.NODE_ENV === 'production';

// Refuse to boot in production without the secrets the app depends on (instead of failing per request,
// or signing tokens with a weak/empty key).
if (IS_PROD) {
  const missing = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'PRIVY_APP_ID', 'ADMIN_SECRET', 'IDENTITY_SALT', 'FRONTEND_URL']
    .filter((k) => !process.env[k]);
  const weak = ['JWT_SECRET', 'ADMIN_SECRET', 'IDENTITY_SALT'].filter((k) => (process.env[k] || '').length < 24);
  if (missing.length || weak.length) {
    console.error(`Refusing to start: missing env ${missing.join(', ') || '-'}; too short (<24 chars) ${weak.join(', ') || '-'}`);
    process.exit(1);
  }
}

const app = express();
const httpServer = createServer(app);

// Support comma-separated FRONTEND_URL for multiple origins (localhost + Vercel)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());
// Any *.vercel.app origin (anyone can deploy one) is only trusted outside production, or when explicitly enabled
const allowVercelPreviews = !IS_PROD || process.env.ALLOW_VERCEL_PREVIEWS === 'true';

const originFn = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || allowedOrigins.includes(origin) || (allowVercelPreviews && origin.endsWith('.vercel.app'))) {
    cb(null, true);
  } else {
    cb(null, false); // no CORS headers -> browser blocks it (before: threw, and every such request was a 500)
  }
};

const io = new Server(httpServer, {
  cors: { origin: originFn, methods: ['GET', 'POST'], credentials: true },
});

app.set('trust proxy', 1); // real client IP behind Railway's proxy (one person, one account)
app.use(helmet());
app.use(cors({ origin: originFn, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use(['/api/dev', '/api/reports', '/api/wallet/withdraw', '/api/users/me/daily-bonus'], (req, res, next) =>
  (req.method === 'GET' ? next() : sensitiveLimiter(req, res, next)));
app.use('/api/admin', adminLimiter);
app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/games', gamesRouter);
app.use('/api/users', usersRouter);
app.use('/api/dev', devRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/puzzles', puzzlesRouter);
app.use('/api/admin', adminRouter);

// Health: also checks Postgres and Redis, so Railway does not route traffic to an instance that can't serve it
app.get('/health', async (_req, res) => {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000));
  try {
    await Promise.race([Promise.all([db.raw('select 1'), redis.ping()]), timeout]);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });

// Last-resort error handler: every request gets an answer, never a hang.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON' }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'Request too large' }); return; }
  if (err?.code === '22P02') { res.status(404).json({ error: 'Not found' }); return; } // invalid uuid etc.
  if (err?.code === '23503') { res.status(404).json({ error: 'Not found' }); return; } // referenced row missing
  if (err?.code === '22003' || err?.code === '22007' || err?.code === '22008') { res.status(400).json({ error: 'Invalid input' }); return; }
  console.error('Unhandled route error:', err);
  res.status(500).json({ error: 'Server error' });
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    // Allow unauthenticated connections for spectating
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; wallet: string };
    (socket as any).userId = payload.userId;
    (socket as any).wallet = payload.wallet;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Every socket event payload must be an object, and any id in it a UUID string. Before: a null payload or
// 'not-a-uuid' threw inside the handler (unhandled rejection, no reply to the client).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_FIELDS = ['gameId', 'challengeId', 'targetId', 'tournamentId'];

io.on('connection', async (socket) => {
  const userId = (socket as any).userId as string | undefined;

  const allowEvent = socketThrottle();
  socket.use(([event, payload], next) => {
    if (!allowEvent()) return next(new Error('Too many requests'));
    if (event === 'leave_queue' && payload === undefined) return next();
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return next(new Error('Invalid payload'));
    for (const f of ID_FIELDS) {
      if (f in payload && (typeof payload[f] !== 'string' || !UUID_RE.test(payload[f]))) return next(new Error(`Invalid ${f}`));
    }
    next();
  });
  socket.on('error', (err) => socket.emit('error', { message: err?.message || 'Bad request' }));

  if (userId) {
    const user = await db('users').where({ id: userId }).select('elo', 'wallet').first();
    if (user) {
      registerUser(socket.id, { userId, wallet: user.wallet, elo: user.elo });
      (socket as any).userId = userId;
      addOnlineSocket(userId, socket.id);
      socket.join(`user:${userId}`);
      recordIdentifiers(userId, { ip: clientIp(socket.handshake.headers['x-forwarded-for'] as string) || clientIp(socket.handshake.address) })
        .catch(() => {});
    }
  }

  setupMatchmaking(io, socket);
  setupGameRoom(io, socket);
  setupSpectator(io, socket);
  setupChallenge(io, socket);
  setupTournament(io, socket);

  socket.on('disconnect', () => {
    unregisterUser(socket.id);
    if (userId) {
      removeOnlineSocket(userId, socket.id);
    }
  });
});

setIo(io);
startTimeoutChecker(io);
startDepositWatcher();
startCronJobs();

// Safety net: never let one bad async query crash the whole server
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Graceful shutdown (Railway sends SIGTERM on every deploy): stop accepting, close sockets, release DB/Redis.
// Game state lives in Redis, so players reconnect to the new instance with rejoin_game.
let shuttingDown = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${sig} received, shutting down`);
    setTimeout(() => process.exit(0), 8000).unref();
    io.close(() => {
      Promise.allSettled([db.destroy(), redis.quit()]).finally(() => process.exit(0));
    });
  });
}

const PORT = parseInt(process.env.PORT || '4000', 10);
// Migrate first: the server only accepts traffic once the schema is up to date.
runMigrations().then(() => httpServer.listen(PORT, () => {
  console.log(`Checkmate backend running on port ${PORT}`);
  // Fair play: create tables/columns, then re-queue games that finished but were never analysed
  ensureFairplaySchema()
    .then(resumePendingAnalysis)
    .then(() => startHoldReleaser())
    .catch((err) => console.error('Fair play setup failed:', err));
})).catch((err) => {
  console.error('Database migration failed, not starting:', err);
  process.exit(1);
});
