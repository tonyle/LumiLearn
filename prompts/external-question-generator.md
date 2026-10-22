# Generate a LumiLearn worksheet

## Cách sử dụng

1. Điền lớp, môn và chủ đề trong phần **Worksheet request** bên dưới.
2. Gửi prompt này kèm `schemas/question-set.schema.json` cho AI. Nếu dùng Codex trong project EasyLearn, yêu cầu đọc trực tiếp schema và `lib/question-schema.ts`.
3. Mỗi lần tạo **một worksheet đúng 10 câu**, lưu thành một file `.json`, rồi đưa vào **Parent → Import questions** để kiểm tra và import.
4. Nếu cần nhiều bài, tạo từng file riêng với `setId` khác nhau. Sau khi import, chọn **Create worksheet & assign** hoặc **Question library → Choose questions**: chọn đúng 10 câu, xem Preview rồi chọn học sinh và Assign. Prompt này không tự giao bài cho học sinh.

Ví dụ yêu cầu cho Codex:

> Read prompts/external-question-generator.md and the current schemas. Generate one Grade 3 math worksheet about multiplication and division, with exactly 10 questions at grade_level difficulty. Use practice mode, English questions and no Vietnamese translations. Save the validated JSON to examples/generated/grade3-math-multiplication-division-lesson-01-v1.json. Do not import, assign or change existing student work.

## Worksheet request

- Grade: [GRADE — for example "1", "3", or "5"]
- Subject: [SUBJECT — math, reading, writing, science, or social_studies]
- Topic: [TOPIC]
- Difficulty: [DIFFICULTY — review, grade_level, or advanced; default: grade_level]
- Format mode: [FORMAT_MODE — practice or format_test; default: practice]
- Optional preferred question types: [PREFERRED_TYPES — default: choose types suited to the topic]
- Vietnamese prompt translations: [INCLUDE_VI — true or false; default: false]
- Worksheet ID: [SET_ID — optional; otherwise generate a new descriptive ID ending in a lesson number and version]
- Worksheet title: [TITLE — optional; otherwise generate a short learner-friendly title]
- Curriculum references supplied by the parent: [REFERENCES — default: none]

Grade 1 word/vocabulary practice uses subject `reading`; `word` is not a supported subject. For this family's usual practice, Grade 1 uses math and reading, while Grades 3 and 5 use math and science. Follow the specific request when it differs.

## Generation instructions

You author original elementary-school worksheets for LumiLearn Home / EasyLearn. Read the supplied `schemas/question-set.schema.json` and follow it exactly. When repository access is available, also read `lib/question-schema.ts`, which enforces additional semantic rules. Do not rely on an older example that contains fewer or more than ten questions.

If grade, subject or topic is missing, ask only for the missing information before generating. Otherwise, apply the defaults above and generate the worksheet without further questions.

### Output contract

- Return exactly one JSON object matching schema version `1.0.0`. Do not return a JSON array, Markdown fences, explanations, comments, trailing commas or unfinished placeholders.
- Include exactly **10 distinct questions** in the `questions` array. One object represents one lesson; do not produce a 12-question pack or several lessons inside the same object.
- Use `locale: "en-US"`, the requested grade as a string, and the exact supported subject code. Repeat the same grade and subject on every question.
- Include `schemaVersion`, `setId`, `title`, `description`, `locale`, `grade`, `subject`, `source`, `curriculum` and `questions` at the top level. Do not add unsupported top-level fields.
- Set `source.type` to `ai_generated`. Name the actual generator if known; otherwise omit `source.generator`. Use empty `referenceUrls` and `documentIds` arrays unless real references were supplied or inspected.
- Give the worksheet a new `setId` and questions unique `externalId` values such as `g3-math-multdiv-l01-v1-q01` through `g3-math-multdiv-l01-v1-q10`. Never reuse IDs to replace an existing worksheet silently.
- Every question must include `externalId`, `type`, `prompt`, `grade`, `subject`, `difficulty`, `tags`, `standardCodes`, `options`, `answer`, `grading`, `parentExplanation` and `assets`. Use `metadata: {}` unless meaningful non-private metadata is needed.
- Use `prompt.format: "plain"`. Put only the question and its necessary instructions in `prompt.text`; the app adds question numbers and option letters.
- LumiLearn awards **10 points per correct question**, for a total of **100 points**. Do not invent `points`, `score`, timer, student, assignment or due-date fields in this JSON. Pause/Resume, timing and assignment are application features.

### Paper and iPad usability

Questions must work both on a printed US Letter worksheet and with a pen on an iPad. Use short, clear directions and allow the learner to write a final answer, circle choices, write an ordered sequence or draw in the answer space.

Keep each question concise, normally one to three short sentences. Use plain text and readable arithmetic symbols. Avoid HTML, LaTeX commands, Markdown tables, drag-and-drop directions, audio, video, web links and instructions that require clicking interface elements.

Every question must be self-contained. Include any necessary original reading passage, facts or data directly in the prompt. Do not depend on another question being visible or answered correctly. Never refer to an absent illustration, chart or attachment. Use `assets: []` unless the parent explicitly supplied an existing supported local asset reference; never fabricate a path or fetch a remote asset.

Use age-appropriate vocabulary and arithmetic. Grade 1 directions should be especially short. In science, test the requested concept rather than obscure vocabulary or unstated background knowledge. Use fictional names and situations, never private student information.

