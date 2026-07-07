# ♟ Checkmate — Betting Chess Platform

Real-time chess where players wager and win, climb an ELO leaderboard, enter tournaments, solve daily puzzles, and more. Currently running in **free-credits mode** (crypto payments hidden) so anyone can play instantly.

**Live:**
- App (frontend): https://frontend-six-blond-19.vercel.app
- API (backend): https://checkmate-api-production-36ff.up.railway.app
- Admin panel: `/admin` (password-gated)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Plus Jakarta Sans + Inter fonts |
| Auth | Privy (email / Google / wallet + embedded wallets) |
| Board | react-chessboard + chess.js (client) |
| Backend | Node.js, Express, Socket.io, chess.js (server-authoritative) |
| Database | PostgreSQL (users, games, balances, tournaments…) + Redis (matchmaking, live game state, challenges) |
| Chain | Base / USDC — deposit & withdraw only (currently hidden; play uses free credits) |
| Hosting | Frontend → **Vercel**, Backend + Postgres + Redis → **Railway** |

---

## Local Development

### 1. Databases
```bash
docker-compose up -d          # Postgres + Redis
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # fill in values (see below)
npm install
npm run dev                   # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local    # fill in values
npm install
npm run dev                   # http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (auto-set on Railway) |
| `REDIS_URL` | Redis connection string (auto-set on Railway) |
| `JWT_SECRET` | Random string for signing session JWTs |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | From the Privy dashboard |
| `ADMIN_SECRET` | Password for the `/admin` panel |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated. `*.vercel.app` is always allowed |
| `NODE_ENV` | `production` in deploy |
| `PLATFORM_WALLET_ADDRESS` / `PLATFORM_WALLET_PRIVATE_KEY` / `BASE_RPC_URL` | Crypto deposit/withdraw — **leave blank to keep crypto disabled** |
| `USDC_CONTRACT_ADDRESS` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | From the Privy dashboard |
| `NEXT_PUBLIC_API_URL` | Backend URL (Railway) |
| `NEXT_PUBLIC_WS_URL` | Same backend URL (Socket.io) |

> ⚠️ Never commit real secrets. `.env` / `.env.local` are gitignored; only `.env.example` is tracked.

---

## Deployment

**Frontend (Vercel)** — from `frontend/`:
```bash
vercel --prod
```
Env vars (`NEXT_PUBLIC_*`) are set on the Vercel project.

**Backend (Railway)** — from `backend/`:
```bash
railway up
```
The service links to Railway's Postgres + Redis via `${{Postgres.DATABASE_URL}}` / `${{Redis.REDIS_URL}}`.

> The DB schema auto-migrates on boot (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `index.ts`), so deploys need no migration runner. On a brand-new database, run `backend/src/db/schema.sql` once.

---

## Free-Credits Mode (current)

Crypto payments are hidden so anyone can play immediately:
- Wallet page shows **Claim $10 starter** (once per user) and **$5 top-up** (daily, when balance < $1) instead of deposit/withdraw.
- All "USDC" is internal DB balance — no blockchain transactions occur.
- To re-enable crypto later: restore the deposit/withdraw UI in `frontend/src/app/wallet/page.tsx` and set the `PLATFORM_WALLET_*` env vars.

---

## Feature Map (all built & live ✅)

**Core chess** — server-authoritative moves, 5-min blitz clock, resign, draw, rematch, pre-moves, tap-to-move (mobile) + drag (desktop), legal-move dots, last-move highlight, captured-pieces + material advantage, spectator mode, in-game chat, game replay (PGN).

**In-game controls** — flip board, sound toggle, board themes (5), piece styles (4), offer draw, resign, report opponent. Board auto-fits the viewport (no scrolling on any device).

**Matchmaking & betting** — queue by tier ($1/$5/$10/$25), 1v1 challenge by profile or friends list, atomic bet settlement, 2.5% platform fee (winner takes 97.5%).

**ELO & leaderboard** — K-factor system (32 <2400, 16 ≥2400); leaderboard tabs: Rating / Earnings / Weekly / Referrals.

**Profiles** — stats, achievement badges, fair-play certificate (🛡️), recent games, challenge button, earnings privacy toggle.

**Friends** — requests, accept/remove, online status, friend leaderboard, challenge directly from list.

**Tournaments** — single-elimination brackets (4/8/16), entry fees, prize pool, live bracket updates, seasonal (admin-created) tournaments.

**Engagement** — daily puzzles (15 rotating, streak + XP + reward), weekly missions, achievement badges, daily login bonus, win-streak bonus, first-deposit bonus.

**Learn** — Basics / Openings / Tactics / Endgames with interactive boards + localStorage progress.

**Notifications** — in-app bell (real-time), 7 opt-out preference toggles, weekly earnings cron (Mon 09:00 UTC).

**Settings** — username, board/piece themes, auto-queen, earnings privacy, notification prefs, linked accounts / 2FA (Privy), delete account.

**Admin & moderation** — `/admin` password panel: reports queue, ban/unban, banned-users log, user search, platform stats. Ban enforcement on login.

**Referrals** — unique code + link, referral earnings, referral leaderboard tab.

**Mobile / PWA** — installable, bottom tab bar (Home / Ranks / Play / Wallet / More sheet), responsive throughout, haptic feedback in-game, safe-area handling.

---

## Project Structure

```
Checkmate/
├── backend/
│   ├── railway.json                 # Railway deploy config
│   └── src/
│       ├── index.ts                 # Express + Socket.io + auto-migrations
│       ├── middleware/auth.ts       # JWT verify
│       ├── routes/                  # auth, users, wallet, games, friends,
│       │                            #   tournaments, missions, puzzles,
│       │                            #   notifications, reports, admin, dev
│       ├── socket/                  # matchmaking, gameRoom, spectator,
│       │                            #   challenge, tournament
│       ├── services/                # balance, elo, chess, deposit, cron,
│       │                            #   notifications, onlineUsers
│       └── db/{client,redis,schema.sql}
└── frontend/
    ├── vercel.json
    └── src/
        ├── app/                     # routes: /, game, wallet, leaderboard,
        │                            #   tournaments, puzzle, learn, missions,
        │                            #   friends, profile, settings, admin, replay
        ├── components/              # Navbar, BottomNav, MainShell,
        │                            #   ChessClock, CapturedPieces, MoveHistory,
        │                            #   LiveGameCard, GameOverModal, …
        ├── hooks/useChessGame.ts    # socket game state + optimistic moves
        └── lib/{api,socket,sounds,privy,pieceThemes}.ts
