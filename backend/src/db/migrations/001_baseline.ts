// Baseline: the full schema as of Nov 2026 (pg_dump --schema-only of the dev database).
// Only runs on an EMPTY database. Existing databases (created by the old inline migrations) are
// detected in migrate.ts and this step is recorded as applied without running it.
export const name = '001_baseline';
export const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE TABLE public.balance_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(18,6) NOT NULL,
    type text NOT NULL,
    game_id uuid,
    tx_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT balance_ledger_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'win'::text, 'loss'::text, 'withdrawal'::text, 'fee'::text, 'refund'::text, 'bonus'::text, 'referral'::text, 'daily_bonus'::text, 'first_deposit_bonus'::text, 'fairplay_refund'::text, 'clawback'::text])))
);

CREATE TABLE public.fairplay_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.friends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.game_analysis (
    game_id uuid NOT NULL,
    user_id uuid NOT NULL,
    color text NOT NULL,
    rating integer NOT NULL,
    analysed_moves integer NOT NULL,
    acpl numeric(8,1) NOT NULL,
    engine_match numeric(5,1) NOT NULL,
    accuracy numeric(5,1) NOT NULL,
    blur_rate numeric(5,3) NOT NULL,
    move_time_cv numeric(6,2),
    avg_move_ms integer,
    suspicion integer NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    near_best_moves integer DEFAULT 0 NOT NULL,
    loss_sum numeric(12,1) DEFAULT 0 NOT NULL,
    blur_moves integer DEFAULT 0 NOT NULL,
    total_moves integer DEFAULT 0 NOT NULL,
    think_times jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_white uuid NOT NULL,
    player_black uuid NOT NULL,
    bet_amount numeric(18,6) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    winner uuid,
    result text,
    pgn text,
    white_elo_before integer NOT NULL,
    black_elo_before integer NOT NULL,
    elo_change integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    time_control text DEFAULT '5+0'::text NOT NULL,
    move_meta jsonb,
    analysis_status text,
    CONSTRAINT games_result_check CHECK ((result = ANY (ARRAY['checkmate'::text, 'resignation'::text, 'timeout'::text, 'draw'::text]))),
    CONSTRAINT games_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_id uuid NOT NULL,
    game_id uuid,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_notes text
);

CREATE TABLE public.tournament_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    game_id uuid,
    round integer NOT NULL,
    player1 uuid NOT NULL,
    player2 uuid NOT NULL,
    winner uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT tournament_games_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text])))
);

