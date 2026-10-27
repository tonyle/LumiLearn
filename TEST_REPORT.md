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

## Pokémon Ultimate Math Race (in-place Math Meadow upgrade) — 2026-10-22

- Existing Math Meadow component/routes, `math20` / `mathfacts` codes, problem generator, student authentication, time wallet, parent controls and math leaderboards retained. No separate game or duplicate question system. Ten answered questions per race; incorrect answers advance with feedback, no new boost. Game results never mint worksheet learning points.
- Added server-persisted fixed-step race state (migration 0016), four distinct racers, selected character, response-time boosts, combos, bounded acceleration, catch-up, question-aware pacing and a finite slow-race finish. Browser uses RAF/direct DOM transforms; server polls reconcile real elapsed simulation. No per-question countdown; existing purchased play-time expiry remains in force.
- Five local optimized artwork files downloaded automatically, about 140 KB total, source/hash manifest and copyright notice included. Prebuild validates cache; no artwork network requests during gameplay. Five signature-move effects, touch keypad, sound toggle, reduced effects and system reduced-motion support, podium/replay and final metrics implemented.
- Simulation results (100 deterministic seeds per profile): fast 10/10 94% wins / 77.5s mean; average 10/10 94% / 107.5s; slow 10/10 94% / 185.1s; 7/10 24% / 123.2s; 5/10 0% / 125.6s; unusually slow 0% / 247.9s. Mean duration includes early loss when all opponents finish. These are synthetic scenarios, not measured child performance. Typical profile meets the 90–150s target; careful slow play is allowed to last longer if purchased time remains.
- Live integration passed both modes, selection, unique opponents, uninterrupted server progress, wrong answers, ten-question limit, stale/duplicate answer handling, private access/origin protection, arbitrary score rejection, saved standings/statistics, idempotent refunds/results and no learning-point farming. Disposable integration records cleaned.
- Browser verification at landscape 1280×720: all five artwork choices visible; Charizard race runs while thinking; touchscreen answer and next-question flow work; Flamethrower charge/effect visible; ten correct answers lead to final stretch. Screenshots under output/ui/pokemon-race-*.png. Physical iPad Safari is not available for hardware-specific testing.
- Database backups excluded from Docker build context as well as Git. Obsolete build cache/images cleaned after Docker storage exhaustion; live DB and uploads remain on Mac bind mounts.
- Final checks: 162 tests across 44 files passed, including all five signature effects and a rapid-answer boost-banking regression; lint/typecheck and production Docker build passed. Final deployment healthy. Existing Flappy/Dash/tiered worksheet reward integration passed, and the race integration passed again on the final deployed code.
- Completed a real browser race on the final build: Pikachu finished first, 10/10, 100% accuracy, 0.5s fastest correct, streak 10, race duration 1:11. Confirmed automatic result save, unused-time refund, standalone victory podium, and Race again returning to character selection. Final screenshots: pokemon-race-selection.png, pokemon-race-pikachu.png, pokemon-race-podium.png. Test learner removed after QA; no real learner credentials, balances, assignments or scores were modified.

## Faster Pokémon running — 2026-10-22
- Raised base speeds about 40%, increased boost/response/combo acceleration, and added a final sprint after the tenth answer. Opponents retain smooth lead control; question-aware pacing still prevents premature early finishes.
- Added faster speed-dependent squash/stride motion, animated ground shadows, moving speed streaks, dust puffs, elemental glow/trails throughout a boost, rapidly scrolling road markings and parallax tree tiles. RAF updates stay outside React state; rank text updates only when rank changes. Gentle/reduced-motion modes suppress the new ambient motion.
- Updated 600-seed profile check: fast 10/10 mean 41.8s (previous 77.5s), average 102.6s, slow 182.6s; 94% wins for each perfect-answer profile. Seven-correct profile 2% wins, five-correct 0%, very slow 0% / 241.0s. Profile mistakes are in the final questions, so these are synthetic stress scenarios rather than predicted child outcomes.
- Full suite: 162 passing tests; lint and typecheck passed. Added a regression bound on fast-profile duration; answer checking, scores, purchased time and worksheet rewards remain on existing server routes.
- Production build/restart passed; final live race API integration passed both modes. Browser verified the new scrolling trees/road, speed trails and correct-answer boost, then save/exit. Screenshot: output/ui/pokemon-race-faster-running.png. Disposable QA learner removed afterward.

