# Home Learning Studio — Codex Master Build Plan

> Version 1.0 | October 2026 | Language: English technical specification; student-facing English, parent-facing Vietnamese/English | Target: fully functioning LOCAL self-hosted family app for three children, accessed on iPads over home Wi-Fi.

## 0. MANDATORY CODEX EXECUTION CONTRACT

You are Codex, acting as lead product engineer, full-stack developer, designer, QA engineer and technical writer. **Build the actual working application**, not merely a mockup, boilerplate, design document or collection of TODOs. Read this document and `database/schema.sql` fully before writing code. Execute the phases sequentially, run tests and fix errors, and deliver a usable local application. Do not stop after scaffolding. If context/time limits interrupt work, write `IMPLEMENTATION_STATUS.md` listing completed work, exact next actions, blockers and verification commands; resume from it. Do not claim functionality that is not implemented. If external credentials are unavailable, implement deterministic demo fixtures and clearly mark external AI calls as unconfigured, without pretending that they work. Avoid blocking on questions; use the defaults below. Keep scope achievable, but deliver every core requirement before extras.

**Acceptance definition:** From a clean checkout on a machine with Docker installed, `cp .env.example .env`, `docker compose up --build -d`, `docker compose exec app npm run db:migrate`, `docker compose exec app npm run db:seed`, and visiting `http://<HOST_LAN_IP>:3000` on an iPad must launch a complete, usable application. The exact commands may be adjusted if justified, but must be documented and tested. Provide `scripts/smoke-test.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/check-lan.sh`, and `README.md`. Database migration must be idempotent or managed through versioned migrations. No paid cloud dependencies for core functions; OpenAI API is optional and uses a user-supplied key.

**Safety/product contract:** A student sees only correct/incorrect, retry and neutral encouragement. Never expose correct answers, solution steps, rubric, grading reasoning or parent commentary through student UI, API, browser payloads, HTML, logs, network requests or translation. Enforce on SERVER with separate response serializers and authorization. A parent can see answers, explanations, attempt history and confidence/uncertainty. If an answer cannot be evaluated reliably, show `needs_review`, not an invented correct/incorrect. Never send API keys to browser. Parent access must require authenticated parent session and PIN/password; student sessions must not be able to access parent APIs. Provide a prominent parent override/correction mechanism.

## 1. PRODUCT VISION AND SCOPE

Product name: **LumiLearn Home** (configurable). Premium, warm, calm, child-friendly educational workspace for three children. Parent scans/uploads worksheets, reviews AI-extracted questions, assigns exercises, tracks work, sees explanations and weak skills. Children complete worksheets on iPad with touch, keyboard or Apple Pencil, submit and receive only right/wrong, with retry. Optional AI-generated exercises aligned to *documented* Texas TEKS standards and parent-imported Coppell ISD curriculum documents. Other AI systems can generate exercises using a strict portable JSON format. English-to-Vietnamese tap-word dictionary and paragraph translation available in student mode without giving away answers.

### Explicit boundaries
- Do **not** claim official affiliation with Coppell ISD. TEKS mapping is a reference catalog, not a guarantee of what the child's teacher teaches this week. Parent imports syllabi, lesson plans and school handouts they are authorized to use. Track source URLs, documents, versions and dates. Never fabricate standard codes.
- **Local-only** deployment: host runs on home PC/Mac/Linux; iPads connect via `http://HOST_IP:3000` over same trusted LAN. No port forwarding to public Internet by default. Host firewall must allow TCP 3000 from LAN only. Optional Tailscale for remote access must be separately configured and never assumed.
- Browser/PWA, not native App Store. Touch and Pencil support via Pointer Events and canvas; handwriting OCR is fallible and requires confirmation/uncertainty handling. Offline read caching optional; submission requires host connection.
- English is primary worksheet language; Vietnamese is translation/support language. Parent UI locale toggle EN/VI. Student prompts can be English with Vietnamese translation on demand.
- Support Kindergarten through Grade 12 in data model, with initial UI polished for elementary Grades K–5.
- Store personal data locally. No third-party analytics, ad SDKs or unnecessary child identifiers. Use pseudonyms/nicknames. Before sending child handwriting/text/images to an external AI service, parent must explicitly opt in, with notice and an on/off setting. Avoid including names, school IDs or faces. Implement delete/export controls.

