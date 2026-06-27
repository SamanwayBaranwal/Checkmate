# Checkmate — Betting Chess Platform

Real-time chess with USDC wagering on Base. ELO rating system. Spectator support.

## Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind, Privy auth, react-chessboard
- **Backend**: Node.js, Express, Socket.io, chess.js
- **Database**: PostgreSQL + Redis
- **Chain**: Base (USDC deposits/withdrawals only — bets settled off-chain instantly)

## Quick Start

### 1. Start databases
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Fill in PRIVY_APP_SECRET, JWT_SECRET, PLATFORM_WALLET_* in .env
npm install
npm run db:migrate
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_PRIVY_APP_ID in .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

### Backend (.env)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Random secret for JWT signing |
| `PRIVY_APP_ID` | From Privy dashboard |
| `PRIVY_APP_SECRET` | From Privy dashboard |
| `PLATFORM_WALLET_ADDRESS` | Your hot wallet address (receives USDC deposits) |
| `PLATFORM_WALLET_PRIVATE_KEY` | Hot wallet private key (for withdrawals) |
| `BASE_RPC_URL` | Base RPC endpoint (e.g. Alchemy) |
| `USDC_CONTRACT_ADDRESS` | USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Frontend (.env.local)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | From Privy dashboard |
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:4000) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (default: http://localhost:4000) |

## Game Flow
1. User logs in via Privy (email, Google, or wallet)
2. User deposits USDC to the platform wallet address (shown in /wallet)
3. User selects a bet tier ($1/$5/$10/$25) and enters matchmaking
4. Backend pairs two players, deducts bets from both balances
5. Real-time chess via Socket.io — all moves validated server-side
6. Winner's balance credited instantly (pot × 97.5%); 2.5% platform fee
7. ELO updated in database

## Security Notes
- All moves validated server-side with chess.js; clients cannot cheat
- Balances updated atomically via Postgres transactions
- JWT tokens expire after 7 days
- Platform hot wallet private key should be stored in a secrets manager in production
