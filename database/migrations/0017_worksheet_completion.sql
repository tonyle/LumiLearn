BEGIN;
ALTER TABLE submissions ADD COLUMN grading_attempt_offset int NOT NULL DEFAULT 0 CHECK(grading_attempt_offset>=0);
-- Apply the two-grading limit to existing ten-question worksheets too.
UPDATE submissions s SET status='completed',completed_at=coalesce(s.completed_at,s.submitted_at,now())
WHERE s.status<>'completed'
AND (SELECT count(*) FROM assignment_questions aq WHERE aq.assignment_id=s.assignment_id)=10
AND (SELECT count(*) FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id WHERE p.submission_id=s.id AND r.state='succeeded')>=2
AND NOT EXISTS(SELECT 1 FROM paper_pages p WHERE p.submission_id=s.id AND p.status='processing');
COMMIT;
