BEGIN;
CREATE TABLE game_wallets (
 student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
 points integer NOT NULL DEFAULT 0 CHECK(points>=0),
 seconds integer NOT NULL DEFAULT 0 CHECK(seconds>=0),
 enabled boolean NOT NULL DEFAULT true,
 reward_points integer NOT NULL DEFAULT 10 CHECK(reward_points BETWEEN 0 AND 100),
 seconds_per_point integer NOT NULL DEFAULT 60 CHECK(seconds_per_point BETWEEN 10 AND 300),
 daily_limit_minutes integer NOT NULL DEFAULT 30 CHECK(daily_limit_minutes BETWEEN 1 AND 120)
);
CREATE TABLE game_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('worksheet','exchange','adjustment')),
 points integer NOT NULL,seconds integer NOT NULL DEFAULT 0,
 assignment_id uuid REFERENCES assignments(id),request_key uuid UNIQUE,
 note text NOT NULL DEFAULT '',parent_id uuid REFERENCES parents(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(student_id,assignment_id)
);
CREATE TABLE game_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 seed integer NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 reserved_seconds integer NOT NULL CHECK(reserved_seconds BETWEEN 1 AND 300),
 ended_at timestamptz,used_seconds integer,score integer NOT NULL DEFAULT 0 CHECK(score>=0),
 request_key uuid NOT NULL UNIQUE
);
CREATE UNIQUE INDEX game_one_active_run ON game_runs(student_id) WHERE ended_at IS NULL;
CREATE INDEX game_student_runs ON game_runs(student_id,started_at DESC);
CREATE INDEX game_leaderboard ON game_runs(score DESC) WHERE ended_at IS NOT NULL;
CREATE INDEX game_student_ledger ON game_ledger(student_id,created_at DESC);
COMMIT;
