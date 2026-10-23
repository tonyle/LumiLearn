CREATE TABLE vocab_photo_imports (
 id uuid PRIMARY KEY, parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
 photo_hash text NOT NULL, state text NOT NULL CHECK(state IN ('processing','ready','failed')),
 result jsonb, reserved_cost_usd numeric NOT NULL DEFAULT .05,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
