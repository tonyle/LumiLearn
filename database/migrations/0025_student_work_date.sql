BEGIN;
ALTER TABLE paper_pages ADD COLUMN student_worked_at timestamptz;
-- Historical submission time is known; drafts use their last available saved timestamp.
UPDATE paper_pages p SET student_worked_at=coalesce((SELECT max(r.created_at) FROM paper_runs r WHERE r.page_id=p.id),p.updated_at);
CREATE INDEX paper_pages_student_worked_at ON paper_pages(student_worked_at);
COMMIT;
