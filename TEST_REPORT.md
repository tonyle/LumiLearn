# LumiLearn Home test report

Date: 2026-10-21

## Automated results

- `npm run lint`: passed after upgrading to the Next.js 16 flat ESLint configuration.
- `npm run typecheck`: passed in strict TypeScript mode.
- `npm test`: passed 3 files / 8 tests covering deterministic math, tolerance/fractions/units, normalized text, multiple selections, rubric review behavior, JSON contract acceptance/rejection, unsafe prompt rejection, and the safe grading-result DTO shape.
- `npm run build`: passed; 30 dynamic application/API routes compiled with Next.js 16.4.2.
- `docker compose up --build -d`: passed after switching to the Node 22 Alpine image (the Debian CDN blob repeatedly returned HTTP 503).
- `docker compose exec -T app npm run db:migrate`: passed; canonical PostgreSQL 16 schema applied and idempotent rerun observed.
- `docker compose exec -T app npm run db:seed`: passed.
- `scripts/smoke-test.sh`: passed; live and database-ready endpoints returned success through host port 3000.
- `GET /api/session` without a cookie: returned the role-safe `{role:null}` envelope.
- Final `npm audit --omit=dev`: 0 production vulnerabilities after upgrading `sharp` from 0.34.4 to 0.35.5.

## Not yet verified

- Backup script is present but a destructive restore to a disposable database has not yet been exercised.
- No physical iPad/Apple Pencil was available; use the manual checklist below.
- Optional external AI calls are intentionally disabled and not claimed functional.

## Manual iPad checklist

1. Test 768×1024 portrait, 1024×768 landscape, and 1366×1024.
2. Confirm 44px touch targets, visible focus, VoiceOver announcements, and reduced motion.
3. Draw with Pencil pressure; test finger drawing, eraser, undo/redo, rotation, background/resume, reload persistence, and palm behavior.
4. Verify file picker and camera/photo chooser on the installed iOS version.
5. Inspect learner network responses and page source for answer keys, solutions, rubrics, parent explanations, and private grading reasons.

## Grade 1/3/5 practice packs — October 21, 2026

- Added six original TEKS-informed packs (72 questions), with all eight response formats in each pack. Alignment is recorded as general practice, not district-verified pacing.
- Confirmed live assignments: Henry Grade 1 — two packs / 24 questions; Jennie Grade 3 — two new packs / 24 questions; Tom Grade 5 — two packs / 24 questions. Existing names, assignments, and answers were preserved.
- Practice seeding run twice: counts unchanged. Grade 1 also receives 12 bilingual vocabulary entries.
- `npm run lint` and `npm run typecheck` passed locally; production Docker build passed.
- Local Vitest could not load the existing macOS Rollup binary because of a code-signature error. Ran tests in the Node 22 Docker environment with read-only test/component/config mounts and `NODE_ENV=test`: five files, 18 tests passed. Setting test mode is required because the runner image defaults to production React.
- Browser smoke on the live Henry math pack: submitted one correct response for single choice, multiple choice, number, short text, ordering, and true/false; submitted extended text and an actual pointer drawing for review. All eight response formats saved successfully. Confirmed the drawing has 18 vector strokes in `attempts.student_response.drawing` and verdict `needs_review`.
- Confirmed the student home shows both Grade 1 packs. Health live/ready smoke passed.
- The browser smoke leaves eight sample attempts on Henry's math pack. It does not remove existing data.
- Physical iPad/Pencil pressure and Safari viewport behavior remain manual QA. A dedicated parent drawing review screen, full resume after reload, and persisted assignment completion remain outside this sample-data update. Submitted answers are persisted, while unsubmitted work and the current question index remain in browser component state.

## Paper-page workflow — October 21, 2026

Validation on the deployed Node 22 Docker application:

- Local `npm run lint` and `npm run typecheck`: passed.
- `npm run docker:start -- --build`: production Next.js compilation and Docker health checks passed.
- `docker compose exec -T app npm run db:migrate`: applied 0002_paper_pages.sql.
- Docker Vitest with NODE_ENV=test and read-only source/config/test mounts: 7 files / 27 tests passed. New tests cover layout bounds/non-overlap, escaped paper SVG, ten-point scoring, no private result fields in student feedback, correct-answer locking, drawing limits, blank numeric responses, choice/ordering recognition mapping, one-image structured provider calls, code-based math rechecking, uncertain handwriting, mismatched AI IDs, 10+2 pagination, and batch-only submission.
- `docker compose exec -T app node --input-type=module < tests/integration/paper-flow.mjs`: passed on final font-equipped image. Creates and deletes its own temporary learner/assignment. Verifies 80/100 page score, idempotency, stored PNG, autosave/reload, locked correct answers, unconfigured-AI ink pending, parent image authorization, cross-learner isolation, and parent override to 100/100. Also checks a usable DejaVu font is installed at runtime. No disposable QA learners or assignments are intentionally retained.
- Browser smoke: opened Tom's Grade 5 math paper; confirmed page 1 contains ten questions and page 2 contains two. Drew a test stroke, reloaded, and visually confirmed it persisted. Undid the test strokes and saved the paper blank again. This leaves an empty saved draft, with no submitted marks, on that existing paper.
- Visual capture check initially found missing fonts in server-side PNGs although the browser looked correct. Added fontconfig/ttf-dejavu to Docker, rerendered, and visually confirmed all printed question text, numbers, fractions, and answer regions in the full-page PNG. No tofu glyphs remained.
- Final app live/ready smoke passed on the font-equipped image; app/db healthy and integration passed.
- The OpenAI provider was exercised with deterministic mocked Responses payloads; no live OpenAI request has been made because no API key is configured. No claim is made that real handwriting accuracy, physical Pencil pressure, palm rejection, or iPad Safari touch/zoom has been verified.

