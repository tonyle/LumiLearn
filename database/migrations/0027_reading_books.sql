CREATE TABLE reading_books (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),description text NOT NULL DEFAULT '',grade text NOT NULL DEFAULT '1',
 published boolean NOT NULL DEFAULT false,deleted_at timestamptz,created_by uuid REFERENCES parents(id),revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reading_book_pages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),book_id uuid NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
 page_number integer NOT NULL CHECK(page_number BETWEEN 1 AND 200),image_key text NOT NULL,width integer NOT NULL,height integer NOT NULL,
 regions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(regions)='array'),reviewed boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(book_id,page_number) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE reading_book_students (
 book_id uuid NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 assigned_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(book_id,student_id)
);
CREATE TABLE reading_book_ocr_jobs (
 id uuid PRIMARY KEY,book_id uuid REFERENCES reading_books(id) ON DELETE SET NULL,page_id uuid REFERENCES reading_book_pages(id) ON DELETE SET NULL,
 parent_id uuid NOT NULL REFERENCES parents(id),state text NOT NULL CHECK(state IN ('processing','ready','failed')),
 reserved_cost_usd numeric NOT NULL DEFAULT .10,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reading_books_updated ON reading_books(updated_at DESC,id);
CREATE INDEX reading_book_student_access ON reading_book_students(student_id,book_id);
CREATE INDEX reading_book_ocr_budget ON reading_book_ocr_jobs(created_at);
