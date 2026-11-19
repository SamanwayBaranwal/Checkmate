// Money-safety constraints and missing indexes found in the launch audit.
export const name = '003_integrity';
export const statements: string[] = [
  // A balance can never go below zero. NOT VALID: enforced for every new write, old rows aren't re-checked.
  `DO $$ BEGIN
     ALTER TABLE users ADD CONSTRAINT users_balance_nonnegative CHECK (usdc_balance >= 0) NOT VALID;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // The same on-chain deposit can only ever be credited once (deposit watcher restarts, retries).
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_deposit_tx ON balance_ledger(tx_hash) WHERE type = 'deposit' AND tx_hash IS NOT NULL`,
  // Lookups that were full table scans
  `CREATE INDEX IF NOT EXISTS idx_games_black ON games(player_black)`,
  `CREATE INDEX IF NOT EXISTS idx_games_analysis_status ON games(analysis_status) WHERE analysis_status IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_tournament_games_game ON tournament_games(game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_holds_release ON winnings_holds(status, release_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_game ON balance_ledger(game_id) WHERE game_id IS NOT NULL`,
];
