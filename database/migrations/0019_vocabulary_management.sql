BEGIN;
ALTER TABLE vocab_words ADD COLUMN grade text CHECK(grade IS NULL OR grade IN ('K','1','2','3','4','5','6','7','8','9','10','11','12'));
ALTER TABLE vocab_lessons ADD COLUMN grade text CHECK(grade IS NULL OR grade IN ('K','1','2','3','4','5','6','7','8','9','10','11','12'));
UPDATE vocab_lessons l SET grade=x.grade FROM (SELECT vs.lesson_id,min(s.grade) grade FROM vocab_students vs JOIN students s ON s.id=vs.student_id GROUP BY vs.lesson_id HAVING count(DISTINCT s.grade)=1) x WHERE l.id=x.lesson_id AND x.grade IN ('K','1','2','3','4','5','6','7','8','9','10','11','12');
UPDATE vocab_words w SET grade=x.grade FROM (SELECT lw.word_id,min(l.grade) grade FROM vocab_lesson_words lw JOIN vocab_lessons l ON l.id=lw.lesson_id GROUP BY lw.word_id HAVING count(DISTINCT l.grade)=1 AND count(*)=count(l.grade)) x WHERE w.id=x.word_id;
CREATE INDEX vocab_words_grade_created ON vocab_words(grade,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX vocab_lessons_grade_created ON vocab_lessons(grade,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX vocab_runs_lesson_created ON vocab_runs(lesson_id,created_at DESC);
COMMIT;
