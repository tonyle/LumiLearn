BEGIN;
CREATE TABLE worksheet_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES parents(id),
 creation_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 revision int NOT NULL DEFAULT 1 CHECK(revision>0),
 assignment_id uuid UNIQUE REFERENCES assignments(id) ON DELETE SET NULL,
 question_set_id uuid REFERENCES question_sets(id) ON DELETE SET NULL,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assignments ADD COLUMN creation_key text;
ALTER TABLE assignments ADD COLUMN creation_hash text;
CREATE UNIQUE INDEX assignments_creation_key ON assignments(creation_key) WHERE creation_key IS NOT NULL;
COMMIT;