## Offline Letter printing — October 21, 2026

- `npm run lint` / `npm run typecheck`: passed.
- Docker production build/start: passed.
- Docker Vitest: 8 test files / 31 tests passed. Added Letter layout checks for complete question coverage, balanced pages, printable margins, original numbering, distinct grade/subject sections, and exclusion of answer keys/ink.
- `tests/integration/print-flow.mjs` against deployed app: passed student-owner PDF access, other-student denial, parent-only combined export, and every page 612x792 points. Temporary test sessions were cleaned up.
- Exported combined PDF from the actual parent API: 72 questions, 12 pages, 3,398,341 bytes, Letter portrait, no JavaScript or form fields. Rendered all 12 pages with Poppler; inspected contact sheets and full-size pages, including written/drawn science exercises. Fonts are embedded in 300 dpi page images; no clipping or missing glyphs found. Verified header ink on all 12 rendered pages.
- Browser smoke: student Print page / Print all links visible; Letter preview shows Print Letter, Download PDF, Open PDF, and expected blank sheets. Saved UI proof screenshot to /private/tmp/letter-print-preview.png.
- Existing printer inventory: HP ENVY 6400 IPPS queue, duplicate DNS-SD queue for the same UUID, and an old IPP queue. HP queue advertises Letter.
- Submitted one physical job using `lp`, Letter, one-sided, grayscale, actual size: HP_ENVY_6400_series__C7EFF9_-170. CUPS accepted it but reports Unable to locate printer HP508140C7EFF9.local. No physical printing success claimed. No duplicate job was submitted. Bonjour and hostname checks found no reachable HP service; old 192.168.1.11 IPP connection also failed. Awaiting user's power/Wi-Fi check/current printer IP.

## Learning resources and Games — 2026-10-22

- Production Docker build, ESLint and TypeScript checks passed.
- 122 tests passed across 33 test files, including existing handwriting/save, worksheet focus, history and grading regressions.
- Resource integration passed: genuine PDF/Word/PPT previews, video byte ranges, private assignments, revision conflicts, archive/restore, per-student questions, parent replies, and same-origin protection. Parent UI reply updated the unanswered navigation badge.
- Games integration passed: all-correct rewards issued once, missing-answer ineligibility, concurrent idempotent exchanges, balance checks, one active server-timed run, cross-student denial, invalid fast-forward replay denial, positive replay-computed leaderboard score, duplicate-finish refund protection, parent adjustments/disable, daily cap and expiry.
- Browser verified student sign-in, Games navigation, point exchange, live canvas rendering/timer, flight result, accessible focus dialog and parent reward controls. Physical iPad touch/audio performance still requires device testing.
- Disposable QA accounts, worksheets, resource files, discussion threads and game runs were removed. Existing learner work and credentials were preserved.
- Screenshots: `output/ui/student-games.png`, `output/ui/flappy-flight.png`, `output/ui/parent-game-rewards.png`.

## Geometry Dash — 2026-10-22

- Added original neon cube/spike gameplay, grounded jumps, deterministic server replay and a capped speed curve.
- Both games share points, purchased seconds, daily limits and the one-active-session restriction. Scores are stored under the server-side game code with separate Top Fly / Top Dash boards.
- 129 tests passed across 35 files. New tests cover initial obstacles, spike collisions, ignored air jumps, reproducible scoring and launching Dash from the existing wallet.
- API integration verified positive Dash replay scores, leaderboard separation and rejecting Flappy starts while Dash is active, alongside the existing points, timer, expiry and authorization checks.
- Browser verified the Geometry Dash launch, neon cube/spikes, running timer and result controls. Shared timeout-save-and-return behavior remains covered by UI and API regression tests.

## Math Meadow Run — 2026-10-22

- Added hand-built SVG garden scenery, animated runner/wall jumps, touch number pad, optional synthesized sounds and two arithmetic trails.
- Checked 3,000 addition/subtraction problems and 3,000 times-table problems: 0–20 operands/results, no negative subtraction, factors 1–9, and exact division only.
- Full regression run: 134 passed across 37 files. An additional timeout-save-and-return test was then added; all 3 Math Meadow UI tests passed (135 distinct tests total).
- ESLint, TypeScript and production Docker build passed.
- API integration verified server-generated questions, correct/incorrect answers, retry idempotency, stale-index rejection, cross-student access denial, one shared active game, preserved score after expiry, separate trail boards and no learning-point farming.
- Browser verified keypad answers, incorrect-answer hints, correct-answer jump state/score, next question, timer and save-and-exit. Preview: output/ui/math-meadow-run.png.
- Disposable QA accounts, answer rows, game runs and worksheet fixtures were removed; real learner credentials/work were preserved.

