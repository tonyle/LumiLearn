# LumiLearn Home implementation status

Last updated: 2026-10-21

## Current state

- [x] Read `MASTER_PLAN.md` and `database/schema.sql` completely.
- [x] Phase 0 — repository, warm responsive design system, Docker Compose, canonical versioned migration, deterministic seed, operations docs, production build.
- [~] Phase 1 — parent first-run/login/session enforcement, student picker/session isolation, parent/student shells, settings and LAN guidance work; child PIN verification, CSRF tokens, editable profiles, re-auth for answer reveal, and localized parent copy remain.
- [~] Phase 2 — immutable seeded question versions, assigned student player, six deterministic grader primitives, transactional/idempotent attempts, retry enforcement, safe student DTOs, bank/assignment overview work; authoring CRUD, draft autosave endpoint/UI, complete parent submission detail, overrides, completion logic, and API integration tests remain.
- [~] Phase 3 — formal JSON Schema plus strict Zod/semantic checks, examples, CLI validator, dry-run, duplicate detection, transactional import, export, and UI work; replace-as-version conflict flow and wider malicious/rollback integration fixtures remain.
- [~] Phase 4 — private signature-checked uploads and pressure-aware vector Pencil canvas with eraser/undo/redo/save API work; PDF page rendering, crop/rotate/deskew, page creation, OCR/manual region review UI, worksheet route integration, annotation PDF export, and Playwright Pencil coverage remain.
- [~] Phase 5 — assigned-prompt-only translation authorization, offline contextual dictionary, verified cached paragraph translation path, history and vocabulary display work; interactive word token UI, vocabulary save API, broad dictionary, optional AI translation, and guard tests remain.
- [~] Phase 6 — provider interface and safe disabled provider work; real OpenAI adapter, budget/cost accounting, queue workers, mock-provider tests, extraction and generation UIs remain.
- [~] Phase 7 — provenance-only curriculum and attempt-derived insights views work; verified TEKS import dataset, parent document workflow, standard tagging, weekly builder, and detailed reports remain.
- [~] Phase 8 — security headers, rate limits for login/translation, health checks, Docker clean build, migration/seed/smoke, unit tests, backup/restore scripts, README and manual iPad checklist work; Playwright/API integration/a11y suites, screenshots, tested destructive restore, per-student deletion/export, retention tools, and physical iPad QA remain.

## Non-negotiable acceptance checks

- Student payloads contain no answer key, rubric, solution, grading reason, parent note, or API secret.
- Parent and student authorization is enforced server-side with resource ownership checks.
- Ambiguous, handwriting, and low-confidence open responses become `needs_review`.
- Deterministic grading and duplicate submissions are correct and transactional.
- A clean Docker Compose install migrates, seeds, and serves on `0.0.0.0:3000`.
- JSON imports are strict, semantic, transactional, and never execute or fetch content.
- Uploads are MIME-sniffed, size-limited, private, and referenced by opaque IDs.

## Resume instructions

Continue Phase 1 at child PIN verification and CSRF enforcement, then finish Phase 2 before expanding later phases. After each phase run `npm run check`, relevant tests, and the documented Compose smoke test. Record exact results in `TEST_REPORT.md` and never claim unverified behavior.

## Verified commands (2026-10-21)

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — 3 files / 8 tests passed.
- `npm run build` — passed with Next.js 16.4.2.
- `docker compose up --build -d` — passed using Node 22 Alpine and PostgreSQL 16.
- `docker compose exec -T app npm run db:migrate` — canonical baseline applied; idempotent rerun passed.
- `docker compose exec -T app npm run db:seed` — passed.
- `scripts/smoke-test.sh` — live and ready endpoints passed.
- `npm audit --omit=dev` — 0 production vulnerabilities.

## Practice-pack update — 2026-10-21

