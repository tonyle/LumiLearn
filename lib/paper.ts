import { z } from "zod";
export const QUESTIONS_PER_PAGE = 10;
export const PAPER_WIDTH = 1000;
export type PaperQuestion = { id: string; type: string; prompt: { text: string }; options: { id: string; text: string }[] };
export const inkStrokeSchema = z.object({ tool: z.enum(["pen", "eraser"]), points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), p: z.number().min(0).max(1) })).min(1).max(1500) }).strict();
export const paperAnswerSchema = z.object({ strokes: z.array(inkStrokeSchema).max(200), text: z.string().max(12000) }).strict();
export const paperDraftSchema = z.record(z.string().uuid(), paperAnswerSchema).superRefine((draft, context) => {
  if (Object.keys(draft).length > 10 || Object.values(draft).reduce((n, a) => n + a.strokes.reduce((m, s) => m + s.points.length, 0), 0) > 20000) context.addIssue({ code: "custom", message: "Page drawing is too large." });
});
export type InkStroke = z.infer<typeof inkStrokeSchema>;
export type PaperDraft = z.infer<typeof paperDraftSchema>;
export type PaperResult = { questionId: string; status: "correct" | "incorrect" | "needs_review"; points: number | null };
export type PrivatePaperResult = PaperResult & { transcription?: string; reason?: string; confidence?: number };
export type PaperFeedback = { status: string; results: PaperResult[]; earned: number; maximum: number; pending: number; runId?: string; message?: string };
export type PaperState = { revision: number; draft: PaperDraft; feedback: PaperFeedback | null; clock?: import("./study-clock").StudyClock | null };
export function safePaperFeedback(status: string, results: PrivatePaperResult[], count: number, runId?: string): PaperFeedback {
  return { status, results: results.map(({ questionId, status, points }) => ({ questionId, status, points })), earned: results.reduce((sum, r) => sum + (r.points ?? 0), 0), maximum: count * 10, pending: count - results.filter(r => r.points !== null).length, ...(runId ? { runId } : {}) };
}
function optionLines(question: PaperQuestion) {
  return question.type === "true_false" ? ["True / False — circle one or write your answer"] : question.options.flatMap((option,i)=>wrapText(`${String.fromCharCode(65+i)}. ${option.text}`,48));
}
export function pageLayout(questions: PaperQuestion[], startNumber: number) {
  let y = 124;
  return questions.map((question, index) => {
    const prompt = wrapText(question.prompt.text, 44);
    const options = optionLines(question);
    const height = Math.max(290, 68 + prompt.length * 23 + options.length * 20 + 132);
    const left = index % 2 === 0;
    // Each pair shares enough room for the larger question; answer regions never overlap.
    const previous = questions[index - 1];
    if (left && index > 0) {
      const prevPrompt = wrapText(previous.prompt.text, 44);
      const prevOptions = optionLines(previous);
      const prevHeight = Math.max(290, 68 + prevPrompt.length * 23 + prevOptions.length * 20 + 132);
      const other = questions[index - 2];
      const otherHeight = Math.max(290, 68 + wrapText(other.prompt.text, 44).length * 23 + optionLines(other).length * 20 + 132);
      y += Math.max(prevHeight, otherHeight) + 16;
    }
    const x = left ? 40 : 510;
    const answerY = y + 46 + prompt.length * 23 + options.length * 20 + 12;
    return { question, number: startNumber + index, x, y, width: 450, height, prompt, options, answer: { x: x + 16, y: answerY, width: 418, height: 120 } };
  });
}
export function paperHeight(questions: PaperQuestion[], startNumber: number) {
  return Math.max(600, ...pageLayout(questions, startNumber).map(cell => cell.y + cell.height + 60));
}
export function wrapText(text: string, limit: number): string[] {
  return text.split("\n").flatMap(paragraph => {
    const lines: string[] = []; let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + " " + word).length > limit) { lines.push(line); line = ""; }
      if (word.length > limit) { if(line) { lines.push(line); line=""; } for(let i=0;i<word.length;i+=limit)lines.push(word.slice(i,i+limit)); }
      else line += (line ? " " : "") + word;
    }
    if (line || !lines.length) lines.push(line);
    return lines;
  });
}
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export function paperSvg(questions: PaperQuestion[], title: string, pageIndex: number, draft: PaperDraft = {}, includeInk = true) {
  const layout = pageLayout(questions, pageIndex * QUESTIONS_PER_PAGE + 1), height = paperHeight(questions, pageIndex * QUESTIONS_PER_PAGE + 1);
  const blocks = layout.map(cell => {
    const answer = draft[cell.question.id];
    const lines = [...cell.prompt.map((line, i) => `<text x="${cell.x + 16}" y="${cell.y + 49 + i * 23}" font-size="17">${escape(line)}</text>`), ...cell.options.map((line, i) => `<text x="${cell.x + 22}" y="${cell.y + 49 + cell.prompt.length * 23 + i * 20}" font-size="15">${escape(line)}</text>`)];
    let ink = "";
    if(includeInk) for(const [index,stroke] of (answer?.strokes??[]).entries()) {
      const path=stroke.points.map((point,i)=>`${i?"L":"M"}${(point.x*cell.width).toFixed(2)},${(point.y*cell.height).toFixed(2)}`).join(" ")+" l.1,.1";
      if(stroke.tool==="pen") ink+=`<path d="${path}" fill="none" stroke="#172554" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      else {const mask=`erase-${cell.number}-${index}`;ink=`<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="450" height="${cell.height}"><rect width="450" height="${cell.height}" fill="white"/><path d="${path}" fill="none" stroke="black" stroke-width="20" stroke-linecap="round"/></mask></defs><g mask="url(#${mask})">${ink}</g>`;}
    }
    const typed = includeInk && answer?.text ? wrapText(answer.text, 44).slice(0, 6).map((line, i) => `<text x="5" y="${18 + i * 19}" font-size="15" fill="#172554">${escape(line)}</text>`).join("") : "";
    return `<g font-family="Georgia,serif" fill="#243247"><rect x="${cell.x}" y="${cell.y}" width="450" height="${cell.height}" rx="5" fill="white" stroke="#cbd5e1"/><text x="${cell.x + 16}" y="${cell.y + 23}" font-size="14" font-weight="bold">${cell.number}.  ·  10 points</text>${lines.join("")}<rect x="${cell.answer.x}" y="${cell.answer.y}" width="418" height="120" fill="white" stroke="#dbe3ed" stroke-dasharray="3 4"/><g transform="translate(${cell.answer.x},${cell.answer.y})"><svg width="418" height="120" viewBox="0 0 418 120">${typed}</svg></g><g transform="translate(${cell.x},${cell.y})"><svg width="450" height="${cell.height}" viewBox="0 0 450 ${cell.height}">${ink}</svg></g></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><rect width="1000" height="${height}" fill="#fffefb"/><text x="40" y="44" font-family="Georgia,serif" font-size="25" fill="#243247">${escape(title.slice(0, 70))}</text><text x="40" y="78" font-family="sans-serif" font-size="14" fill="#64748b">Page ${pageIndex + 1} · ${questions.length} questions · ${questions.length * 10} points · Write in the boxes or circle your choices</text><line x1="40" x2="960" y1="96" y2="96" stroke="#243247"/>${blocks.join("")}</svg>`;
}