## 2. RECOMMENDED STACK (PIN VERSIONS AT IMPLEMENTATION TIME)

- Next.js App Router + TypeScript strict mode, React, Tailwind CSS, shadcn/ui + Radix primitives, Lucide icons; install stable mutually compatible versions and commit lockfile. Responsive tablet-first PWA; use server actions/routes where appropriate, with explicit API endpoints for sensitive operations.
- PostgreSQL 16 via Docker Compose; Prisma ORM (or Drizzle if necessary) with versioned migrations. **The supplied `database/schema.sql` is the canonical logical baseline; ensure ORM and actual migrations faithfully implement it.** If choosing Prisma, include migration SQL that matches the schema and run consistency checks.
- Zod for validation; React Hook Form for forms; TanStack Query if useful for caching; `react-konva` or native HTML Canvas/Pointer Events for Pencil overlay (prefer robust pointer events with pressure, eraser, undo/redo). PDF.js for PDF rendering, `pdf-lib` for annotations/export. Use `sharp` for server-side image normalization. Never execute arbitrary uploaded content.
- AI: OpenAI API from server only, configured via `OPENAI_API_KEY`, `OPENAI_MODEL`, optional separate vision model. Implement provider interface `AiProvider` with `extractWorksheet`, `gradeOpenResponse`, `generateQuestions`, `translate`, `explainToParent`; deterministic no-key fallback for seeded demo and exact-match graders. Use structured JSON outputs and Zod validation; timeouts, retry with backoff, concurrency limits, budget cap and error reporting. No reliance on ChatGPT subscription.
- Deterministic grading: numeric math, normalized text, multiple-choice, multiple-select, ordering and tolerance-based answers handled in code. AI grading reserved for subjective or ambiguous responses. Do not allow arbitrary JavaScript or eval in imported question logic.
- Auth: locally stored parent credentials hashed with Argon2id, secure HTTP-only SameSite cookies; student profile selection + optional 4–6 digit child PIN. For plain HTTP on LAN, cookies must work without `Secure` flag; enable Secure under HTTPS. Parent re-auth/PIN required to reveal answer keys. CSRF protection on mutating endpoints; request throttling; session expiry. Do not expose parent secrets via client state.
- Testing: Vitest unit tests, React Testing Library, Playwright end-to-end with tablet/iPad-sized viewports, API integration tests against disposable DB; axe accessibility checks where possible.

## 3. INFORMATION ARCHITECTURE AND ROUTES

Public/local setup: `/setup` first-run parent creation; `/login` parent login; `/kids` child profile picker; `/offline` connection instructions.

Student: `/s/[studentId]/home` today's assignments, streaks without shame; `/s/[studentId]/assignment/[assignmentId]` question player; `/s/[studentId]/worksheet/[assignmentId]` PDF/scan annotation mode; `/s/[studentId]/review/[submissionId]` right/wrong only; `/s/[studentId]/library` assigned practice; `/s/[studentId]/words` saved vocabulary with simple meanings. Student navigation cannot link to parent content.

Parent: `/parent` dashboard; `/parent/students` profile settings; `/parent/upload` image/PDF upload, crop/rotate, page previews, extraction review; `/parent/question-bank` searchable questions; `/parent/questions/[id]` editor/answer key; `/parent/import` JSON import with preview and error report; `/parent/assignments` create/schedule/assign; `/parent/submissions/[id]` student answer, attempts, reason, worked solution; `/parent/curriculum` TEKS catalog and Coppell documents; `/parent/generate` AI exercise generator; `/parent/insights` progress and skill breakdown; `/parent/translations` translation history and cache; `/parent/settings` keys/budgets/provider, privacy, backup, account.

Shared: accessible dialog/toast/loading/error boundaries; persistent app status indicator (Local host online / AI enabled / AI disabled); parent-only help panel.

## 4. VISUAL DESIGN SYSTEM — HIGH-END IPAD UI

Design intent: **warm editorial learning studio**, not a generic SaaS dashboard or neon cartoon. Visual identity: creamy background `#F8F7F3`, ink `#1E293B`, indigo `#4F46E5`, teal `#0F766E`, amber `#F59E0B`, muted coral `#E87979`, white cards. Use CSS variables for tokens; WCAG AA contrast; avoid relying on color alone. Typography: `Nunito Sans` or `Inter` with locally bundled or system-safe fallbacks (do not depend on Google Fonts at runtime). Rounded 20–28px cards, subtle shadows, 8px spacing grid, generous whitespace, gentle motion respecting reduced-motion. Use CSS illustration and Lucide icons; no mandatory remote image assets.

