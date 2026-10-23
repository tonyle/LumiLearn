CREATE TABLE game_math_races(
 run_id uuid PRIMARY KEY REFERENCES game_runs(id) ON DELETE CASCADE,
 state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
