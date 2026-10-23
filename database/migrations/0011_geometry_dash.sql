BEGIN;
ALTER TABLE game_runs ADD COLUMN game_code text NOT NULL DEFAULT 'flappy' CHECK(game_code IN ('flappy','dash'));
CREATE INDEX game_scores_by_game ON game_runs(game_code,score DESC) WHERE ended_at IS NOT NULL;
COMMIT;