## Grade 1 Vocabulary Studio — 2026-10-22

- Parent word library supports manual creation/editing, CSV/TXT/JSON imports, automatic illustrations, picture review, worksheet composition, activity selection and learner assignment. Starter CSV and instant illustrations are included.
- Student Vocabulary supports flashcards with meaning/context/chunks, image matching, letter building, picture spelling and listening/dictation. Device English TTS supports normal/slow playback and sentences; no microphone capture is used.
- Typed spelling, rather than flashcard taps, drives spaced review. Errors/hints trigger earlier review; same-day repeat sessions cannot farm review stages. Activities interleave across words.
- 146 unit tests passed across 40 files. ESLint, TypeScript and production Docker build passed.
- Integration verified private generated pictures, approval before assignment, assigned-only access, all five activities, spelling corrections, idempotent responses, saved sessions, independent learner progress, optimistic updates and no same-day stage farming.
- Additional live check generated a genuine OpenAI vocabulary illustration with the configured project/model. Picture access from an immutable practice snapshot remained valid after worksheet word membership changed.
- Browser verified manual word creation with automatic picture generation, picture approval, custom worksheet editing/assignment, learner Vocabulary navigation, focused flashcard layout, reveal/audio controls and saved checked response.
- Screenshots: output/ui/parent-vocabulary-studio.png and output/ui/student-vocabulary-flashcard.png.
- Disposable QA accounts, words, lessons, image files and practice records were removed after verification. Real learner work and credentials were preserved. Physical iPad voice packs/Scribble availability still depend on device configuration.

## Vocabulary photo import — 2026-10-22
- Added iPad rear-camera capture and photo upload, local preview, explicit AI read action, editable/removable extracted words, and transfer into the existing reviewed word-save / picture-generation flow.
- Database migration 0014 applied; production Docker build and health checks passed. LAN address preserved.
- Lint and TypeScript passed. Existing full suite plus extraction tests: 149 passing; additional camera/review UI test passed (150 total tested cases).
- Live integration `tests/integration/vocabulary-photo.mjs` passed against OpenAI using a synthetic image containing cat/dog/sun: exact extraction, origin/auth rejection, no words created before review, repeated request cached with one budget reservation, and reviewed words created successfully. Disposable parent/words/results cleaned afterward.
- Original photos are processed in memory. HEIC availability depends on Sharp's decoder; unsupported photos return a clear camera/JPEG fallback message. Physical iPad camera hardware was not available for testing.

## Three-point worksheet rewards — 2026-10-22
- Migration 0015 sets both existing and future learner rules to 3 points per perfect worksheet and 60 seconds per point. Existing point/time balances and reward ledger stay intact.
- Parent and student copy now identifies perfect worksheets (100/100). Parent controls remain available for later rule changes.
- Updated game integration to check 9/10 correct earns zero; 10/10 earns exactly 3 once; exchanging 3 points gives 180 seconds; concurrent retries do not double-spend or duplicate rewards.

## Tiered worksheet rewards
- Reward tiers replace perfect-only eligibility: 100% → 3 points, 80–<100% → 2, 70–<80% → 1, below 70% → 0. Every expected question must have a final grade; pending/incomplete grading does not earn rewards.
- Reward synchronization now handles graded incorrect answers even while a worksheet remains available for corrections. Rechecking is idempotent; improved scores add only the difference to the highest tier already awarded, maximum 3 new-rule points per worksheet. Previously awarded balances are preserved.
- Parent rule fields show the fixed 3-point maximum and 60-second exchange rate; API enforces those values. Student/parent copy explains all tiers.
- Tier boundary unit tests and GameHub tests passed (4 tests). Updated live game integration passed for 60/70/80/90/100, incremental upgrades, idempotency and 3-point→180-second exchange. Lint, typecheck and production build passed. Docker storage exhaustion during rollout was resolved by removing obsolete EasyLearn images and unused build cache, then restarting healthy services; no data volumes removed.

## Host storage migration — 2026-10-22
- Stopped app writes, created/validated portable DB dump and uploads archive on Mac, recorded all public-table counts, cleanly stopped PostgreSQL, copied existing cluster to host bind directory, restored upload files, and switched Compose to explicit bind mounts with missing-directory creation disabled.
- Both app and DB restarted healthy. Verified all table row counts before/after, all 31 uploaded-file SHA-256 hashes, and upload directory read/write access. Original named volumes retained untouched as rollback copies.
- Hardened backup script for absolute destinations and container-configured database credentials, restrictive file permissions, dump/archive validation, checksums and completion marker. No automatic daily job needed for the user's conditional fallback because host mounts succeeded.
