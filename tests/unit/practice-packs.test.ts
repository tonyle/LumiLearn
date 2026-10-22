import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { questionSetSchema } from "@/lib/question-schema";
import { gradeDeterministic } from "@/lib/grading";
const types = ["single_choice", "multiple_choice", "number", "short_text", "ordering", "true_false", "long_text", "handwriting"];
describe("grade-level practice packs", () => {
  const sets = readdirSync("examples/coppell").filter(file => file.endsWith(".json")).map(file => questionSetSchema.parse(JSON.parse(readFileSync(`examples/coppell/${file}`, "utf8"))));
  it("covers the six requested grade and subject combinations", () => {
    expect(sets.map(set => `${set.grade}:${set.subject}`).sort()).toEqual(["1:math", "1:reading", "3:math", "3:science", "5:math", "5:science"]);
    expect(sets.reduce((count, set) => count + set.questions.length, 0)).toBe(72);
  });
  for (const set of sets) it(`${set.setId} validates, covers all formats, and has grade-consistent questions`, () => {
    expect([...new Set(set.questions.map(q => q.type))].sort()).toEqual([...types].sort());
    expect(set.curriculum.alignmentStatus).toBe("general_practice");
    for (const q of set.questions) {
      expect(q.grade).toBe(set.grade); expect(q.subject).toBe(set.subject);
      const key = q.answer;
      const value = key.kind === "option_id" ? key.optionId : key.kind === "option_ids" ? key.optionIds : key.kind === "number" ? key.value : key.kind === "boolean" ? key.value : key.kind === "ordered_ids" ? key.orderedIds : key.kind === "text" ? key.accepted[0] : key.sampleAnswer;
      expect(gradeDeterministic(key, { value }).verdict).toBe(key.kind === "rubric" ? "needs_review" : "correct");
    }
  });
});