### Student UI (priority)
- iPad landscape 1024×768 and portrait 768×1024 optimized; also iPad Pro 1366×1024. Main frame: compact header with avatar and lesson title, clear progress bar, center question surface, sticky bottom action bar; no crowded sidebars.
- Student home: large welcome greeting, one dominant `Continue Learning` card, 2–3 smaller assignment cards, progress without grade-shaming, subject chips, parent-assigned weekly schedule.
- Question player: question number, optional TEKS skill chip, large English prompt, accessible inline word tap targets, discreet `Translate paragraph` button, question content (text/diagram/image), input controls sized >=44px, `Check answer` button, feedback with check or retry icon and text; never display correct answer on failure. Preserve draft and autosave. Allow retries per assignment policy. If needs review, say `Your answer is being reviewed` (do not mark wrong).
- Translation popover: tap a *word* in English prompt to see Vietnamese meaning, English definition (optional), pronunciation text, example **unrelated to the answer**, `Save word`; preserve punctuation and keyboard selection. `Translate paragraph` reveals Vietnamese rendering beneath the English text, with hide toggle. Clearly label machine translation. No word lookup on protected answer/rubric/solution fields; avoid translating math operators/numbers incorrectly. Cache per content hash+locale+version. Pre-compute safe translations for assigned prompts when possible. Student cannot submit arbitrary hidden text for translation to probe parent answers.
- Worksheet mode: original scanned page/PDF page rendered with correct aspect ratio, transparent drawing canvas overlay supporting Pencil/touch pressure, pen colors limited to dark blue/black, eraser, undo/redo, zoom/pan, autosave per page, explicit `Submit worksheet`; handwriting recognition preview lets student confirm recognized responses where possible. Parent can map answer regions per question; grading never guesses based solely on ambiguous ink. Store vector strokes and optionally raster snapshots; PDF exports preserve annotations.
- Feedback: correct = calm success, incorrect = neutral retry, no confetti overload, no discouraging score labels. Accessibility screen reader announcements.

### Parent UI
- Tablet/desktop two-column responsive dashboard: left navigation rail, top bar with student switcher, overview metric cards, completion timeline, `Needs attention` queue and recent submissions. Use restrained charts with labeled axes.
- Upload review: side-by-side document preview and editable extracted question cards with confidence badges, answer key and standards mapping; **must require parent approval before assigning**.
- Question editor: rich text/Markdown-safe formatting, answer types, accepted answers, grading policy, solution steps and teacher notes in separate protected tabs; preview student view.
- Import wizard: drag/drop JSON, schema validation, per-question warnings, duplicate detection, preview, select destination, import dry-run and confirmation. Errors include JSON pointer and actionable messages.
- Insights: accuracy by skill over time, retries, time spent (avoid intrusive surveillance), translations requested, concepts needing review. Student-specific filters.
- Empty states and skeletons must be thoughtfully designed; dark mode optional only after light mode is complete.

## 5. CORE DOMAIN MODEL

Student, parent account, sessions, subject, curriculum source, standard, student standard progress, document upload, worksheet page, question bank, question version, accepted answers and grading policy, question-set import, assignments and assignment questions, attempts/submissions, answer records, grading records, handwriting strokes, translation cache, saved vocabulary, AI job logs, audit events, settings. See `database/schema.sql` for actual schema. Do not put solutions in student API DTOs. Immutable published question snapshots ensure old submissions remain interpretable after edits. Store UTC timestamps; display in configured family time zone (`America/Chicago` default).

## 6. WORKFLOWS / BEHAVIOR

### A. First-run
1. Host starts; healthcheck and DB migration; `/setup` shown only if no parent exists.
2. Parent creates password (>=12 characters), optionally PIN, 3 student nicknames/grades, locale and timezone. Seed demo questions only if parent explicitly selects sample data.
3. Parent dashboard prompts to add exercises or upload.

