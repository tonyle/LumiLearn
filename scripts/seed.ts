import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contentHash, questionSetSchema } from "../lib/question-schema";

const url=process.env.DATABASE_URL; if(!url) throw new Error("DATABASE_URL is required");
const db=postgres(url,{max:1});
const demoPassword=process.env.DEMO_PARENT_PASSWORD || "LumiLearn-Demo-2026!";
await db.begin(async tx=>{
  const existing=await tx`SELECT id FROM parents LIMIT 1`;
  let parentId:string;
  if(existing.length) parentId=existing[0].id as string;
  else {const [p]=await tx`INSERT INTO parents(display_name,email,password_hash,locale) VALUES('Lumi Parent','parent@lumilearn.local',${await hash(demoPassword)},'en') RETURNING id`;parentId=p.id as string;}
  const studentRows=await tx`SELECT id FROM students`;
  if(!studentRows.length){for(const [nickname,grade,avatar] of [["Avery","3","sun"],["Milo","1","kite"],["Lina","5","leaf"]]) await tx`INSERT INTO students(nickname,grade,avatar_key) VALUES(${nickname},${grade},${avatar})`;}
  const raw=JSON.parse(await readFile(resolve("examples/question-set.math.json"),"utf8")); const set=questionSetSchema.parse(raw);
  const found=await tx`SELECT id FROM question_sets WHERE external_set_id=${set.setId}`;
  let setId:string;
  if(found.length)setId=found[0].id as string; else {const [s]=await tx`INSERT INTO question_sets(external_set_id,title,description,grade,subject_code,origin,source_metadata,alignment_status,created_by) VALUES(${set.setId},${set.title},${set.description??null},${set.grade},${set.subject},'seed',${tx.json(set.source)},${set.curriculum.alignmentStatus},${parentId}) RETURNING id`;setId=s.id as string;}
  const versions:string[]=[];
  for(const q of set.questions){let row=(await tx`SELECT id FROM questions WHERE set_id=${setId} AND external_id=${q.externalId}`)[0];if(!row){[row]=await tx`INSERT INTO questions(set_id,external_id,state,type,grade,subject_code,difficulty,content_hash) VALUES(${setId},${q.externalId},'published',${q.type},${q.grade},${q.subject},${q.difficulty},${contentHash(q)}) RETURNING id`;await tx`INSERT INTO question_versions(question_id,version,prompt,options,answer_key,grading_policy,parent_explanation,student_translation,assets,tags,approved_by,approved_at) VALUES(${row.id},1,${tx.json(q.prompt)},${tx.json(q.options)},${tx.json(q.answer)},${tx.json(q.grading)},${tx.json(q.parentExplanation)},${tx.json(q.studentTranslation??{})},${tx.json(q.assets)},${q.tags},${parentId},now())`;}; const [v]=await tx`SELECT id FROM question_versions WHERE question_id=${row.id} AND version=1`;versions.push(v.id as string);}
  const [student]=await tx`SELECT id FROM students ORDER BY created_at LIMIT 1`;
  let assignment=(await tx`SELECT id FROM assignments WHERE title='Multiplication warm-up'`)[0];
  if(!assignment){[assignment]=await tx`INSERT INTO assignments(title,description,state,max_attempts,created_by,due_at) VALUES('Multiplication warm-up','A calm ten-minute practice session.','assigned',3,${parentId},now()+interval '7 days') RETURNING id`;await tx`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${assignment.id},${student.id}) ON CONFLICT DO NOTHING`;for(let i=0;i<versions.length;i++)await tx`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${assignment.id},${versions[i]},${i}) ON CONFLICT DO NOTHING`;}
  await tx`INSERT INTO app_settings(key,value) VALUES('family',${tx.json({timezone:process.env.TZ||"America/Chicago",name:"LumiLearn Home",externalAiOptIn:false})}) ON CONFLICT(key) DO NOTHING`;
});
console.log("Seed complete. Demo parent: parent@lumilearn.local (password from DEMO_PARENT_PASSWORD or documented development default).");await db.end();
