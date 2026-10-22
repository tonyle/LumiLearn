import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { sql } from "@/lib/db";
export default async function PaperReviewList(){
  await requireRole("parent");
  const pages=await sql`SELECT p.id,p.page_index,p.status,p.updated_at,s.nickname,a.title FROM paper_pages p JOIN submissions sub ON sub.id=p.submission_id JOIN students s ON s.id=sub.student_id JOIN assignments a ON a.id=sub.assignment_id WHERE a.state='assigned' ORDER BY p.updated_at DESC LIMIT 100`;
  return <div className="stack"><header><span className="eyebrow">Paper practice</span><h1>Worksheet review</h1><p className="muted">See the captured paper and confirm or correct grades. Each correct question earns 10 points.</p></header>{pages.length?<section className="card"><table className="table"><thead><tr><th>Learner</th><th>Paper</th><th>Status</th><th>Review</th></tr></thead><tbody>{pages.map(p=><tr key={p.id as string}><td>{p.nickname as string}</td><td>{p.title as string}<small className="muted" style={{display:"block"}}>Page {Number(p.page_index)+1}</small></td><td>{p.status as string}</td><td><Link className="button secondary" href={`/parent/paper/${p.id}`}>Open paper</Link></td></tr>)}</tbody></table></section>:<div className="card empty">Papers appear here when a learner saves or submits a page.</div>}</div>;
}