## Always-visible worksheet tools; fingers ignored — 2026-10-23
- Timer/header and the complete Pen/Eraser/Move/Undo/Redo/Print/Zoom toolbar now share one sticky dock, so the previous focus-mode `position:static` toolbar no longer disappears below the viewport while scrolling.
- Finger contacts on the worksheet are ignored in all tools: no strokes, erasure, selected-answer changes, autosave activity, native panning or pinch zoom. The toolbar remains touch-selectable. Pen and mouse ink retain the existing native canvas batching and rapid-letter behavior.
- Move page now pans with a pen/mouse drag, chaining zoomed horizontal viewport movement and document vertical scrolling without React or autosave work. Zoom remains available through its toolbar selector.
- Compatibility limitation: capacitive styluses reported as `touch` cannot be distinguished from fingers and are intentionally ignored under this strict policy. Pens reported as `pen` work; desktop mouse writing remains available.
- Lint/typecheck passed; all 165 tests passed. Coverage includes 100 ignored finger contacts, overlapping fingers, finger rejection in Move and Eraser, real pen erasure, pen/mouse dragging, root-page scroll chaining and the existing fast-stroke/coalescing/point-cap/autosave/exit checks.
- Production build/start passed. Browser verified the toolbar stays at the top while questions 9–10 are visible, Move drags the document without ink, and returning to Pen still writes/autosaves. Database confirmed exactly one saved test stroke and paused study clock after Exit. Screenshot: output/ui/worksheet-pinned-tools.png. Physical iPad/Pencil input is covered by pointer-type unit tests but still needs hardware validation. Disposable QA assignment/student removed after verification.

Worksheet completion / parent reopening:
- Added two-successful-grading completion at any score, with immediate completion for a perfect first attempt.
- Completed worksheets reject student writes, new grading requests and timer resume; duplicate grading requests remain idempotent.
- Parent-only reopening preserves immutable run snapshots and rewards, clears the active answer sheet and grants two new attempts.
- Verification: unit completion policy plus disposable integration `tests/integration/worksheet-two-gradings.mjs` covers zero-score completion, incomplete/failed/duplicate requests, parent role/origin, completion locks, grade overrides, reopening, immutable history and reward deduplication.
- Final result: 170 tests across 45 files passed; lint, TypeScript and production Docker build passed. Deployed integration workflow passed, including reward preservation/deduplication; disposable learner and worksheet removed afterward.

2026-10-26 — Vocabulary learning-point rewards:
- Confirmed the pre-change failure: completing the disposable vocabulary lesson left the wallet at 0 instead of 3.
- Full lesson completion now awards 3 points atomically, once per learner/lesson. Existing completions are backfilled on wallet access. Short due-word reviews do not award full-lesson points.
- Deployed integration passed: all activity modes, incomplete lessons, learner isolation, repeated lesson/final-answer requests, separate lesson rewards, concurrent wallet reads, historical backfill and idempotent exchange of 3 points for 180 seconds. Disposable fixtures cleaned.
- Final checks: 173 tests across 45 files passed; lint, TypeScript and production Docker build passed. App redeployed with migration 0018. Reclaimed unused Docker build cache after test startup initially encountered ENOSPC; no data volumes removed.

2026-10-26 — Comma-separated vocabulary import:
- Reproduced the exact ten-word screenshot as a failing regression: the old parser treated `mushy` as the `chunks` column for `clash`.
- Added plain comma/newline word-list recognition, retained structured CSV/JSON, and made field errors identify the affected word and give actionable chunks guidance.
- Verification: 175 tests passed; lint, TypeScript and production build passed. Deployed parser verified against all ten screenshot words without saving entries or generating images.

2026-10-26 — Parent vocabulary organisation:
- Added nullable K–12 grade labels for words and lessons, with conservative legacy classification and date/grade indexes (migration 0019).
- Compact lists, shared grade/date/search filters, picture status and sorting under More filters, 12-item pagination, bulk word grading, and persistent cross-page worksheet word choices.
- Global journal replaced by worksheet-contained session history, current shared-word review schedules and immutable snapshot-based response detail pages.
- Disposable integration verified filters, invalid dates/grades, parent-only bulk classification, 15-word pagination (12 + 3), picture states, worksheet history and 404 for a session from another worksheet; existing rewards and all vocabulary activities preserved.
- Browser QA verified compact lists and searched worksheets, grade filtering, worksheet History and saved incorrect/correct spelling responses with a disposable parent. Screenshots in output/ui/.
- Final checks: 179 tests across 47 files passed; lint, TypeScript and final production build passed. Final compact Grade 3 library captured in output/ui/vocabulary-compact-library.png; worksheet-contained history captured in output/ui/vocabulary-worksheet-history.png. QA cleanup uses the exact retained fixture manifest.

2026-10-26 — Fifty-word vocabulary worksheets:
- User selected full groups of ten words with a minimum 3 points: 10/15 → 3, 20/25 → 6, 30 → 9, 40 → 12, 50 → 15. Rewards count snapshot words, not activity modes.
- Lesson/editor/text import limit raised to 50. Answer cursors support all 250 activities; compact picker still preserves choices across filters/pages.
- Highest completed snapshot tier controls reward upgrades. Editing a lesson alone awards nothing; repeating a completed tier awards nothing; spent rewards are not re-granted.
- Regression suite: 184 tests across 48 files passed; lint and TypeScript passed.
- Deployed `tests/integration/vocabulary-fifty.mjs` passed: fifty-word import and lesson save, rejection of word 51, 100 actual answer submissions, final cursor 249/250, ten-word reward 3, fifty-word reward 15, upgrade adds only 12 after spending the first 3, mode/replay deduplication and exchange to 900 seconds. Disposable fixtures removed; no AI image calls or real learner changes.
- Final production build and startup passed; unused Docker image/build cache cleaned without touching database/uploads.

