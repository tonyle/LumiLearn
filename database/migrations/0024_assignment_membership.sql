BEGIN;
ALTER TABLE assignment_students ADD COLUMN unassigned_at timestamptz;
CREATE INDEX assignment_students_active_student ON assignment_students(student_id,assignment_id) WHERE unassigned_at IS NULL;
COMMIT;
