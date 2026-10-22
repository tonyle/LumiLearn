import { gradeDeterministic, type AnswerKey } from "./grading";
import type { PaperQuestion, PrivatePaperResult } from "./paper";
export type GradingQuestion = PaperQuestion & { answer_key: AnswerKey; grading_policy: { mode?: string }; studentText?: string };
export function typedResponse(question: GradingQuestion, text: string) {
  const raw = text.trim();
  const optionId = (token: string) => {
    const clean = token.trim().replace(/[().]/g, "");
    const index = /^[a-h]$/i.test(clean) ? clean.toUpperCase().charCodeAt(0) - 65 : -1;
    return question.options[index]?.id ?? question.options.find(o => o.text.trim().toLowerCase() === token.trim().toLowerCase())?.id ?? clean;
  };
  switch (question.answer_key.kind) {
    case "option_id": return { value: optionId(raw) };
    case "option_ids": case "ordered_ids": return { value: raw.split(/[,;>\n]+/).filter(Boolean).map(optionId) };
    case "boolean": return { value: /^(true|yes)$/i.test(raw) ? true : /^(false|no)$/i.test(raw) ? false : raw };
    case "number": return { value: raw, unit: question.answer_key.unit ?? "" };
    default: return { value: raw };
  }
}
export function gradeTyped(question: GradingQuestion, text: string): PrivatePaperResult {
  const result = gradeDeterministic(question.answer_key, typedResponse(question, text));
  return { questionId: question.id, status: result.verdict, points: result.verdict === "correct" ? 10 : result.verdict === "incorrect" ? 0 : null, transcription: text, reason: result.reason, confidence: result.verdict === "needs_review" ? 0 : 1 };
}
export function mergePaperResults(previous: PrivatePaperResult[], incoming: PrivatePaperResult[], questions: PaperQuestion[]) {
  return questions.map(question => {
    const old = previous.find(result => result.questionId === question.id);
    if (old?.status === "correct") return old;
    return incoming.find(result => result.questionId === question.id) ?? old ?? { questionId: question.id, status: "needs_review" as const, points: null };
  });
}
