BEGIN;
CREATE TABLE learning_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by uuid REFERENCES parents(id),creation_key text UNIQUE,creation_hash text,
 title text NOT NULL,description text NOT NULL DEFAULT '',subject_code text NOT NULL,grade text NOT NULL,topic text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK(kind IN ('pdf','document','slides','video','link')),source_url text,
 storage_key text,preview_key text,original_filename text,mime_type text,bytes bigint,
 revision int NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz
);
CREATE TABLE resource_students (
 resource_id uuid NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(),first_opened_at timestamptz,last_opened_at timestamptz,reviewed_at timestamptz,reviewed_revision int,
 PRIMARY KEY(resource_id,student_id)
);
CREATE TABLE resource_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),resource_id uuid NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),creation_key uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),last_student_at timestamptz NOT NULL DEFAULT now(),last_parent_at timestamptz,resolved_at timestamptz
);
CREATE TABLE resource_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),question_id uuid NOT NULL REFERENCES resource_questions(id) ON DELETE CASCADE,
 author_role text NOT NULL CHECK(author_role IN ('parent','student')),parent_id uuid REFERENCES parents(id),student_id uuid REFERENCES students(id),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),creation_key uuid NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((author_role='parent' AND parent_id IS NOT NULL AND student_id IS NULL) OR (author_role='student' AND student_id IS NOT NULL AND parent_id IS NULL))
);
CREATE INDEX resource_students_student ON resource_students(student_id,assigned_at DESC);
CREATE INDEX resource_questions_resource ON resource_questions(resource_id,updated_at DESC,id);
CREATE INDEX resource_replies_question ON resource_replies(question_id,created_at,id);
COMMIT;
