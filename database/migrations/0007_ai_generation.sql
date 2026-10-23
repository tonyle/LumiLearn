BEGIN;
CREATE TABLE worksheet_generation_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES parents(id),
 creation_key text NOT NULL UNIQUE,
 parameters jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE worksheet_generation_items (
 batch_id uuid NOT NULL REFERENCES worksheet_generation_batches(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 9),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','ready','failed')),
 request_key uuid,
 draft_id uuid REFERENCES worksheet_drafts(id) ON DELETE SET NULL,
 warnings jsonb NOT NULL DEFAULT '[]',
 error_code text,
 input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0,
 reserved_cost_usd numeric NOT NULL DEFAULT 0,
 started_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_id,position)
);
COMMIT;
