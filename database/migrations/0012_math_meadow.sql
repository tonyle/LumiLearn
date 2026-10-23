BEGIN;
ALTER TABLE game_runs DROP CONSTRAINT game_runs_game_code_check;
ALTER TABLE game_runs ADD CONSTRAINT game_runs_game_code_check CHECK(game_code IN ('flappy','dash','math20','mathfacts'));
CREATE TABLE game_math_answers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
 question_index integer NOT NULL CHECK(question_index>=0),answer integer NOT NULL CHECK(answer BETWEEN 0 AND 81),
 correct boolean NOT NULL,request_key uuid UNIQUE NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX game_math_solved ON game_math_answers(run_id,question_index) WHERE correct=true;
CREATE INDEX game_math_run ON game_math_answers(run_id,created_at DESC);
COMMIT;
