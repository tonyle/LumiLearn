BEGIN;
CREATE TABLE paper_pages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
 page_index int NOT NULL CHECK(page_index>=0),
 revision int NOT NULL DEFAULT 0,
 draft jsonb NOT NULL DEFAULT '{}'::jsonb,
 results jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','processing','graded','needs_review','failed')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(submission_id,page_index)
);
CREATE TABLE paper_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 page_id uuid NOT NULL REFERENCES paper_pages(id) ON DELETE CASCADE,
 idempotency_key text NOT NULL,
 revision int NOT NULL,
 state text NOT NULL DEFAULT 'processing' CHECK(state IN ('processing','succeeded','failed')),
 snapshot_png bytea,
 results jsonb NOT NULL DEFAULT '[]'::jsonb,
 model text,
 input_tokens int, output_tokens int,
 reserved_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(page_id,idempotency_key)
);
CREATE INDEX paper_runs_monthly ON paper_runs(created_at);
COMMIT;