CREATE TABLE public.tournament_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    seed integer,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_players_status_check CHECK ((status = ANY (ARRAY['active'::text, 'eliminated'::text, 'winner'::text])))
);

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    entry_fee numeric(18,6) NOT NULL,
    max_players integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    current_round integer DEFAULT 0 NOT NULL,
    total_rounds integer NOT NULL,
    prize_pool numeric(18,6) DEFAULT 0 NOT NULL,
    winner_id uuid,
    created_by uuid NOT NULL,
    starts_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_seasonal boolean DEFAULT false NOT NULL,
    season_name text,
    season_bonus numeric(18,6) DEFAULT 0 NOT NULL,
    CONSTRAINT tournaments_max_players_check CHECK ((max_players = ANY (ARRAY[4, 8, 16]))),
    CONSTRAINT tournaments_status_check CHECK ((status = ANY (ARRAY['open'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public.user_daily_puzzles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    puzzle_date date NOT NULL,
    puzzle_id integer NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    solved boolean DEFAULT false NOT NULL,
    failed boolean DEFAULT false NOT NULL,
    xp_earned integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_identifiers (
    user_id uuid NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_puzzle_stats (
    user_id uuid NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    total_solved integer DEFAULT 0 NOT NULL,
    last_solved_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_weekly_missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    mission_key text NOT NULL,
    progress numeric(18,6) DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    rewarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    privy_user_id text NOT NULL,
    wallet text NOT NULL,
    username text,
    elo integer DEFAULT 1200 NOT NULL,
    games_played integer DEFAULT 0 NOT NULL,
    games_won integer DEFAULT 0 NOT NULL,
    usdc_balance numeric(18,6) DEFAULT 0 NOT NULL,
    last_login_bonus timestamp with time zone,
    login_streak integer DEFAULT 0 NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    referral_code text,
    referred_by uuid,
    banned_at timestamp with time zone,
    ban_reason text,
    fairplay_status text DEFAULT 'clean'::text NOT NULL,
    fairplay_score integer DEFAULT 0 NOT NULL,
    fairplay_flagged_games integer DEFAULT 0 NOT NULL,
    fairplay_cleared_at timestamp with time zone,
    fairplay_updated_at timestamp with time zone,
    fairplay_reasons jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.winnings_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_id uuid,
    amount numeric(18,6) NOT NULL,
    status text DEFAULT 'held'::text NOT NULL,
    reason text,
    release_at timestamp with time zone NOT NULL,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.balance_ledger
    ADD CONSTRAINT balance_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fairplay_actions
    ADD CONSTRAINT fairplay_actions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_friend_id_key UNIQUE (user_id, friend_id);

ALTER TABLE ONLY public.game_analysis
    ADD CONSTRAINT game_analysis_pkey PRIMARY KEY (game_id, user_id);

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT tournament_players_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT tournament_players_tournament_id_user_id_key UNIQUE (tournament_id, user_id);

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_daily_puzzles
    ADD CONSTRAINT user_daily_puzzles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_daily_puzzles
    ADD CONSTRAINT user_daily_puzzles_user_id_puzzle_date_key UNIQUE (user_id, puzzle_date);

ALTER TABLE ONLY public.user_identifiers
    ADD CONSTRAINT user_identifiers_pkey PRIMARY KEY (user_id, kind, value);

ALTER TABLE ONLY public.user_puzzle_stats
    ADD CONSTRAINT user_puzzle_stats_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_weekly_missions
    ADD CONSTRAINT user_weekly_missions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_weekly_missions
    ADD CONSTRAINT user_weekly_missions_user_id_week_start_mission_key_key UNIQUE (user_id, week_start, mission_key);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_privy_user_id_key UNIQUE (privy_user_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_wallet_key UNIQUE (wallet);

ALTER TABLE ONLY public.winnings_holds
    ADD CONSTRAINT winnings_holds_pkey PRIMARY KEY (id);

CREATE INDEX idx_friends_friend ON public.friends USING btree (friend_id);

CREATE INDEX idx_friends_user ON public.friends USING btree (user_id);

CREATE INDEX idx_games_players ON public.games USING btree (player_white, player_black);

CREATE INDEX idx_games_status ON public.games USING btree (status);

CREATE INDEX idx_ledger_user ON public.balance_ledger USING btree (user_id, created_at DESC);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX idx_reports_reported ON public.reports USING btree (reported_id, created_at DESC);

CREATE INDEX idx_reports_status ON public.reports USING btree (status, created_at DESC);

CREATE INDEX idx_tournament_games ON public.tournament_games USING btree (tournament_id, round);

CREATE INDEX idx_tournament_players ON public.tournament_players USING btree (tournament_id);

CREATE INDEX idx_tournaments_status ON public.tournaments USING btree (status);

CREATE INDEX idx_user_daily_puzzles_user ON public.user_daily_puzzles USING btree (user_id, puzzle_date DESC);

CREATE INDEX idx_user_weekly_missions_user ON public.user_weekly_missions USING btree (user_id, week_start);

CREATE INDEX idx_users_elo ON public.users USING btree (elo DESC);

CREATE UNIQUE INDEX idx_users_referral_code ON public.users USING btree (referral_code) WHERE (referral_code IS NOT NULL);

CREATE INDEX user_identifiers_kind_value ON public.user_identifiers USING btree (kind, value);

CREATE INDEX winnings_holds_user_status ON public.winnings_holds USING btree (user_id, status);

ALTER TABLE ONLY public.balance_ledger
    ADD CONSTRAINT balance_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.fairplay_actions
    ADD CONSTRAINT fairplay_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.game_analysis
    ADD CONSTRAINT game_analysis_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);

ALTER TABLE ONLY public.game_analysis
    ADD CONSTRAINT game_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_player_black_fkey FOREIGN KEY (player_black) REFERENCES public.users(id);

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_player_white_fkey FOREIGN KEY (player_white) REFERENCES public.users(id);

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_winner_fkey FOREIGN KEY (winner) REFERENCES public.users(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_id_fkey FOREIGN KEY (reported_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_player1_fkey FOREIGN KEY (player1) REFERENCES public.users(id);

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_player2_fkey FOREIGN KEY (player2) REFERENCES public.users(id);

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);

ALTER TABLE ONLY public.tournament_games
    ADD CONSTRAINT tournament_games_winner_fkey FOREIGN KEY (winner) REFERENCES public.users(id);

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT tournament_players_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);

ALTER TABLE ONLY public.tournament_players
    ADD CONSTRAINT tournament_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_daily_puzzles
    ADD CONSTRAINT user_daily_puzzles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_identifiers
    ADD CONSTRAINT user_identifiers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_puzzle_stats
    ADD CONSTRAINT user_puzzle_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_weekly_missions
    ADD CONSTRAINT user_weekly_missions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.winnings_holds
    ADD CONSTRAINT winnings_holds_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);

ALTER TABLE ONLY public.winnings_holds
    ADD CONSTRAINT winnings_holds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
`;
