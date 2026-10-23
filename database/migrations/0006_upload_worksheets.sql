BEGIN;
ALTER TABLE worksheet_drafts ADD COLUMN upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL;
ALTER TABLE worksheet_drafts ADD COLUMN source_order int;
CREATE UNIQUE INDEX worksheet_upload_order ON worksheet_drafts(upload_id,source_order) WHERE upload_id IS NOT NULL;
CREATE TABLE upload_extractions(
 upload_id uuid PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('processing','ready','failed')),
 request_key uuid NOT NULL DEFAULT gen_random_uuid(),
 warnings jsonb NOT NULL DEFAULT '[]',error_code text,
 input_tokens int NOT NULL DEFAULT 0,output_tokens int NOT NULL DEFAULT 0,
 reserved_cost_usd numeric(12,4) NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