### B. Scan/import worksheet
1. Parent uploads JPG/PNG/HEIC (if converter supported) or PDF, up to configurable 20MB and 30 pages; enforce MIME sniffing, max dimensions/pages, sanitize filenames, store under private volume.
2. Show thumbnails, rotate/crop/deskew and select pages. AI OCR/vision optional; if no API key, permit manual transcription and region annotation.
3. Extraction returns question segments, original page bbox, text, choice options, diagrams/asset references, proposed answers with confidence and uncertainty flags. NEVER silently publish proposed answer key.
4. Parent edits and verifies each question, accepted answers, question type, standards and solution; approve and save version. Invalid/low-confidence items flagged. Can instead assign ungraded annotated worksheet for parent review.
5. Assign to one or multiple children with due date and retry policy.

### C. Student answering and grading
1. Student session authorizes assigned work only; GET student question DTO excludes protected fields (answer keys, grading logic, solutions, teacher notes, AI prompt internals).
2. Autosave drafts with optimistic UI and server persistence; idempotency key per submit.
3. On submit, server loads trusted answer key and grading policy from DB. Exact/numeric/multiple-choice graders deterministic; normalize Unicode and whitespace carefully; numeric fractions and units handled according to configured policy; do not silently equate distinct units. For subjective answer, server may call AI with rubric and require structured result `{verdict: correct|incorrect|needs_review, confidence, private_reason, private_solution, flags}`; low confidence -> `needs_review`.
4. Persist attempt number, response, grading engine/model, result, private explanation, duration, timestamps and audit record transactionally.
5. Student receives only `{questionId, status: correct|incorrect|needs_review, canRetry, attemptNumber, feedbackCode}`. **No solution, correct answer, hint containing answer, rubric or private reason**, including hidden props or websocket payload.
6. Incorrect answers retry until policy limit. If retry limit reached, student sees neutral `Ask your parent for help`, never solution. Parent may reopen or override verdict; overrides are audited.
7. Parent review shows original response, answer, concise reason, step-by-step explanation, model confidence, flags and override controls. If solution not prewritten, generate on-demand and label as AI-generated.

### D. Generate curriculum-based questions
1. Parent chooses student/grade/subject/skill/TEKS code, difficulty, number, language, answer types and learning objective.
2. Retrieve only standards from imported/verified local catalog and school documents; display provenance and coverage. If no exact alignment source, label `general grade-level practice` and do not invent Coppell alignment.
3. AI produces `question-set.schema.json` compliant output with answer keys and worked solutions. Server validates structure and math answer consistency where possible, checks duplicates, content safety and grade appropriateness; parent previews/approves before assignment.
4. Record provider/model, prompt version, source document IDs and generation cost estimate. Retry safely if malformed; never auto-publish invalid data.

### E. JSON import from ANY AI provider
1. Accept `.json` UTF-8 only, <=10MB. Parse with strict Zod/JSON Schema validation, no eval, no remote file URLs fetched by default, no HTML scripts. Reject unknown schema major versions; preserve optional metadata.
2. Validate set metadata, question IDs, types, prompt content, options uniqueness, answer shape, solutions, translations and references. Run semantic validators: MCQ answer references existing option, number tolerances nonnegative, min/max bounds, no answer exposed in student-visible translation/hint fields, safe Markdown only.
3. Detect duplicates using stable external ID + source and normalized content hash. Dry-run returns created/skipped/conflict counts, detailed JSON paths; choose skip/replace-as-new-version, never silently overwrite published items.
4. Import in DB transaction with batch size and rollback on validation error. Log provenance `external_json`, generator name if provided, import hash and time.
5. Export any parent-approved question set back to identical JSON contract for portability. Include sample files and validator CLI `npm run validate:questions -- path/to/file.json`.

### F. English → Vietnamese translation
- Tokenize English prompts with Unicode-aware segmentation; preserve original text and accessible word boundaries. On tap, use local dictionary/cache first; otherwise AI translation server endpoint restricted to actual assigned student-visible prompt tokens, with rate limit. Cache translations by normalized word + surrounding sentence hash to resolve polysemy. Vietnamese meaning, part of speech and optional example. For common words, offline seed dictionary for no-key mode; display `Translation unavailable offline` for misses.
- Paragraph translation: translate only prompt/reading passage/visible choice text, **never** answer key, hidden teacher notes or solution. AI prompt explicitly prohibits answering, explaining or solving the task; require `{translation, detectedLanguage}` structured output. Translation is not guaranteed to be answer-neutral: server runs guard checks (e.g. disallow introducing answer values not in source), and parent can preview/edit/disable translations per question. For answer-bearing vocabulary questions, optionally disable word translation or translate in a neutral manner; parent controls `translation_policy` (`allowed`, `paragraph_only`, `disabled`).
- For image-only text, use OCR of *visible prompt* first, require parent verification when uncertain. Save word taps for personal vocabulary review. No TTS required in MVP; optional browser SpeechSynthesis is not guaranteed across devices.

