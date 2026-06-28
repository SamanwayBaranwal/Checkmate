CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id   TEXT UNIQUE NOT NULL,
  wallet          TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE,
  elo             INTEGER NOT NULL DEFAULT 1200,
  games_played    INTEGER NOT NULL DEFAULT 0,
  games_won       INTEGER NOT NULL DEFAULT 0,
  usdc_balance    NUMERIC(18,6) NOT NULL DEFAULT 0,
  last_login_bonus TIMESTAMPTZ,
  login_streak    INTEGER NOT NULL DEFAULT 0,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS balance_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      NUMERIC(18,6) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('deposit','win','loss','withdrawal','fee','refund')),
  game_id     UUID,
  tx_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_white     UUID NOT NULL REFERENCES users(id),
  player_black     UUID NOT NULL REFERENCES users(id),
  bet_amount       NUMERIC(18,6) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  winner           UUID REFERENCES users(id),
  result           TEXT CHECK (result IN ('checkmate','resignation','timeout','draw')),
  pgn              TEXT,
  white_elo_before INTEGER NOT NULL,
  black_elo_before INTEGER NOT NULL,
  elo_change       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_players ON games(player_white, player_black);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON balance_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);

CREATE TABLE IF NOT EXISTS tournaments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  entry_fee    NUMERIC(18,6) NOT NULL,
  max_players  INTEGER NOT NULL CHECK (max_players IN (4, 8, 16)),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','completed','cancelled')),
  current_round INTEGER NOT NULL DEFAULT 0,
  total_rounds  INTEGER NOT NULL,
  prize_pool   NUMERIC(18,6) NOT NULL DEFAULT 0,
  winner_id    UUID REFERENCES users(id),
  created_by   UUID NOT NULL REFERENCES users(id),
  starts_at    TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  seed          INTEGER,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','eliminated','winner')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_games (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  game_id       UUID REFERENCES games(id),
  round         INTEGER NOT NULL,
  player1       UUID NOT NULL REFERENCES users(id),
  player2       UUID NOT NULL REFERENCES users(id),
  winner        UUID REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed'))
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_players ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games ON tournament_games(tournament_id, round);
