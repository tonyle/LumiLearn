import {sql} from './db';import {REVIEW_PAGE_SIZE,type ReviewFilters,type ReviewRow} from './paper-review-list';
export async function paperReviews(f:ReviewFilters){
 const base=sql`SELECT p.id,p.page_index,p.status,p.updated_at,s.nickname,s.grade,a.title,
 coalesce(meta.subjects,ARRAY[]::text[]) subjects,least(10,greatest(0,meta.questions-p.page_index*10))::int question_count,
 (SELECT count(*)::int FROM jsonb_array_elements(p.results) r WHERE r->>'status'='correct') correct,
 (SELECT count(*)::int FROM jsonb_array_elements(p.results) r WHERE r->>'status'='needs_review') unresolved
 FROM paper_pages p JOIN submissions sub ON sub.id=p.submission_id JOIN students s ON s.id=sub.student_id JOIN assignments a ON a.id=sub.assignment_id
 LEFT JOIN LATERAL(SELECT count(*)::int questions,array_agg(DISTINCT q.subject_code) FILTER(WHERE q.subject_code IS NOT NULL) subjects FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=a.id) meta ON true
 WHERE a.state='assigned' AND (${!f.student} OR sub.student_id=${f.student||null}::uuid)
 AND (${!f.grade} OR s.grade=${f.grade}) AND (${!f.subject} OR ${f.subject}=ANY(meta.subjects))
 AND (${!f.q} OR strpos(lower(a.title),lower(${f.q}))>0 OR strpos(lower(s.nickname),lower(${f.q}))>0)
 AND (${!f.from} OR (p.updated_at AT TIME ZONE 'America/Chicago')::date>=${f.from||null}::date)
 AND (${!f.to} OR (p.updated_at AT TIME ZONE 'America/Chicago')::date<=${f.to||null}::date)
 AND (${f.status==='all'} OR (${f.status==='attention'} AND p.status IN ('needs_review','failed')) OR p.status=${f.status})`;
 const [counts]=await sql`WITH review AS (${base}) SELECT count(*)::int total,count(*) FILTER(WHERE status IN ('needs_review','failed'))::int attention,count(*) FILTER(WHERE status='graded')::int graded,count(*) FILTER(WHERE status='processing')::int processing FROM review`;
 const total=Number(counts.total),pages=Math.max(1,Math.ceil(total/REVIEW_PAGE_SIZE)),page=Math.min(f.page,pages);
 const order=f.sort==='oldest'?sql`updated_at ASC,id ASC`:f.sort==='newest'?sql`updated_at DESC,id DESC`:sql`CASE status WHEN 'needs_review' THEN 0 WHEN 'failed' THEN 1 WHEN 'processing' THEN 2 WHEN 'graded' THEN 3 ELSE 4 END,updated_at DESC,id DESC`;
 const rows=await sql`WITH review AS (${base}) SELECT * FROM review ORDER BY ${order} LIMIT ${REVIEW_PAGE_SIZE} OFFSET ${(page-1)*REVIEW_PAGE_SIZE}`;
 return {rows:rows as unknown as ReviewRow[],total,pages,page,attention:Number(counts.attention),graded:Number(counts.graded),processing:Number(counts.processing)};
}
