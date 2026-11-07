CREATE TABLE reading_book_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),book_id uuid REFERENCES reading_books(id) ON DELETE SET NULL,
 definition jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,deleted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reading_book_activity_states (
 activity_id uuid NOT NULL REFERENCES reading_book_activities(id),student_id uuid NOT NULL REFERENCES students(id),
 revision integer NOT NULL DEFAULT 0,activity_revision integer NOT NULL,draft jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(activity_id,student_id)
);
CREATE TABLE reading_book_activity_attempts (
 id uuid PRIMARY KEY,activity_id uuid NOT NULL REFERENCES reading_book_activities(id),student_id uuid NOT NULL REFERENCES students(id),
 state text NOT NULL CHECK(state IN ('processing','ready','needs_review','failed')),draft jsonb NOT NULL,activity_snapshot jsonb NOT NULL,
 page_snapshot jsonb NOT NULL,submission_hash text NOT NULL,results jsonb NOT NULL DEFAULT '[]',earned numeric NOT NULL DEFAULT 0,maximum integer NOT NULL,
 reserved_cost_usd numeric NOT NULL DEFAULT .10,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz
);
CREATE INDEX reading_activity_attempt_history ON reading_book_activity_attempts(activity_id,student_id,created_at);
CREATE INDEX reading_activity_budget ON reading_book_activity_attempts(created_at);
CREATE TABLE reading_book_activity_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attempt_id uuid NOT NULL REFERENCES reading_book_activity_attempts(id),
 parent_id uuid NOT NULL REFERENCES parents(id),results jsonb NOT NULL,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reading_activity_reviews ON reading_book_activity_reviews(attempt_id,created_at DESC);