### Question formats and answer keys

Use only these supported combinations:

| `type` | `answer.kind` | Requirements |
| --- | --- | --- |
| `single_choice` | `option_id` | At least two choices; exactly one defensible answer. |
| `multiple_choice` | `option_ids` | Say “Choose all that apply”; list every correct option ID exactly once. |
| `number` | `number` | Finite numeric `value`, explicit non-negative `tolerance`, and `unit` set to a string or null. |
| `short_text` | `text` | Supply literal acceptable answers in `accepted`; normally use `normalization: "trim_casefold"`. |
| `ordering` | `ordered_ids` | At least two items; include every item ID once in the correct sequence. |
| `true_false` | `boolean` | Use a JSON boolean, never the strings "true" or "false". |
| `long_text` | `rubric` | Specific assessable criteria with weights summing to 1, plus a private `sampleAnswer`. |
| `handwriting` | A supported answer kind | Use number/text/boolean/option keys for an objective written answer; use a rubric for a drawing or open explanation. |

For choice and ordering questions, give options distinct IDs such as `a`, `b`, `c`, `d`, without embedding those labels in `options[].text`. Use at most eight options. All answer references must match existing option IDs. For objective handwriting questions that use option or ordering keys, also provide the referenced options.

Use `options: []` for questions without choices. For exact whole-number math, use `tolerance: 0`. Store a numeric fraction answer as its numeric value, rather than a fraction string. State any required unit in the prompt and use a matching `answer.unit`; otherwise use `unit: null`.

For short text, enumerate legitimate spelling or wording variants where appropriate. If many different explanations could be correct, use `long_text` with a rubric instead of an overly narrow short-text key.

Set `grading.mode: "deterministic"` for objective answer keys and `grading.mode: "ai"` for rubrics, unless the parent specifically requests `parent_review`. Use `grading.maxAttempts: 3`. A handwriting question can still use an objective key: the app reads the handwriting before checking that key. Rubrics describe what makes an answer correct; do not define a conflicting partial-point scale.

In `practice` mode, choose an educationally useful mix. Prefer objective, locally checkable answer keys for math, factual science and vocabulary. Add open responses only when they help assess understanding; do not force all eight formats into every topic.

In `format_test` mode, cover all eight types exactly once, then add two distinct objective questions suited to the topic, for exactly ten questions in total. If a preferred-type list conflicts with this mode, the explicit all-format testing requirement takes precedence.

### Private explanations, translations and curriculum

Every question needs `parentExplanation.reasoning` and a concise, step-by-step `parentExplanation.steps` array. Independently solve the question first, then make the explanation agree with the answer key and rubric sample.

Keep answers, worked solutions, answer hints and rubric samples exclusively in the private `answer` and `parentExplanation` fields. Never put them in the title, description, tags, prompt, options as correctness annotations, asset descriptions or translations. Ordinary values and answer choices needed to pose the problem are allowed.

When translations are disabled, omit `studentTranslation`. When enabled, use `studentTranslation: {"vi": "..."}` to translate only the learner-facing prompt faithfully. Do not translate the solution or introduce an answer hint. If a translation might disclose an answer or undermine a reading/vocabulary skill, omit it and use `prompt.translationPolicy: "disabled"`; otherwise use `allowed`. Use `paragraph_only` only when full-passage translation is appropriate. Follow the application's translation checks, not just JSON syntax.

For general Coppell-area practice, use `curriculum.framework: "TEKS"` without claiming the worksheet is an official Coppell ISD assessment. Unless specific standards were actually verified against supplied or inspected official references, use empty `curriculum.standardCodes` and per-question `standardCodes` arrays, with `curriculum.alignmentStatus: "unverified"`. Never invent standards codes, source URLs, document IDs or claims of verified alignment.

### Final checks before output

Silently verify all of the following, repairing the worksheet before returning it:

1. The complete output parses as JSON and matches the current schema and supported field names.
2. There are exactly ten distinct, fully written questions, with consistent grade, subject and difficulty.
3. Every required field is present, identifiers are unique, and no unsupported fields or placeholder text remain.
4. Each mathematical answer was recalculated; factual answers are accurate and the prompt supplies enough information.
5. Choice questions have no duplicate choices, ambiguous keys, accidental multiple correct answers or predictable answer-position pattern.
6. Referenced option IDs exist; selected IDs are unique; ordering keys contain every item once.
7. Numeric values, tolerances, units and accepted text variants match the prompt. Rubric weights sum to 1 and the sample answer satisfies every criterion.
8. Explanations match the keys. Student-facing content contains no solutions or revealing translations.
9. Each question is readable on paper, answerable with a pen, original and appropriate for the requested grade and topic.
10. Curriculum and source claims are supported; otherwise their arrays remain empty and alignment is unverified.

If running as Codex with filesystem access and the user requested a file, save the object at the requested path and run `npm run validate:questions -- path/to/file.json`. Also verify that the saved array has exactly ten questions; the shared import schema permits larger banks. Fix reported errors before finishing. Report validation honestly and do not claim to have run a command that was unavailable. Importing into the database, publishing and assigning to students are separate actions: do them only when the user explicitly requests them.

For a chat-only response, return only the final JSON object after these checks.
