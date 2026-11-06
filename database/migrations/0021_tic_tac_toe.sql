BEGIN;
ALTER TABLE game_runs DROP CONSTRAINT game_runs_game_code_check;
ALTER TABLE game_runs ADD CONSTRAINT game_runs_game_code_check CHECK(game_code IN ('flappy','dash','math20','mathfacts','magic','ttt'));
CREATE TABLE tic_tac_progress(student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,state jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE game_ttt_runs(run_id uuid PRIMARY KEY REFERENCES game_runs(id) ON DELETE CASCADE);
CREATE TABLE game_ttt_actions(run_id uuid NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,request_key uuid NOT NULL,payload_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,request_key));
COMMIT;
