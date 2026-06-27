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

import { setupMatchmaking, registerUser, unregisterUser } from './socket/matchmaking';
import { setupGameRoom, startTimeoutChecker, registerGamePlayer } from './socket/gameRoom';
import { setupSpectator } from './socket/spectator';
import { setupChallenge, setUserSocket, removeUserSocket } from './socket/challenge';
import { startDepositWatcher } from './services/deposit';
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
    }
  }

  setupMatchmaking(io, socket);
  setupGameRoom(io, socket);
  setupSpectator(io, socket);
  setupChallenge(io, socket);

  socket.on('disconnect', () => {
    unregisterUser(socket.id);
    if (userId) removeUserSocket(userId);
  });
});

startTimeoutChecker(io);
startDepositWatcher();

// Auto-migrate: add new columns if missing
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_bonus TIMESTAMPTZ`).catch(() => {});
db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0`).catch(() => {});

const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
  console.log(`Checkmate backend running on port ${PORT}`);
});