2026-10-26 — Magic Sort Academy (20 educational levels):
- Five gentle chapters increase from two colours/two layers to four colours/four layers, retaining two spare bottles; deterministic reversible shuffles include known valid solutions. Verified 160 generated puzzles, legal pours, colour conservation and solver hints.
- Basic math reuses the existing meadow question generator with bounded number ranges/fact families; assigned reviewed vocabulary images/audio and starter picture words support recognition, missing-letter and listening practice. Missed questions persist beyond the immediate retry for spaced practice.
- Added migration0020, server-authoritative boards/answers/unlocks, version conflicts, idempotent move replay, per-student progress/garden/companion, parent learning settings and recent practice. Shared wallet reservation/expiry/finish locking and existing rewards remain intact; the game never mints learning points.
- Student dialog provides bottle selection/pour effects, learning feedback, sound, undo/restart/hints, saved exit and automatic time-up return. Parent controls are under each learner's Game rewards card.
- Fresh-context review found one spaced-review defect; the integration regression was observed failing before the correction and passed after it. No remaining reviewer findings.
- Final verification: 195 tests across 51 files passed; lint, TypeScript, diff whitespace checks and production Docker build passed. App healthy on port3000; iPad LAN detection retained.
- Deployed disposable integration passed role/origin/ownership guards, no-time and locked-level reservation rollback, authoritative pours, retry/version protection, wrong-answer help and spaced review, completion/unlock and level20, exact saved resume, expiry/parent pause, idempotent refunds, parent practice report, starter-word fallback and zero reward minting.
- Browser verified the map, actual bottle pours, wrong/correct answer feedback, flower completion, next-level navigation, save/exit, retained progress after restart and the corrected visible Play footer. Screenshots: output/ui/magic-sort-map.png and output/ui/magic-sort-learning.png. Physical iPad/audio hardware not exercised.
- Disposable integration fixtures and preview learner removed. Unused Docker build cache and superseded app images removed after deployment; database/uploads and real learner balances/work preserved.

2026-10-27 — Compact parent Worksheet review:
- Replaced the flat latest-100 table with fifteen-row pagination, compact title/learner/grade/date rows, readable status labels, score and unresolved-question counts. Needs-review and failed grading appear first by default.
- Added title/learner search, learner/status filters, optional grade/subject/Central-date-range/sort controls, filtered summary counts, reset and empty/error states. Queries are parameterised and pagination preserves filters. Opening a paper and returning keeps the exact filtered list/page via a validated local return URL.
- Verification: 203 tests across 53 files passed; lint, TypeScript, diff checks and production Docker build passed. Disposable integration verified parent access, 15+2 pagination, priority ordering, scores/counts, learner/grade/subject/status/search, literal percent searches, Central date boundaries and invalid filters.
- Browser verified search, grade filtering, advanced-control collapse, opening/returning from a paper, and the final compact header/list. Screenshot: output/ui/worksheet-review-compact.png. QA fixtures were isolated from actual student work and removed after testing. No migrations, grading changes or paid AI calls.

2026-10-27 — Compact catalogs and pagination across main list pages:
- Assignments, Question library, saved Worksheets and generated collections now share compact 15-row server lists, title/topic/learner search, grade/subject, status and inclusive Central date filters, stable sorting and persistent pagination. Assignment rename/assign/reopen/per-worksheet printing are retained; archived versions are reachable by status.
- Removed the print-all link and retired /api/parent/print-packs with authenticated410 response, avoiding bulk PDF generation. Empty question sets clearly state no approved questions; invalid assignment-notification IDs are ignored safely.
- Parent-only question-picker API returns at most20 question bodies with count/stable paging. Ordered full selections remain available across pages/search/sets; exact10 initial set selection, preview and assignment behavior are preserved.
- Added count/LIMIT/OFFSET pagination to parent uploads, translations, students, curriculum, insights, dashboard/rewards learner grids and parent daily/earlier history. Student saved words, assigned vocabulary and earlier history also paginate. Existing resource/review/vocabulary-management/student-learning pagination retained. Fixed-size previews/editors and metadata dropdowns remain bounded/available as intended.
- Final full suite227 tests in59 files passed, plus lint/typecheck/diff checks and production Docker build. History fixtures were updated for the new paged helpers while retaining subject and immutable-run-link assertions.
- Final deployed disposable integration passed four catalogs15+2, clamping, grade/subject/search/date/state filtering, existing assignment actions, owner-scoped collections, disabled bulk endpoint, invalid IDs, empty-set state, question API20+5 and parent authorization. Secondary routes returned200 under out-of-range pagination; separate fixture checks verified student saved-word/vocabulary12+1 and parent daily history15+2. No paid AI calls.
- Browser verified compact assignment search/next-page persistence, Question library rows, collection search anchored to its section and created-date controls, and saved worksheet rows. Screenshots: output/ui/assignments-compact.png, collections-compact.png and saved-worksheets-compact.png. Temporary browser tab closed and exact disposable fixtures removed, including synthetic history and saved-word records. Database/upload mounts preserved.
