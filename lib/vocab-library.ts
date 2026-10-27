import {sql} from './db';
import {VOCAB_PAGE_SIZE,type VocabFilters} from './vocab-management';
export async function vocabWordList(f:VocabFilters){
 const where=sql`WHERE w.deleted_at IS NULL AND strpos(lower(w.word||' '||w.meaning),lower(${f.q}))>0
 AND (${!f.grade} OR ${f.grade==='unclassified'} AND w.grade IS NULL OR w.grade=${f.grade})
 AND (${f.from||null}::date IS NULL OR (w.created_at AT TIME ZONE 'America/Chicago')::date>=${f.from||null}::date)
 AND (${f.to||null}::date IS NULL OR (w.created_at AT TIME ZONE 'America/Chicago')::date<=${f.to||null}::date)
 AND (${!f.state} OR ${f.state==='ready'} AND i.state='ready' AND i.reviewed=true OR ${f.state==='review'} AND i.state='ready' AND i.reviewed=false OR ${f.state==='missing'} AND i.state IS DISTINCT FROM 'ready')`;
 const [count]=await sql`SELECT count(*)::int total FROM vocab_words w LEFT JOIN vocab_images i ON i.id=w.image_id ${where}`;
 const total=Number(count.total),pages=Math.max(1,Math.ceil(total/VOCAB_PAGE_SIZE)),page=Math.min(pages,f.page);
 const order=f.sort==='word'?sql`w.word ASC,w.id`:f.sort==='oldest'?sql`w.created_at ASC,w.id`:sql`w.created_at DESC,w.id`;
 const rows=await sql`SELECT w.*,i.state image_state,i.reviewed,i.error_code,i.model FROM vocab_words w LEFT JOIN vocab_images i ON i.id=w.image_id ${where} ORDER BY ${order} LIMIT ${VOCAB_PAGE_SIZE} OFFSET ${(page-1)*VOCAB_PAGE_SIZE}`;
 return {rows,total,pages,page};
}
export async function vocabLessonList(f:VocabFilters){
 const where=sql`WHERE l.deleted_at IS NULL
 AND (${!f.grade} OR ${f.grade==='unclassified'} AND l.grade IS NULL OR l.grade=${f.grade})
 AND (${f.from||null}::date IS NULL OR (l.created_at AT TIME ZONE 'America/Chicago')::date>=${f.from||null}::date)
 AND (${f.to||null}::date IS NULL OR (l.created_at AT TIME ZONE 'America/Chicago')::date<=${f.to||null}::date)
 AND (strpos(lower(l.title||' '||l.description),lower(${f.q}))>0 OR EXISTS(SELECT 1 FROM vocab_lesson_words lw JOIN vocab_words w ON w.id=lw.word_id WHERE lw.lesson_id=l.id AND strpos(lower(w.word),lower(${f.q}))>0))`;
 const [count]=await sql`SELECT count(*)::int total FROM vocab_lessons l ${where}`;
 const total=Number(count.total),pages=Math.max(1,Math.ceil(total/VOCAB_PAGE_SIZE)),page=Math.min(pages,f.page);
 const order=f.sort==='word'?sql`l.title ASC,l.id`:f.sort==='oldest'?sql`l.created_at ASC,l.id`:sql`l.created_at DESC,l.id`;
 const rows=await sql`SELECT l.*,(SELECT count(*)::int FROM vocab_lesson_words WHERE lesson_id=l.id) words,(SELECT count(*)::int FROM vocab_students WHERE lesson_id=l.id) students,(SELECT count(*)::int FROM vocab_runs WHERE lesson_id=l.id AND completed_at IS NOT NULL) completions FROM vocab_lessons l ${where} ORDER BY ${order} LIMIT ${VOCAB_PAGE_SIZE} OFFSET ${(page-1)*VOCAB_PAGE_SIZE}`;
 return {rows,total,pages,page};
}
