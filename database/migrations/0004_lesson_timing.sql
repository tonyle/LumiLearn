BEGIN;
CREATE TABLE study_clocks (
 assignment_id uuid NOT NULL,
 student_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'paused' CHECK(state IN ('paused','running','submitted')),
 elapsed_ms bigint NOT NULL DEFAULT 0 CHECK(elapsed_ms>=0),
 started_at timestamptz,
 running_since timestamptz,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(assignment_id,student_id),
 FOREIGN KEY(assignment_id,student_id) REFERENCES assignment_students(assignment_id,student_id) ON DELETE CASCADE
);
ALTER TABLE paper_runs ADD COLUMN duration_ms bigint CHECK(duration_ms>=0);
ALTER TABLE assignments ADD COLUMN source_assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN lesson_number int;
CREATE UNIQUE INDEX assignments_source_lesson ON assignments(source_assignment_id,lesson_number) WHERE source_assignment_id IS NOT NULL;
CREATE FUNCTION enforce_lesson_question_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM assignments WHERE id=NEW.assignment_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM assignment_questions WHERE assignment_id=NEW.assignment_id AND question_version_id=NEW.question_version_id) AND EXISTS(SELECT 1 FROM assignments WHERE id=NEW.assignment_id AND state<>'closed') AND (SELECT count(*) FROM assignment_questions WHERE assignment_id=NEW.assignment_id AND (TG_OP='INSERT' OR question_version_id<>OLD.question_version_id))>=10 THEN
  RAISE EXCEPTION 'LESSON_QUESTION_LIMIT: a lesson can contain at most ten questions';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER assignment_question_limit BEFORE INSERT OR UPDATE ON assignment_questions FOR EACH ROW EXECUTE FUNCTION enforce_lesson_question_limit();
CREATE FUNCTION enforce_assigned_lesson_size() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state='assigned' AND (SELECT count(*) FROM assignment_questions WHERE assignment_id=NEW.id)>10 THEN RAISE EXCEPTION 'LESSON_QUESTION_LIMIT'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER assignment_size_on_publish BEFORE UPDATE OF state ON assignments FOR EACH ROW EXECUTE FUNCTION enforce_assigned_lesson_size();
COMMIT;
