BEGIN;
-- Preserve learner levels and totals; a 3x3 round cannot continue under connect-five rules.
UPDATE tic_tac_progress SET state=state || jsonb_build_object(
 'board',(SELECT jsonb_agg('null'::jsonb) FROM generate_series(1,81)),
 'outcome',jsonb_build_object('winner',null,'draw',false,'line','[]'::jsonb),
 'lastHuman',null,'lastBot',null,
 'message','Welcome to the 9 × 9 board. Connect five to win!',
 'version',COALESCE((state->>'version')::int,0)+1
),updated_at=now() WHERE jsonb_array_length(state->'board')=9;
COMMIT;
