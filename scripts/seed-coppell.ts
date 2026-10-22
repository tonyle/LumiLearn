import postgres from "postgres";
import {upgradeLesson} from "../lib/lesson-upgrade";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contentHash, questionSetSchema } from "../lib/question-schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1 });
const directory = resolve("examples/coppell");
const sets = await Promise.all((await readdir(directory)).filter(f => f.endsWith(".json")).sort().map(async file =>
  questionSetSchema.parse(JSON.parse(await readFile(resolve(directory, file), "utf8")))
));
try {
  await db.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(163021, 1)`;
    const [parent] = await tx`SELECT id FROM parents ORDER BY created_at LIMIT 1`;
    if (!parent) throw new Error("Run db:seed or complete setup before loading practice packs.");
    for (const grade of ["1", "3", "5"]) {
      const students = await tx`SELECT id FROM students WHERE grade=${grade} AND active=true`;
      if (!students.length) await tx`INSERT INTO students(nickname,grade,avatar_key) VALUES(${`Grade ${grade} learner`},${grade},'sun')`;
    }
    const wordLearners = await tx`SELECT id FROM students WHERE active=true AND grade='1'`;
    const words = [
      ["sun", "mặt trời", "The sun is bright."], ["cat", "con mèo", "The cat has a hat."],
      ["ship", "con tàu", "The ship is on the sea."], ["book", "quyển sách", "I can read a book."],
      ["tiny", "rất nhỏ", "The tiny bug sits on a leaf."], ["leaf", "chiếc lá", "A green leaf is on the tree."],
      ["dig", "đào", "I can dig a hole."], ["cake", "bánh ngọt", "We make a cake."],
      ["sand", "cát", "We play in the sand."], ["fish", "con cá", "A fish can swim."],
      ["red", "màu đỏ", "Ben has a red bag."], ["read", "đọc", "I can read."]
    ];
    for (const learner of wordLearners) for (const [word,translation,context] of words)
      await tx`INSERT INTO vocabulary(student_id,word,translation,context_sentence) VALUES(${learner.id},${word},${translation},${context}) ON CONFLICT DO NOTHING`;
    for (const set of sets) {
      let [setRow] = await tx`SELECT id FROM question_sets WHERE external_set_id=${set.setId}`;
      if (!setRow) [setRow] = await tx`INSERT INTO question_sets(external_set_id,title,description,grade,subject_code,locale,origin,source_metadata,alignment_status,created_by) VALUES(${set.setId},${set.title},${set.description!},${set.grade},${set.subject},${set.locale},'seed',${tx.json({...set.source,curriculum:set.curriculum})},${set.curriculum.alignmentStatus},${parent.id}) RETURNING id`;
      const versions: string[] = [];
      for (const q of set.questions) {
        let [question] = await tx`SELECT id,content_hash FROM questions WHERE set_id=${setRow.id} AND external_id=${q.externalId}`;
        if (question && question.content_hash !== contentHash(q)) throw new Error(`Sample ${q.externalId} changed. Create a new pack version to preserve existing student work.`);
        if (!question) {
          [question] = await tx`INSERT INTO questions(set_id,external_id,state,type,grade,subject_code,difficulty,content_hash) VALUES(${setRow.id},${q.externalId},'published',${q.type},${q.grade},${q.subject},${q.difficulty},${contentHash(q)}) RETURNING id`;
          await tx`INSERT INTO question_versions(question_id,version,prompt,options,answer_key,grading_policy,parent_explanation,student_translation,assets,tags,metadata,approved_by,approved_at) VALUES(${question.id},1,${tx.json(q.prompt)},${tx.json(q.options)},${tx.json(q.answer)},${tx.json(q.grading)},${tx.json(q.parentExplanation)},${tx.json(q.studentTranslation??{})},${tx.json(q.assets)},${q.tags},${tx.json(JSON.parse(JSON.stringify(q.metadata)))},${parent.id},now())`;
        }
        const [version] = await tx`SELECT id FROM question_versions WHERE question_id=${question.id} AND version=1`;
        versions.push(version.id as string);
      }
      const title = `${set.title} · Practice pack`;
      let [assignment] = await tx`SELECT id FROM assignments WHERE title=${title}`;
      if (!assignment) [assignment] = await tx`INSERT INTO assignments(title,description,state,max_attempts,created_by) VALUES(${title},${set.description!},'closed',3,${parent.id}) RETURNING id`;
      await tx`UPDATE assignments SET state='closed' WHERE id=${assignment.id}`;
      for (let i = 0; i < versions.length; i++) await tx`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${assignment.id},${versions[i]},${i}) ON CONFLICT DO NOTHING`;
      const students = await tx`SELECT id FROM students WHERE active=true AND grade=${set.grade}`;
      await upgradeLesson(tx,String(assignment.id),students.map(s=>String(s.id)));
      console.log(`${set.title}: ${versions.length} questions, assigned to ${students.length} learner(s).`);
    }
  });
  console.log("Practice ready: ten-question lessons, multiple lessons per day. Original question banks and earlier work preserved.");
} finally { await db.end(); }