- Six Grade 1/3/5 TEKS-informed sample packs, 72 questions, all eight formats per pack; grade-based assignment and Grade 1 vocabulary seeding verified idempotent.
- Student player now provides ordering controls, extended text, bounded vector handwriting submission, Previous/Next and finish screens, and accurate network-error feedback. Written/drawn work is saved for review; exhausted retries can continue. Request keys work on plain HTTP LANs without requiring `crypto.randomUUID`.
- Drawing payloads are validated and stored with attempts. Parent drawing review UI and reload-resume remain unfinished. Finish is a client confirmation, not persisted assignment completion.
- Verification: lint, typecheck, Docker production build, Docker Vitest 18/18 tests, browser submission smoke for all eight formats, and health checks passed. See TEST_REPORT.md.

## Paper-page workflow — 2026-10-21

The learner assignment route now uses PaperPlayer instead of the one-question player.

- Up to ten questions per paper page; one pen surface supports writing and circling choices across each question region, eraser, per-selected-answer undo/redo, touch Move page, zoom, and a keyboard alternative.
- Server autosave with revision conflicts; reload restores page drafts and grades. Previous/Next waits for saves. Page position itself currently resets to the first page after a browser reload.
- Whole-page submission stores an immutable raster snapshot plus draft vectors and grades the page as a batch. Correct = 10 points, incorrect = 0, uncertain = unscored. Correct answers are locked server-side; retry clears only incorrect answers.
- OpenAI Responses image + structured-output integration is implemented, with confidence checks, objective regrading in code, timeout, idempotent runs, private metadata, and a conservative monthly allowance. No live provider call has been verified: OPENAI_API_KEY is still absent. External AI consent was explicitly granted by the user and saved in family settings; AI_ENABLED and EXTERNAL_AI_OPT_IN are set true for this instance. Handwriting without a key stays available for parent review, never fake-graded.
- Parent → Worksheet review now displays snapshots, recognition, private answer keys, and audited grade overrides. Scores and submission completion update from page results.
- Migration 0002_paper_pages.sql applied without removing existing work. Runtime Docker image includes fontconfig and DejaVu fonts; inspected full-page PNG after fixing missing-font tofu glyphs.
- Verified: lint and typecheck; Docker production build and startup; 27 Vitest tests; disposable-record API integration (80/100 batch grade, duplicate submit, private PNG, reload, correct locks, retry/pending ink, cross-learner denial, parent override to 100/100); browser pen autosave/reload, undo cleanup, and page split 10+2; live/ready smoke.
- Still requires actual API key and a real iPad/Pencil/Safari check. Existing uploaded scanned/PDF worksheet integration is separate from this generated paper-page flow. See README.md and TEST_REPORT.md.

## Letter printing / offline PDF — 2026-10-21

- Added student Print page / Print all and parent Print / PDF links, Letter preview, PDF download/open, and native print dialog. Parent can export all six sample packs together.
- Dedicated print layout uses US Letter 612x792 pt, half-inch margins, name/date/score fields, blank workspaces and larger drawing/writing regions. Packs are balanced across sheets (12 questions -> 6+6) without cutting questions; selected app-page exports preserve original question numbering. PDF has 300 dpi embedded graphics and never includes answer keys, student responses, or feedback.
- Deployed and verified: lint/typecheck, Docker production build, 31 tests, print API integration (owner access/cross-learner denial/parent bundle), PDF metadata Letter/12 pages, and rendered-page visual QA.
- Final PDF: output/pdf/lumilearn-grades-1-3-5-letter.pdf (72 questions, 12 Letter pages, ~3.4 MB).
- Actual printing requested by user: submitted ONE copy, Letter, monochrome, one-sided, actual size to installed HP ENVY 6400 queue HP_ENVY_6400_series__C7EFF9_. Job ID HP_ENVY_6400_series__C7EFF9_-170.
- Hardware blocker: CUPS says Unable to locate printer HP508140C7EFF9.local. Bonjour discovery and hostname lookup found no active HP; the old IP queue at 192.168.1.11 does not respond as an IPP printer on 631. User was asked to check power/Wi-Fi or provide current printer IP. Job remains queued, not confirmed physically printed. Do not submit duplicate jobs when resuming; inspect job 170 first.
