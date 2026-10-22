-- LumiLearn Home — PostgreSQL 16 baseline schema, version 1.0
-- Canonical logical model. Codex: convert to versioned ORM migrations and verify parity.
-- Run against a dedicated lumilearn database. Requires pgcrypto for gen_random_uuid().
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE app_role AS ENUM ('parent','student');
CREATE TYPE question_state AS ENUM ('draft','approved','published','archived');
CREATE TYPE question_type AS ENUM ('single_choice','multiple_choice','number','short_text','ordering','true_false','long_text','handwriting');
CREATE TYPE assignment_state AS ENUM ('draft','assigned','closed');
CREATE TYPE verdict_type AS ENUM ('correct','incorrect','needs_review');
CREATE TYPE job_state AS ENUM ('queued','running','succeeded','failed');

CREATE TABLE parents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, display_name text NOT NULL,
 password_hash text NOT NULL, pin_hash text, locale text NOT NULL DEFAULT 'vi',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nickname text NOT NULL, grade text NOT NULL,
 avatar_key text, pin_hash text, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role app_role NOT NULL,
 parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
 student_id uuid REFERENCES students(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz,
 CONSTRAINT sessions_one_identity CHECK ((role='parent' AND parent_id IS NOT NULL AND student_id IS NULL) OR (role='student' AND student_id IS NOT NULL AND parent_id IS NULL))
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE app_settings (
 key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subjects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL
);
CREATE TABLE curriculum_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, source_type text NOT NULL,
 source_url text, publisher text, version text, verified_at timestamptz, imported_at timestamptz NOT NULL DEFAULT now(),
 notes text, CONSTRAINT curriculum_source_type CHECK (source_type IN ('teks','district','parent_document','other'))
);
CREATE TABLE standards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES curriculum_sources(id) ON DELETE CASCADE,
 code text NOT NULL, grade text, subject_code text, description text NOT NULL, effective_date date,
 UNIQUE(source_id,code)
);
CREATE INDEX idx_standards_grade_subject ON standards(grade,subject_code);
CREATE TABLE student_standard_progress (
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 standard_id uuid NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
 attempted_count int NOT NULL DEFAULT 0 CHECK (attempted_count>=0),
 correct_count int NOT NULL DEFAULT 0 CHECK (correct_count>=0),
 last_practiced_at timestamptz, PRIMARY KEY(student_id,standard_id),
 CHECK(correct_count<=attempted_count)
);
CREATE TABLE uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uploaded_by uuid REFERENCES parents(id) ON DELETE SET NULL,
 original_filename text NOT NULL, mime_type text NOT NULL, bytes bigint NOT NULL CHECK(bytes>0),
 sha256 text NOT NULL, private_storage_key text NOT NULL UNIQUE, page_count int NOT NULL DEFAULT 1 CHECK(page_count>0),
 status text NOT NULL DEFAULT 'uploaded', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploads_hash ON uploads(sha256);