## 7. JSON IMPORT CONTRACT — REQUIRED IMPLEMENTATION

Create `schemas/question-set.schema.json` using JSON Schema Draft 2020-12, Zod equivalent and example files `examples/question-set.math.json`, `examples/question-set.reading.json`, `examples/question-set.invalid.json`. Top-level structure:

```json
{
  "schemaVersion": "1.0.0",
  "setId": "external-grade3-math-001",
  "title": "Grade 3 Multiplication Review",
  "description": "Practice set",
  "locale": "en-US",
  "grade": "3",
  "subject": "math",
  "source": { "type": "ai_generated", "generator": "Claude/Gemini/ChatGPT", "referenceUrls": [], "documentIds": [] },
  "curriculum": { "framework": "TEKS", "standardCodes": [], "alignmentStatus": "unverified" },
  "questions": [
    {
      "externalId": "q-001",
      "type": "number",
      "prompt": { "format": "plain", "text": "What is 36 × 7?", "translationPolicy": "allowed" },
      "grade": "3", "subject": "math", "difficulty": "grade_level",
      "tags": ["multiplication"], "standardCodes": [],
      "options": [],
      "answer": { "kind": "number", "value": 252, "tolerance": 0, "unit": null },
      "grading": { "mode": "deterministic", "caseSensitive": false, "maxAttempts": 3 },
      "parentExplanation": { "reasoning": "Multiply 36 by 7.", "steps": ["30 × 7 = 210", "6 × 7 = 42", "210 + 42 = 252"] },
      "studentTranslation": { "vi": "36 nhân 7 bằng bao nhiêu?" },
      "assets": [], "metadata": {}
    }
  ]
}
```

**Supported question types and answer discriminated unions:**

| `type` | `answer.kind` | Mandatory answer fields | Student input | Grader |
|---|---|---|---|---|
| `single_choice` | `option_id` | `optionId` | one radio option | deterministic |
| `multiple_choice` | `option_ids` | `optionIds: string[]` | multiple checkboxes | deterministic unordered |
| `number` | `number` | `value`, `tolerance`, optional `unit` | numeric/fraction entry | deterministic |
| `short_text` | `text` | `accepted: string[]`, optional `normalization` | text | deterministic |
| `ordering` | `ordered_ids` | `orderedIds: string[]` | drag reorder | deterministic |
| `true_false` | `boolean` | `value: boolean` | two buttons | deterministic |
| `long_text` | `rubric` | `criteria: [{label, description, weight}]`, `sampleAnswer` | textarea | AI or parent review |
| `handwriting` | `rubric` or compatible typed answer | rubric or answer | Pencil canvas/region | OCR+confirmation then grade, else review |

For `options`, use `[{"id":"a","text":"42"},{"id":"b","text":"252"}]`. `assets` are local relative paths or data manifest references validated by importer; never blindly fetch remote URLs. For `long_text`, student-visible rubric must NOT include private sample answer. Support `explanation` only under `parentExplanation`. `prompt.format` is `plain` or safe `markdown` (sanitize and disable raw HTML). Limit question count (1–200), text lengths, rubric weights sum 1 ± tolerance, options 2–8, unique IDs, and reject invalid answer-type combinations. Provide explicit, helpful error messages.

**Example external AI generation prompt** (also save to `prompts/external-question-generator.md`):

> Generate a strictly valid JSON object for LumiLearn Home schemaVersion 1.0.0, using the exact schema in `schemas/question-set.schema.json`. Output JSON only, no code fences or commentary. Grade: {GRADE}; subject: {SUBJECT}; topic: {TOPIC}; question count: {COUNT}; difficulty: {DIFFICULTY}. English student-facing questions, optional Vietnamese translations faithful to the English without giving away answers. Include correct answer keys, deterministic grading whenever possible, and parent-only step-by-step explanations. Cite TEKS codes only if supplied in the input; otherwise use empty standardCodes and alignmentStatus `unverified`. Avoid copyrighted passages, personal data, ambiguous questions and answer leakage. Ensure IDs unique, MCQ choices plausible and one correct answer for single-choice. Verify calculations before output.

