# Checkmate — Betting Chess Platform

Real-time chess with USDC wagering on Base. ELO rating system. Spectator support. Built with Next.js + Node.js + Socket.io.

---

## Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Privy auth, react-chessboard
- **Backend**: Node.js, Express, Socket.io, chess.js (server-authoritative)
- **Database**: PostgreSQL (balances, games, ELO) + Redis (matchmaking queue, game state, challenges)
- **Chain**: Base (USDC deposits/withdrawals only — bets settled off-chain instantly)
- **Auth**: Privy (email/Google/wallet login + embedded wallets)

---

## Quick Start

### 1. Start databases
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Fill in .env (see Environment Variables below)
npm install
npm run dev
# Runs on http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Fill in .env.local (see Environment Variables below)
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (Upstash or local) |
| `JWT_SECRET` | Random string for JWT signing |
| `PRIVY_APP_ID` | From Privy dashboard |
| `PRIVY_APP_SECRET` | From Privy dashboard |
| `PLATFORM_WALLET_ADDRESS` | Hot wallet that receives USDC deposits |
| `PLATFORM_WALLET_PRIVATE_KEY` | Hot wallet private key (for withdrawals) |
| `BASE_RPC_URL` | Base RPC endpoint (e.g. Alchemy) |
| `USDC_CONTRACT_ADDRESS` | USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `FRONTEND_URL` | Frontend origin for CORS (default: http://localhost:3000) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | From Privy dashboard |
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:4000) |

---

## Game Flow
1. User logs in via Privy (email, Google, or wallet)
2. User deposits USDC to platform wallet address (shown in /wallet)
3. Backend detects deposit via viem `watchContractEvent` on Base, credits DB balance
4. User selects bet tier ($1/$5/$10/$25) and enters matchmaking queue
5. Backend pairs two players from queue → deducts bets from both balances atomically
6. Real-time chess via Socket.io — all moves validated server-side with chess.js
7. Winner credited instantly (pot × 97.5%); 2.5% platform fee logged in balance_ledger
8. ELO updated using K-factor system (K=32 below 2400, K=16 above)

---

## Features Built ✅

### Gameplay
- Live chess with server-authoritative move validation
- 5-minute blitz clock (server-enforced)
- Resign, draw offer/accept, rematch
- Game replay (move-by-move PGN viewer)
- Spectator mode (watch live games read-only)
- In-game chat (real-time, per game room)
- 1v1 challenge by username (with bet amount selector)
- Board themes (5 themes, persisted to settings)
- Sound effects (move, capture, check, win, lose, draw, clock warning)
- Auto-promote to queen toggle
- Move history panel in game

### Social & Matchmaking
- Random matchmaking queue by bet tier
- 1v1 direct challenge — search by username, select bet, send/accept/decline
- Challenge notification overlay in Navbar (with Accept/Decline)
- Share result card after game (native share API + clipboard fallback)

### Profile & Leaderboard
- Public profile page (ELO, win rate, games played, earnings, badges)
- Achievement badges (First Win, Veteran, Grinder, Sharp, Rising Star, Elite, Earner)
- Recent games table with replay links
- Leaderboard: By Rating / By Earnings / This Week tabs
- Top 3 gold/silver/bronze medals
- Your rank highlighted in green

### Wallet
- USDC deposit (show platform address with memo)
- Withdraw USDC to any address
- Transaction history (deposits, wins, losses, withdrawals)
- Balance shown in navbar

### Settings
- Username change (3-20 chars, alphanumeric + underscore)
- Board theme picker
- Auto-promote to queen toggle
- Show/hide earnings on public profile

### Bonuses
- Daily login bonus ($0.10 per day, 20-hour cooldown)
- Login streak tracker (shown on claim toast)

---

## Features Remaining ❌

### Gameplay
- Pre-move (queue move before opponent finishes)
- Piece themes (different chess piece designs)

### Tournaments (all)
- Create/join tournament, bracket UI, prize pool, lobby, auto-pairing, results/payouts

### Profile
- Stats by time control (win rate per 3/5/10 min, best streak, avg earnings)
- Avatar selection

### Leaderboard
- Weekly leaderboard (auto-resets Monday)

### Social
- Friend system (add friends, online status, friend leaderboard)

### Notifications
- Tournament starting soon, friend joined, weekly earnings summary

### Daily Puzzles (all)
- Free daily puzzle, streak tracker, difficulty levels, XP reward

### Learn Section (all)
- Piece tutorials, openings guide, tactics, Ash mascot, XP system

### Wallet extras
- Earnings breakdown chart (winnings vs deposits)
- Weekly earnings chart
- Bonus balance (separate from real balance)
- Referral earnings tracker

### Referral Program (all)
- Unique referral link, 10% lifetime cut of referee winnings, referral leaderboard

### Trust & Safety (all)
- Report player, manual review queue, appeals, ban log, fair play certificate

### Settings
- Notification preferences
- Delete account
- 2FA

### Mobile / PWA (all)
- Fully responsive layout
- Touch-optimized chess board
- PWA (add-to-home-screen)

### Bonuses & Retention
- First deposit bonus (50% match up to $10)
- Win streak bonus (extra % on 5+ streak)
- Weekly missions
- Seasonal tournaments

### Discovery
- Recently played opponents (quick rematch list)
- Suggested opponents (similar ELO + stake)

---

## Architecture Notes

### Balance System
- Fully custodial — no per-game blockchain transactions
- All bets reserved at game start via Postgres transaction
- `balance_ledger` table logs every credit/debit with type + game_id
- Withdrawal sends USDC from platform hot wallet via viem `writeContract`

### Real-time
- Socket.io rooms per game — `game:{gameId}`
- `userSocketMap` (in-memory Map) tracks userId → socketId for challenge routing
- Redis key `challenge:{challengeId}` with 60s TTL for pending challenges
- Redis key `game:{gameId}:*` for FEN, clocks, spectators

### Security
- All moves validated server-side; client can never trigger payout
- Atomic Postgres transactions for bet reservation and settlement
- JWT tokens signed with `JWT_SECRET`, 7-day expiry
- Platform private key must be in a secrets manager in production — never commit it

### Auto-migrations
On startup `index.ts` runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for any new columns, so the running DB stays in sync without a migration runner.
