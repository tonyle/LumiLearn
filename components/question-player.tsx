"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, Languages } from "lucide-react";
import { DrawingAnswer, type DrawingStroke } from "./drawing-answer";
type Q = { id: string; type: string; prompt: { text: string; translationPolicy: string }; options: { id: string; text: string }[]; translation?: string };
type Feedback = { status: string; canRetry: boolean; feedbackCode: string };
type Entry = { value: string | string[] | boolean; drawing: DrawingStroke[]; feedback: Feedback | null };
const labels: Record<string, [string, string]> = {
  single_choice: ["Choose one", "Tap one answer."], multiple_choice: ["Choose all that apply", "You can select more than one answer."],
  number: ["Number answer", "Type a number. Fractions such as 1/2 also work."], short_text: ["Short answer", "A word or a short phrase is enough."],
  ordering: ["Put in order", "Use the up and down buttons to arrange the items."], true_false: ["True or false", "Decide whether the statement is true."],
  long_text: ["Explain your thinking", "Write in your own words. Your parent will review your work."], handwriting: ["Draw or write", "Show your thinking. Your parent will review your work."]
};
export function QuestionPlayer({ assignmentId, questions }: { assignmentId: string; questions: Q[] }) {
  const pathname = usePathname();
  const home = pathname.split("/assignment/")[0] + "/home";
  const [index, setIndex] = useState(0), [entries, setEntries] = useState<Record<string, Entry>>({});
  const [translated, setTranslated] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const q = questions[index];
  if (!q) return <div className="card empty">This assignment has no questions yet.</div>;
  const entry = entries[q.id] ?? { value: q.type === "ordering" ? q.options.map(o => o.id) : "", drawing: [], feedback: null };
  const { value, drawing, feedback } = entry;
  const locked = !!feedback && !feedback.canRetry;
  const hasValue = Array.isArray(value) ? value.length > 0 : typeof value === "boolean" || value.trim().length > 0;
  const hasDrawing = drawing.some(stroke => stroke.tool === "pen" && stroke.points.length);
  function update(patch: Partial<Entry>) { setEntries(previous => ({ ...previous, [q.id]: { ...entry, ...patch } })); setError(""); }
  function toggle(id: string) {
    if (q.type === "multiple_choice") update({ value: Array.isArray(value) ? value.includes(id) ? value.filter(x => x !== id) : [...value, id] : [id] });
    else update({ value: id });
  }
  function move(position: number, direction: number) {
    const next = [...(value as string[])];
    [next[position], next[position + direction]] = [next[position + direction], next[position]];
    update({ value: next });
  }
  function navigate(position: number) { setIndex(position); setTranslated(false); setError(""); }
  async function check() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/student/assignments/${assignmentId}/answers`, {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("") },
        body: JSON.stringify({ questionVersionId: q.id, response: { value, ...(q.type === "handwriting" ? { drawing } : {}) } })
      });
      const json = await response.json();
      if (!response.ok) { setError(json.error?.message || "Your answer was not saved. Please try again."); return; }
      update({ feedback: json.data });
    } catch { setError("Could not connect. Your answer is still here; please try again."); }
    finally { setBusy(false); }
  }
  if (finished) return <main className="student-main question"><section className="card stack"><CheckCircle2 size={48} color="#0f766e" /><h1>Practice complete!</h1><p>Your submitted answers have been saved. Your parent will review written and drawn responses.</p><Link className="button primary" href={home}>Back to my learning</Link></section></main>;
  const [label, instruction] = labels[q.type] ?? ["Your answer", ""];
  return <main className="student-main question stack">
    <div className="row" style={{ justifyContent: "space-between" }}><Link href={home} className="muted">← My learning</Link><span className="eyebrow">Question {index + 1} of {questions.length}</span></div>
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index}><span style={{ width: `${(index / questions.length) * 100}%` }} /></div>
    <article className="card stack"><span className="pill">{label}</span><h1 style={{ whiteSpace: "pre-wrap" }}>{q.prompt.text}</h1><p className="muted" style={{ margin: 0 }}>{instruction}</p>
      {q.translation && q.prompt.translationPolicy !== "disabled" && <><button className="ghost" onClick={() => setTranslated(!translated)}><Languages size={18} />{translated ? "Hide translation" : "Dịch đoạn văn"}</button>{translated && <div className="notice success"><p>{q.translation}</p></div>}</>}
      {q.type === "ordering" ? <ol className="ordering-list">{(value as string[]).map((id, position) => <li className="ordering-item" key={id}><span className="order-number">{position + 1}</span><strong>{q.options.find(option => option.id === id)?.text}</strong><div className="row"><button className="secondary" aria-label={`Move ${q.options.find(o => o.id === id)?.text} up`} disabled={busy || locked || position === 0} onClick={() => move(position, -1)}><ArrowUp size={18} /></button><button className="secondary" aria-label={`Move ${q.options.find(o => o.id === id)?.text} down`} disabled={busy || locked || position === q.options.length - 1} onClick={() => move(position, 1)}><ArrowDown size={18} /></button></div></li>)}</ol>
        : q.type === "single_choice" || q.type === "multiple_choice" ? <div className="choices">{q.options.map(o => <button key={o.id} className="choice" disabled={busy || locked} aria-pressed={Array.isArray(value) ? value.includes(o.id) : value === o.id} data-selected={Array.isArray(value) ? value.includes(o.id) : value === o.id} onClick={() => toggle(o.id)}><span aria-hidden="true">{(Array.isArray(value) ? value.includes(o.id) : value === o.id) ? "✓" : q.type === "multiple_choice" ? "□" : "○"}</span> {o.text}</button>)}</div>
        : q.type === "true_false" ? <div className="choices">{[true, false].map(option => <button key={String(option)} className="choice" disabled={busy || locked} aria-pressed={value === option} data-selected={value === option} onClick={() => update({ value: option })}>{option ? "True" : "False"}</button>)}</div>
        : <>{q.type === "handwriting" && <DrawingAnswer key={q.id} strokes={drawing} onChange={strokes => update({ drawing: strokes })} disabled={busy || locked} />}<label className="field">{q.type === "handwriting" ? "Describe your drawing (optional)" : "Your answer"}{q.type === "long_text" || q.type === "handwriting" ? <textarea rows={5} maxLength={12000} disabled={busy || locked} value={String(value)} onChange={event => update({ value: event.target.value })} /> : <input inputMode={q.type === "number" ? "decimal" : "text"} maxLength={12000} autoComplete="off" disabled={busy || locked} value={String(value)} onChange={event => update({ value: event.target.value })} />}</label></>}
      {feedback && <div role="status" aria-live="polite" className={feedback.status === "correct" ? "notice success" : "notice"}>{feedback.status === "correct" ? "Nice work — you’ve got it!" : feedback.status === "incorrect" ? feedback.canRetry ? "Not quite yet. Take another look and try again." : "Your work is saved. Ask your parent for help, or continue." : "Your work is saved for your parent to review. You can continue."}</div>}
      {error && <div role="alert" className="notice">{error}</div>}
      <div className="row" style={{ justifyContent: "space-between" }}><button className="ghost" disabled={busy || index === 0} onClick={() => navigate(index - 1)}>Previous</button><div className="row">{!locked && <button className="primary" onClick={check} disabled={busy || (!hasValue && !hasDrawing)}>{busy ? "Saving…" : q.type === "long_text" || q.type === "handwriting" ? "Submit for review" : feedback ? "Try again" : "Check answer"}</button>}{locked && <button className="primary" disabled={busy} onClick={() => index < questions.length - 1 ? navigate(index + 1) : setFinished(true)}>{index < questions.length - 1 ? "Next question" : "Finish practice"}</button>}</div></div>
    </article>
  </main>;
}