## 8. API DESIGN — AUTHORIZATION FIRST

Use consistent `{data, error, requestId}` envelope for parent endpoints and safe student response DTOs. Validate inputs with Zod, enforce per-resource ownership/assignment, log failures without answer data. Routes:

- `POST /api/setup` first-run only; `POST /api/auth/parent/login`, `POST /api/auth/parent/logout`, `POST /api/auth/student/select`, `POST /api/auth/student/logout`, `GET /api/session` role-safe.
- `GET/POST/PATCH/DELETE /api/parent/students`; `GET /api/parent/dashboard`; `GET /api/parent/insights`.
- `POST /api/parent/uploads`, `GET /api/parent/uploads/:id`, `POST /api/parent/uploads/:id/extract`, `PATCH /api/parent/uploads/:id/questions`, `POST /api/parent/uploads/:id/approve`.
- `GET/POST /api/parent/questions`, `GET/PATCH /api/parent/questions/:id`, `POST /api/parent/questions/:id/publish`, `POST /api/parent/questions/:id/clone`.
- `POST /api/parent/import/validate`, `POST /api/parent/import/commit`, `GET /api/parent/imports`, `GET /api/parent/export/questions/:setId`.
- `GET/POST /api/parent/assignments`, `PATCH /api/parent/assignments/:id`, `POST /api/parent/assignments/:id/assign`.
- `GET /api/student/assignments`, `GET /api/student/assignments/:id`, `PUT /api/student/assignments/:id/draft`, `POST /api/student/assignments/:id/answers`, `GET /api/student/submissions/:id/feedback`, `POST /api/student/worksheets/:id/strokes`.
- `POST /api/student/translate/word`, `POST /api/student/translate/paragraph`, `GET/POST /api/student/vocabulary` (server validates supplied text belongs to assigned visible prompt).
- `GET /api/parent/submissions/:id`, `POST /api/parent/grades/:id/override`, `POST /api/parent/generate`, `GET/POST /api/parent/curriculum`, `GET/PUT /api/parent/settings`, `POST /api/parent/backup` (never allow arbitrary filesystem path).
- `GET /api/health/live`, `GET /api/health/ready` (do not leak secrets).

**Mandatory security tests:** Student cannot GET answer keys through any API; parent routes return 401/403 to student; manipulating student ID/assignment ID does not access another student's work; translating arbitrary text cannot be used as answer oracle; duplicate submit idempotent; malformed JSON does not partially import; uploads cannot path traverse or execute; no API key appears in client bundle or responses.

## 9. DATABASE AND MIGRATIONS

The accompanying `database/schema.sql` defines baseline tables, constraints, indexes, timestamps and relationships. Implement real versioned migrations with ORM and a bootstrap SQL path. Database name `lumilearn`; DB credentials from `.env`. Store uploaded assets in private Docker volume `/app/data/uploads`, referenced by opaque IDs rather than public filesystem paths. Backups include PostgreSQL dump AND uploads/annotations, encrypted or access-controlled; test restore on disposable DB. Use `ON DELETE` semantics that respect data deletion; provide full per-student deletion cascade via application transaction. No data migration may drop tables without explicit operator confirmation.

## 10. LOCAL NETWORK DEPLOYMENT

`docker-compose.yml`: `db` PostgreSQL 16 with healthcheck and named volume; `app` Next.js listening on `0.0.0.0:3000`, port mapping `3000:3000`, depends on healthy DB, restart unless-stopped, private uploads volume. Optional `adminer` must be disabled by default. Environment: `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `APP_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `OPENAI_API_KEY` (optional), `OPENAI_MODEL`, `AI_ENABLED`, `AI_MONTHLY_BUDGET_USD`, `TZ=America/Chicago`, `UPLOAD_MAX_MB`, `LOG_LEVEL`. Generate strong random secrets; never commit `.env`.

iPad instructions: host and iPad on same Wi-Fi (not guest isolated network), find host LAN IP (`ipconfig`/`ifconfig`/`hostname -I`), open `http://192.168.x.x:3000`, Safari Share → Add to Home Screen. Host must stay awake and app running. Local HTTP traffic is unencrypted; trusted LAN only; document optional HTTPS reverse proxy for sensitive deployments. iOS Safari may limit camera/PWA APIs over HTTP, so file upload picker is the reliable baseline; verify actual iPad behavior. Apple Pencil requires compatible iPad/Pencil. No router public port forwarding. Add QR code in parent settings for LAN URL (generated locally).

