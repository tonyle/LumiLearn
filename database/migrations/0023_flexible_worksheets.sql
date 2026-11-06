BEGIN;
-- Keep a bounded worksheet payload while removing the old ten-question lesson rule.
CREATE OR REPLACE FUNCTION enforce_lesson_question_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM assignments WHERE id=NEW.assignment_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM assignment_questions WHERE assignment_id=NEW.assignment_id AND question_version_id=NEW.question_version_id)
 AND EXISTS(SELECT 1 FROM assignments WHERE id=NEW.assignment_id AND state<>'closed')
 AND (SELECT count(*) FROM assignment_questions WHERE assignment_id=NEW.assignment_id AND (TG_OP='INSERT' OR question_version_id<>OLD.question_version_id))>=200 THEN
  RAISE EXCEPTION 'WORKSHEET_QUESTION_LIMIT: a worksheet can contain at most 200 questions';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION enforce_assigned_lesson_size() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state='assigned' AND (SELECT count(*) FROM assignment_questions WHERE assignment_id=NEW.id)>200 THEN RAISE EXCEPTION 'WORKSHEET_QUESTION_LIMIT'; END IF;
 RETURN NEW;
END; $$;
COMMIT;
