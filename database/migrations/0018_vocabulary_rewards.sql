BEGIN;
ALTER TABLE game_ledger DROP CONSTRAINT game_ledger_kind_check;
ALTER TABLE game_ledger ADD CONSTRAINT game_ledger_kind_check CHECK(kind IN ('worksheet','vocabulary','exchange','adjustment'));
ALTER TABLE game_ledger ADD COLUMN vocab_lesson_id uuid REFERENCES vocab_lessons(id);
CREATE UNIQUE INDEX game_vocabulary_reward_once ON game_ledger(student_id,vocab_lesson_id) WHERE vocab_lesson_id IS NOT NULL;
COMMIT;