## 11. QUALITY, ERROR HANDLING AND COST

- AI calls: request ID, model, token counts if available, cost estimate, duration, failure classification; parent budget display. Hard-stop new AI requests above configurable monthly cap, deterministic grading continues. Per-task timeout 30–90 seconds and limited retries. Show actionable error when AI disabled.
- Extraction and generation are async jobs with status queued/running/succeeded/failed and safe retry; avoid hanging HTTP request. DB-backed job queue acceptable for single host. Prevent duplicate jobs with idempotency key.
- Never silently grade AI-uncertain handwriting as wrong; require recognition confirmation or parent review. Keep original strokes and images.
- Protect privacy: local retention settings, redaction before external AI, explicit parental opt-in, delete student records and uploaded data, export records, log retention; avoid exposing child data in diagnostic logs.
- Accessibility: 44px targets, keyboard navigation, visible focus, alt text, screen reader status, reduced motion, high contrast. No hover-only interactions.
- Performance: first interactive on local Wi-Fi target <3s on common iPad; incremental PDF rendering, lazy page load, image thumbnails, avoid massive JSON payloads. Autosave debounce ~1s; recover draft after reload.

## 12. BUILD PHASES AND VERIFIABLE EXIT CRITERIA

### Phase 0 — Repo, design and infrastructure
- Create complete directory structure, package scripts, lint/format, Tailwind tokens, reusable components, Docker, env sample, SQL/ORM migrations, seed data, CI-style test scripts, README.
- Verify fresh `docker compose up --build` and DB readiness; responsive shell renders on 768×1024 and 1024×768.

### Phase 1 — Auth, profiles and polished navigation
- Parent setup/login, student profile picker/PIN, server role enforcement, logout/session expiration, parent/student shells, settings and local LAN instructions.
- Verify unauthorized access, secure cookies, three students seeded or created, complete responsive UI.

### Phase 2 — Question bank, assignments and deterministic grading
- CRUD question editor and publish/version, question set, assign to children, student question player for six deterministic types, draft autosave, retries, server-only grade and parent explanations/overrides.
- Verify correct/incorrect and retry; inspect student API response to ensure no answer leakage; cross-student isolation tests.

### Phase 3 — External JSON import/export
- Formal JSON Schema, Zod validators, sample valid/invalid files, import preview, dry-run, duplicate detection, transactional commit, export, CLI validator, full error messages.
- Verify importing externally generated sample works end-to-end without AI key.

### Phase 4 — Upload, PDF, Pencil and worksheet flow
- Secure upload and preview, crop/rotate, PDF page display, drawing overlay with undo/redo/eraser/zoom, autosave, per-question answer regions, OCR adapter and manual transcription fallback, parent approval, worksheet assignment.
- Verify Pencil-like pointer events via Playwright plus manual iPad QA checklist; save/reload retains strokes; ambiguous OCR -> review.

### Phase 5 — Translation EN→VI
- Word tap popover, contextual meaning, paragraph translation, vocabulary save, cache, optional AI and offline common-word fallback, parent translation controls and answer leakage safeguards.
- Verify Vietnamese Unicode, punctuation, mobile selection, parent-only fields never translated or exposed.

### Phase 6 — AI extraction/generation/grading
- Provider abstraction, server API integration, structured output validation, parent review of generated content, subjective answer review with confidence threshold, cost accounting and budget cap, AI-disabled graceful mode.
- Verify with mock provider and, when key available, real provider integration; never require key for core deterministic features.

### Phase 7 — Curriculum and insights
- Import TEKS catalog with verifiable provenance, local Coppell curriculum document library, alignment labels, standards tagging, grade/subject filters, weekly practice builder, progress/skill reports, translation usage and retries.
- Verify no fabricated TEKS code, reports reconcile with stored attempts, source metadata visible.

### Phase 8 — Hardening, QA and delivery
- Unit/integration/e2e/security/accessibility tests, database backup+restore smoke, upload limits, API rate limits, error boundaries, production build, iPad manual QA guide, screenshots of key pages, demo dataset, final checklist and docs.
- Produce `IMPLEMENTATION_STATUS.md` and `TEST_REPORT.md` with exact commands and results; resolve failing tests before claiming done.