```

---

## Architecture Notes

**Custodial balance** — no per-game blockchain tx. Bets reserved at game start via a Postgres transaction; `balance_ledger` logs every credit/debit with `type` + `game_id`. Withdrawal (when enabled) sends USDC from the platform hot wallet via viem.

**Real-time** — Socket.io rooms per game (`game:{id}`). In-memory maps hold live player/socket registration; Redis holds FEN, clocks, spectators, and pending challenges (60s TTL). The client re-emits `rejoin_game` on every reconnect so a changed socket id never rejects moves.

**Low latency** — the move handler validates from Redis and **broadcasts before persisting**; the client applies moves **optimistically** so your own move renders instantly and the server echo reconciles.

**Resilience** — process-level `unhandledRejection` / `uncaughtException` guards keep one bad query from crashing the server. `tsc --noCheck` build avoids third-party (`viem`/`ox`) type noise.

**Security** — every move is validated server-side; the client can never trigger a payout. JWTs signed with `JWT_SECRET` (7-day expiry). Admin routes gated by `x-admin-secret`. Banned accounts blocked at login.

---

## Admin

Open `/admin`, enter `ADMIN_SECRET`. Review reports, ban/unban players, search users, view platform stats. Not linked in the app nav — reach it by URL only.

---

## Roadmap / Next (frontend polish)

- Skeleton loaders (replace "Loading…" text)
- Win confetti + animated ELO / balance counters
- Dedicated logged-out landing page
- Move-navigation arrows to step through a game while reviewing
- Per-page bespoke redesigns (wallet, leaderboard, profile, tournaments)
- Unified custom icon set (replace remaining emoji)