CREATE TABLE worksheet_pages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
 page_number int NOT NULL CHECK(page_number>=1), width int CHECK(width>0), height int CHECK(height>0),
 image_storage_key text, extraction jsonb, extraction_confidence numeric(5,4),
 UNIQUE(upload_id,page_number)
);
CREATE TABLE question_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_set_id text, title text NOT NULL,
 description text, grade text, subject_code text, locale text NOT NULL DEFAULT 'en-US',
 origin text NOT NULL DEFAULT 'manual', source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 alignment_status text NOT NULL DEFAULT 'unverified', created_by uuid REFERENCES parents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT set_alignment CHECK (alignment_status IN ('verified','unverified','general_practice'))
);
CREATE TABLE questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), set_id uuid REFERENCES question_sets(id) ON DELETE SET NULL,
 external_id text, current_version int NOT NULL DEFAULT 1 CHECK(current_version>=1),
 state question_state NOT NULL DEFAULT 'draft', type question_type NOT NULL,
 grade text, subject_code text, difficulty text, content_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(set_id,external_id)
);
CREATE INDEX idx_questions_set ON questions(set_id);
CREATE INDEX idx_questions_state_grade ON questions(state,grade,subject_code);
CREATE TABLE question_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
 version int NOT NULL CHECK(version>=1), prompt jsonb NOT NULL, options jsonb NOT NULL DEFAULT '[]'::jsonb,
 answer_key jsonb NOT NULL, grading_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
 parent_explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
 student_translation jsonb NOT NULL DEFAULT '{}'::jsonb,
 assets jsonb NOT NULL DEFAULT '[]'::jsonb, tags text[] NOT NULL DEFAULT '{}',
 source_page_id uuid REFERENCES worksheet_pages(id) ON DELETE SET NULL,
 source_region jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 approved_by uuid REFERENCES parents(id) ON DELETE SET NULL, approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(question_id,version)
);
CREATE TABLE question_standards (
 question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
 standard_id uuid NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
 PRIMARY KEY(question_id,standard_id)
);
CREATE TABLE assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text,
 state assignment_state NOT NULL DEFAULT 'draft', due_at timestamptz,
 max_attempts int NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 100),
 created_by uuid REFERENCES parents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assignment_students (
 assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 PRIMARY KEY(assignment_id,student_id)
);
CREATE INDEX idx_assignment_students_student ON assignment_students(student_id);
CREATE TABLE assignment_questions (
 assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
 question_version_id uuid NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
 sort_order int NOT NULL CHECK(sort_order>=0), PRIMARY KEY(assignment_id,question_version_id),
 UNIQUE(assignment_id,sort_order)
);
CREATE TABLE submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid NOT NULL,
 student_id uuid NOT NULL, status text NOT NULL DEFAULT 'in_progress',
 started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
 completed_at timestamptz, last_saved_at timestamptz,
 FOREIGN KEY(assignment_id,student_id) REFERENCES assignment_students(assignment_id,student_id) ON DELETE CASCADE,
 UNIQUE(assignment_id,student_id),
 CHECK(status IN ('in_progress','submitted','completed','needs_review'))
);
CREATE TABLE answer_drafts (
 submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
 question_version_id uuid NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
 draft jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(submission_id,question_version_id)
);
CREATE TABLE attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
 question_version_id uuid NOT NULL REFERENCES question_versions(id) ON DELETE RESTRICT,
 attempt_number int NOT NULL CHECK(attempt_number>=1), idempotency_key text NOT NULL,
 student_response jsonb NOT NULL, verdict verdict_type NOT NULL,
 grading_engine text NOT NULL, grading_model text, confidence numeric(5,4),
 private_reason text, private_solution text, grading_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
 duration_ms int CHECK(duration_ms>=0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(submission_id,question_version_id,attempt_number),
 UNIQUE(submission_id,idempotency_key),
 CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1)
);
CREATE INDEX idx_attempts_submission ON attempts(submission_id,created_at);
CREATE TABLE grade_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
 old_verdict verdict_type NOT NULL, new_verdict verdict_type NOT NULL,
 reason text NOT NULL, parent_id uuid REFERENCES parents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE drawing_strokes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
 page_id uuid NOT NULL REFERENCES worksheet_pages(id) ON DELETE CASCADE,
 stroke_data jsonb NOT NULL, revision int NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(submission_id,page_id)
);
CREATE TABLE import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uploaded_by uuid REFERENCES parents(id) ON DELETE SET NULL,
 source_name text, source_sha256 text NOT NULL, schema_version text NOT NULL,
 status text NOT NULL DEFAULT 'validated', validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
 imported_count int NOT NULL DEFAULT 0 CHECK(imported_count>=0),
 created_at timestamptz NOT NULL DEFAULT now(), committed_at timestamptz,
 CHECK(status IN ('validated','committed','failed'))
);
CREATE TABLE translation_cache (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_hash text NOT NULL,
 source_text text NOT NULL, source_locale text NOT NULL DEFAULT 'en',
 target_locale text NOT NULL DEFAULT 'vi', context_hash text NOT NULL DEFAULT '',
 translation text NOT NULL, part_of_speech text, provider text, model text,
 reviewed_by_parent boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_hash,source_locale,target_locale,context_hash)
);
CREATE TABLE vocabulary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 word text NOT NULL, context_sentence text, translation text NOT NULL,
 translation_cache_id uuid REFERENCES translation_cache(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(student_id,word,context_sentence)
);
CREATE TABLE ai_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_type text NOT NULL, state job_state NOT NULL DEFAULT 'queued',
 requested_by uuid REFERENCES parents(id) ON DELETE SET NULL,
 input_reference jsonb NOT NULL DEFAULT '{}'::jsonb, result_reference jsonb,
 provider text, model text, input_tokens int, output_tokens int,
 estimated_cost_usd numeric(12,6), error_code text, error_message text,
 idempotency_key text UNIQUE, started_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_jobs_state ON ai_jobs(state,created_at);
CREATE TABLE audit_events (
 id bigserial PRIMARY KEY, actor_role app_role, actor_parent_id uuid REFERENCES parents(id) ON DELETE SET NULL,
 actor_student_id uuid REFERENCES students(id) ON DELETE SET NULL,
 action text NOT NULL, entity_type text, entity_id uuid,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_events_time ON audit_events(created_at DESC);

INSERT INTO subjects(code,name) VALUES
 ('math','Mathematics'),('reading','Reading'),('writing','Writing'),
 ('science','Science'),('social_studies','Social Studies')
ON CONFLICT (code) DO NOTHING;
COMMIT;