## 13. TEST MATRIX — MUST AUTOMATE

- First-run setup cannot be repeated; parent password hashed; invalid login rate limited.
- Child A cannot access Child B assignments or drafts; child cannot see parent API even by direct URL.
- Student response body, HTML, Next.js hydration payload, translations and logs do not include answer key/solution/private reason.
- Number: `36*7=252` correct, `251` wrong; tolerance boundaries; decimals/fractions/units. Single/multi-choice correct/incorrect; short text normalization; ordering and boolean.
- Wrong answer increments attempt and allows retry; limit reached stops; duplicate request ID does not create duplicate attempts.
- `needs_review` does not count as wrong and notifies parent; parent override changes displayed status and retains audit history.
- JSON valid import, missing field, unknown type, wrong option ID, duplicate IDs, malformed JSON, 201st question, invalid rubric, malicious HTML, large file; rollback on error.
- PDF multiple pages, image rotation, large/invalid upload, undo/redo strokes, autosave after reload, annotation export.
- Word `product` context meaning differs from `product` in math; paragraph translation preserves question intent; translation disabled where parent chooses; offline fallback; no answer leakage.
- AI disabled => manual workflow works, deterministic grade works, translation cache works; budget exhausted => safe error and no call.
- Docker clean build; migrations; seed; smoke; backup and restore; tablet portrait/landscape; no console errors; accessibility checks.

## 14. REPOSITORY LAYOUT (TARGET)

```text
lumilearn-home/
  app/                      # Next.js routes (student, parent, API)
  components/               # ui, student, parent, worksheet, translation
  lib/                      # auth, db, ai, grading, imports, curriculum, security
  database/schema.sql       # supplied canonical baseline
  prisma/ or drizzle/       # actual migrations, schema and seed
  schemas/question-set.schema.json
  examples/question-set.math.json
  examples/question-set.reading.json
  examples/question-set.invalid.json
  prompts/external-question-generator.md
  public/manifest.webmanifest
  scripts/smoke-test.sh
  scripts/backup.sh
  scripts/restore.sh
  scripts/check-lan.sh
  tests/unit/ tests/integration/ tests/e2e/
  docker-compose.yml Dockerfile .env.example
  README.md IMPLEMENTATION_STATUS.md TEST_REPORT.md
```

## 15. FINAL DELIVERY CHECKLIST

- [ ] App actually runs from clean local Docker checkout; no cloud deployment.
- [ ] Parent can create 3 children and assign separate exercises.
- [ ] Student can do exercises on iPad and retry wrong answers without seeing answers.
- [ ] Parent sees correct answers, explanations and can override grades.
- [ ] External AI-generated JSON import/export works with schema and examples.
- [ ] Image/PDF scan, extraction/manual review and Pencil worksheet mode work.
- [ ] Tap English word for Vietnamese meaning; translate whole visible passage safely.
- [ ] Optional OpenAI integration works with key, disabled mode works without key.
- [ ] Grade/subject/TEKS mapping and parent-supplied Coppell documents supported without false alignment claims.
- [ ] PostgreSQL migrations, seed, backup, restore and tests pass.
- [ ] UI is polished and tested at iPad portrait and landscape sizes.
- [ ] No sensitive student/parent data leakage through routes or API.
- [ ] README has exact local setup, LAN/iPad steps, troubleshooting, AI pricing caveat and backup guidance.

## 16. START HERE — CODEX IMMEDIATE INSTRUCTIONS

1. Inspect repository and read this entire file and `database/schema.sql`.
2. Create a task tracker in `IMPLEMENTATION_STATUS.md`, with all phases and acceptance tests.
3. Implement phases in order, committing coherent changes if Git available.
4. Do not ask for aesthetic decisions: follow the design system above and deliver polished screens with realistic seeded data.
5. After each phase, run lint/typecheck/tests/build, fix errors and update status.
6. Complete the app and report what was actually verified, what requires an OpenAI key, and any manual iPad checks remaining.

**Priority if constrained:** authorization and answer secrecy > reliable grading > functional local setup > JSON import > polished iPad UI > translation > scan/Pencil > AI enhancements > curriculum analytics. Do not represent partially implemented advanced features as complete.
