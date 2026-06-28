import 'dotenv/config';
import express from 'express';
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

import { setupMatchmaking, registerUser, unregisterUser } from './socket/matchmaking';
import { setupGameRoom, startTimeoutChecker, registerGamePlayer } from './socket/gameRoom';
import { setupSpectator } from './socket/spectator';
import { setupChallenge, setUserSocket, removeUserSocket } from './socket/challenge';
import { setupTournament } from './socket/tournament';
import { startDepositWatcher } from './services/deposit';
import { addOnlineSocket, removeOnlineSocket } from './services/onlineUsers';
import { setIo } from './services/notifications';
import { db } from './db/client';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/games', gamesRouter);
app.use('/api/users', usersRouter);
app.use('/api/dev', devRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/missions', missionsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

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

io.on('connection', async (socket) => {
  const userId = (socket as any).userId as string | undefined;

  if (userId) {
    const user = await db('users').where({ id: userId }).select('elo', 'wallet').first();
    if (user) {
      registerUser(socket.id, { userId, wallet: user.wallet, elo: user.elo });
      setUserSocket(userId, socket.id);
      (socket as any).userId = userId;
      addOnlineSocket(userId, socket.id);
      socket.join(`user:${userId}`);
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
      removeUserSocket(userId);
      removeOnlineSocket(userId, socket.id);
    }
  });
});

setIo(io);
startTimeoutChecker(io);
startDepositWatcher();

// Auto-migrate: add new columns and tables if missing
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_bonus TIMESTAMPTZ`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id)`).catch(() => {});
db.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL`).catch(() => {});
// Widen balance_ledger type constraint to include bonus and referral types
db.raw(`ALTER TABLE balance_ledger DROP CONSTRAINT IF EXISTS balance_ledger_type_check`).catch(() => {});
db.raw(`ALTER TABLE balance_ledger ADD CONSTRAINT balance_ledger_type_check CHECK (type IN ('deposit','win','loss','withdrawal','fee','refund','bonus','referral'))`).catch(() => {});
db.raw(`
  CREATE TABLE IF NOT EXISTS friends (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
  )
`).catch(() => {});
db.raw(`CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id)`).catch(() => {});
db.raw(`CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id)`).catch(() => {});
db.raw(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    entry_fee NUMERIC(18,6) NOT NULL,
    max_players INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    current_round INTEGER NOT NULL DEFAULT 0,
    total_rounds INTEGER NOT NULL,
    prize_pool NUMERIC(18,6) NOT NULL DEFAULT 0,
    winner_id UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(() => {});
db.raw(`
  CREATE TABLE IF NOT EXISTS tournament_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    user_id UUID NOT NULL REFERENCES users(id),
    seed INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
  )
`).catch(() => {});
db.raw(`
  CREATE TABLE IF NOT EXISTS tournament_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    game_id UUID REFERENCES games(id),
    round INTEGER NOT NULL,
    player1 UUID NOT NULL REFERENCES users(id),
    player2 UUID NOT NULL REFERENCES users(id),
    winner UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending'
  )
`).catch(() => {});

db.raw(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    message    TEXT NOT NULL,
    read       BOOLEAN NOT NULL DEFAULT false,
    metadata   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).catch(() => {});
db.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`).catch(() => {});
db.raw(`
  CREATE TABLE IF NOT EXISTS user_weekly_missions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,
    mission_key TEXT NOT NULL,
    progress    NUMERIC(18,6) NOT NULL DEFAULT 0,
    completed   BOOLEAN NOT NULL DEFAULT false,
    rewarded    BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start, mission_key)
  )
`).catch(() => {});
db.raw(`CREATE INDEX IF NOT EXISTS idx_user_weekly_missions_user ON user_weekly_missions(user_id, week_start)`).catch(() => {});

const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
  console.log(`Checkmate backend running on port ${PORT}`);
});
