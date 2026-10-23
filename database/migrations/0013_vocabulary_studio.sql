BEGIN;
CREATE TABLE vocab_words(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),word text NOT NULL,meaning text NOT NULL DEFAULT '',translation text NOT NULL DEFAULT '',sentence text NOT NULL DEFAULT '',chunks text NOT NULL DEFAULT '',image_prompt text NOT NULL DEFAULT '',image_id uuid,revision integer NOT NULL DEFAULT 1,creation_key uuid UNIQUE NOT NULL,created_by uuid REFERENCES parents(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz
);
CREATE TABLE vocab_images(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),word_id uuid NOT NULL REFERENCES vocab_words(id),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','ready','failed')),storage_key text,reviewed boolean NOT NULL DEFAULT false,error_code text,reserved_cost_usd numeric NOT NULL DEFAULT 0,model text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vocab_words ADD FOREIGN KEY(image_id) REFERENCES vocab_images(id);
CREATE TABLE vocab_lessons(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text NOT NULL DEFAULT '',modes jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,creation_key uuid UNIQUE NOT NULL,created_by uuid REFERENCES parents(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz
);
CREATE TABLE vocab_lesson_words(lesson_id uuid NOT NULL REFERENCES vocab_lessons(id) ON DELETE CASCADE,word_id uuid NOT NULL REFERENCES vocab_words(id),position integer NOT NULL,PRIMARY KEY(lesson_id,word_id),UNIQUE(lesson_id,position));
CREATE TABLE vocab_students(lesson_id uuid NOT NULL REFERENCES vocab_lessons(id) ON DELETE CASCADE,student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,assigned_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(lesson_id,student_id));
CREATE TABLE vocab_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lesson_id uuid NOT NULL REFERENCES vocab_lessons(id),student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,snapshot jsonb NOT NULL,tasks jsonb NOT NULL,cursor integer NOT NULL DEFAULT 0,creation_key uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE INDEX vocab_student_runs ON vocab_runs(student_id,created_at DESC);
CREATE TABLE vocab_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL REFERENCES vocab_runs(id) ON DELETE CASCADE,task_index integer NOT NULL,word_id uuid NOT NULL REFERENCES vocab_words(id),mode text NOT NULL,response text NOT NULL,correct boolean NOT NULL,assisted boolean NOT NULL DEFAULT false,request_key uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vocab_events_run ON vocab_events(run_id,task_index);
CREATE TABLE vocab_progress(student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,word_id uuid NOT NULL REFERENCES vocab_words(id),stage integer NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 5),due_at timestamptz NOT NULL DEFAULT now(),last_reviewed_at timestamptz,seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,word_id));
COMMIT;
