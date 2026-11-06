CREATE TABLE reading_translation_cache (
 cache_key text PRIMARY KEY,
 translation text,
 claim_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reading_translation_jobs (
 id uuid PRIMARY KEY,
 reserved_cost_usd numeric(12,6) NOT NULL DEFAULT 0.01,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reading_translation_jobs_month ON reading_translation_jobs(created_at);
