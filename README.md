# LumiLearn Home

LumiLearn Home is a private, local-first family learning studio for iPads. A parent can maintain question sets and worksheets, assign separate work to children, review uncertain answers, and see explanations. Learner APIs deliberately omit answer keys, rubrics, solutions, grading reasons, and parent notes.

## Start with Docker

Requirements: Docker Desktop/Engine with Compose, and a trusted home network.

```bash
cp .env.example .env
```

Edit `.env`: replace `POSTGRES_PASSWORD`, `SESSION_SECRET`, and `ENCRYPTION_KEY` with separate random values (at least 32 characters for application secrets). Then:

```bash
npm run docker:start -- --build
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
scripts/smoke-test.sh
```

Open [http://localhost:3000](http://localhost:3000). The seed is idempotent and creates a development parent only when setup has not already created one. Its email is `parent@lumilearn.local`; set `DEMO_PARENT_PASSWORD` before seeding to replace the documented development-only default `LumiLearn-Demo-2026!`.

Demo seeding also loads [six Grade 1/3/5 practice packs](examples/coppell/README.md), with 72 questions covering all eight response formats, and assigns them by grade. Open `/kids` and choose a learner. To add just these packs to an existing install, run `docker compose exec app npm run db:seed:practice`.

For a real family install, prefer migrating and using `/setup` instead of seeding demo identities. Setup can run only once and requires a 12-character parent password.

## iPad on home Wi‑Fi

Run `npm run docker:start` to automatically detect the host’s current LAN IP and start Docker Compose. Connect the iPad to the same non-guest Wi‑Fi, then scan the QR code in Parent → Settings or open the address printed by the startup command in Safari. Run the same command again after changing Wi-Fi or when the host IP changes; no `.env` edits are needed. Detection runs on the host because Docker containers cannot reliably discover the host’s Wi-Fi address. Use Share → Add to Home Screen. The host must remain awake. Do not enable public router port forwarding. Local HTTP is unencrypted and intended only for a trusted LAN; use a separately configured local HTTPS reverse proxy or Tailscale when the threat model requires encryption. Camera behavior on iOS over HTTP varies, so the file picker is the reliable scan/upload baseline.

## Operations

- Validate portable JSON: `npm run validate:questions -- examples/question-set.math.json`
- Full local checks: `npm run check`
- Back up DB and private uploads: `scripts/backup.sh`
- Restore (destructive and explicitly gated): `CONFIRM_RESTORE=yes scripts/restore.sh backups/TIMESTAMP`
- Health: `/api/health/live` and `/api/health/ready`

Backups are permission-restricted but not cryptographically encrypted. Store them on an access-controlled or encrypted disk.

## Optional AI

Deterministic grading, manual worksheet authoring, offline dictionary entries, and JSON import require no AI service. AI is off by default. `OPENAI_API_KEY` is server-only, and setting it does not by itself grant child-data processing: `AI_ENABLED=true` and explicit parental external-AI opt-in are also required. Usage costs depend on the provider and selected model. The current provider implementation intentionally reports disabled rather than pretending to call a service.

## Security model

- Opaque, hashed DB session tokens in HTTP-only, SameSite Strict cookies.
- Argon2id parent passwords.
- Resource-scoped student queries and separate safe learner serializers.
- Transactional grading/import, idempotent answer submissions, strict Zod input validation.
- Private uploads with byte-signature checks, opaque names, size limits, and no public static path.
- Translation endpoints accept only text proven to belong to an assigned visible prompt.
- `needs_review` for subjective or uncertain work; deterministic engines never guess handwriting.

Plain HTTP cookies intentionally omit `Secure` on a LAN. Set `COOKIE_SECURE=true` only after providing HTTPS.

## Development

Node 22+, PostgreSQL 16, Next.js 16, TypeScript strict mode.

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

The canonical logical schema is `database/schema.sql`. The migration runner records it as `0001_canonical_baseline.sql`; later migrations belong in `database/migrations/` and must never rewrite an applied production migration.

## Limitations requiring manual verification

Apple Pencil pressure handling is implemented with Pointer Events and normalized vector strokes, but physical Pencil/iPad Safari QA cannot be automated on this host. PDF/image rendering, OCR extraction, full crop/deskew, OpenAI calls, full parent authoring forms, paragraph translation beyond verified cached text, and tested restore to a disposable database remain tracked accurately in `IMPLEMENTATION_STATUS.md`.

## Paper worksheets and page grading

Learner assignments now open as paper worksheets, with up to 10 questions per page and 10 points per question. Use Pen/Eraser to write inside the answer boxes; use Move page to scroll by touch and Zoom for larger writing. Ink autosaves to the server. Submit whole page captures the printed questions and saved ink into one PNG, then grades the page in one batch. Correct answers lock; Redo wrong answers clears only incorrect answer boxes and keeps the rest. Page drafts, marks, and scores survive reloads.

Handwritten grading uses the server-side OpenAI Responses API with a full-page image and strict structured results. Objective recognized answers are checked again with deterministic graders. Low-confidence recognition remains unscored for parent review. Image submissions use `store: false`. No student names or answer keys are added to student responses; private keys are sent only to the grading provider and shown in authenticated parent review.

To enable external handwritten grading, set `OPENAI_API_KEY`, `AI_ENABLED=true`, and `EXTERNAL_AI_OPT_IN=true` in `.env`, and confirm `family.externalAiOptIn=true` in app settings. Restart with `npm run docker:start`. Never put API keys in client code. The family in this development instance has explicitly consented; new seeded families default to no external-AI consent. If AI is unavailable, handwriting remains saved for parent review; the Keyboard alternative can still batch-grade exact answers locally. There is no simulated handwriting recognition.

Parent → Worksheet review shows captured papers, recognized responses, private answer keys, and grade overrides. Overrides are audited. Refresh the learner page after a parent changes marks.

`AI_MONTHLY_BUDGET_USD` limits grading requests using a conservative $0.25 reservation per external page call, including uncertain/failed calls that may have been billed. This is a local allowance, not a provider billing report. Provider token usage is recorded separately; actual cost depends on the configured model. Requests time out after 90 seconds; failed papers retain drafts and can be retried. Ten questions yield 100 maximum points; a final two-question page yields 20. Submitted paper snapshots are stored privately in PostgreSQL and included in database backups.

API integration smoke (creates and cleans up its own disposable test records):

```bash
docker compose exec -T app node --input-type=module < tests/integration/paper-flow.mjs
```

Provider implementation references: [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). A real provider test requires a configured API key. Physical Apple Pencil and Safari touch/zoom behavior still require an actual iPad check.

## Print offline worksheets (US Letter)

Use **Print page** or **Print all** in a learner assignment, or **Print / PDF** in Parent → Assignments. The preview includes **Print Letter**, **Download PDF**, and **Open PDF**. The parent Assignments screen can also export all six sample practice packs as one PDF.

Exports are blank worksheets, with no saved answers, handwriting, feedback, or answer keys. All sheets are US Letter portrait (612 × 792 points / 8.5 × 11 inches), with half-inch safety margins, name/date/score fields, and larger work areas for written and drawn responses. Questions are kept together and balanced across sheets: a 12-question pack normally prints as 6 + 6, using the same two sheets with more even writing space. Printing a selected app page retains its original question numbers. PDF images are rendered at 300 dpi with embedded page graphics, so printer fonts are not required.

The print button prepares the PDF and opens the device's print dialog for the matching Letter preview. Choose Letter and Actual size / 100%; disable browser headers and footers if shown. On iPad, Open PDF and use Share → Print to select an AirPrint printer on the same Wi-Fi. Browser printing uses the device's configured printers; the Docker app does not silently install printers or run host printer commands.

Printer job submission on this development Mac can also use the exported PDF with its existing CUPS/HP ENVY queue. The app preview and PDF export remain usable without a printer connected.

### Student sign-in and daily history

Open **Parent → Students** to choose a unique username and set a six-digit PIN for each learner. Existing profiles and worksheets are preserved; older one-click student sessions are revoked when migration 0003 is applied. PINs are Argon2 hashes, never returned to the browser. Resetting credentials signs that learner out on all devices. Five failed PIN attempts temporarily lock the account for 15 minutes; a parent can reset the PIN to unlock it.

Students sign in at `/kids`. **My history** shows submitted worksheet pages, scores, retry/review counts and links to the matching page. Parents can select a learner under **Learning history**. Dates use America/Chicago; each submission remains a separate entry so retries can be compared. Drafts remain on the worksheet and appear in the parent overview, rather than being counted as submitted work.

### Timed ten-question lessons

Each current practice lesson contains exactly ten distinct questions; there is no daily lesson limit. `npm run db:upgrade:lessons` converts older packs by creating new ten-question lessons, copying saved writing/results into the matching lesson and preserving the original assignment, pages and runs as read-only earlier work. Short final lessons reuse other questions from the same grade and subject. Re-running the upgrade or practice seed does not duplicate lessons or overwrite ongoing work. New active assignments cannot exceed ten questions.

The study clock starts when a learner opens a new lesson. **Pause** covers the whole application and traps focus on **Resume lesson**. Timer state is persisted on the server; paused pages cannot save edits or submit through the worksheet API. Switching apps/tabs pauses the lesson. A 45-second heartbeat lease limits time counted after an abrupt disconnect. Submission captures cumulative active time before grading starts, and history shows the duration recorded for that submission. Corrections resume the same cumulative clock. Older work has no invented duration.

Handwriting grading defaults to `gpt-6-luna` with low reasoning effort. Objective typed answers are still checked locally at no AI cost; uncertain handwriting goes to parent review. `tests/integration/ai-model-eval.ts` is an explicitly invoked, paid comparison using synthetic pen strokes only.

### Create and assign a worksheet

Sign in as a parent, open **Worksheets → Create worksheet**, and fill the ten fixed question slots and their private answer keys. Drafts save automatically; incomplete drafts can be continued later. Preview the student paper, then choose one or more students and select **Assign worksheet**. Each assignment contains exactly ten questions.

For imported or existing questions, use **Question library → Build from library** and select ten questions of the same grade and subject. After importing JSON, **Create worksheet & assign** opens this flow directly.

Published worksheet content is locked to preserve existing student work. In **Assignments**, use **Assign students** to add more learners without resetting anyone's progress. **Print** opens the Letter paper/PDF flow.

### Turn a photographed worksheet into an assignment

Open **Scan worksheet**, take a photo or choose a file. Uploading opens the private source review screen. Choose its grade and subject, then select **Read with AI & create drafts**. This explicitly sends the file to OpenAI; existing AI opt-in and server API configuration are required. **Transcribe manually** creates a blank draft without external AI.

AI reads at most 50 exercises (PDF inputs: at most 20 pages), splits them into drafts with ten question slots, and leaves missing slots blank. It does not assign automatically or invent questions to fill a page. Open each draft, compare every prompt, illustration and private answer key with **Open original worksheet**, complete any blank slots, then Preview → Choose students → confirm source review → Assign. Existing uploads now have a **Create / review worksheets** link too.

Reading retries reuse already-created drafts. Concurrent reads are prevented; failed reads keep the original file. Extraction warnings are saved with the upload. AI images are resized and normalized server-side; if an HEIC image cannot be decoded, export it as JPEG/PNG. `OPENAI_EXTRACTION_MODEL` optionally overrides the existing `OPENAI_MODEL` for reading.

### Generate multiple worksheets with AI

Open **Parent → Generate worksheets** (`/parent/generate`), choose a grade, subject, topic, difficulty and **1–10 worksheets**. Optional guidance can request particular skills or contexts. Each worksheet contains exactly **10 questions / 100 points** with private answer keys. The topic and guidance are sent to OpenAI; student names and work are not included.

Generation uses `OPENAI_GENERATION_MODEL` when set, otherwise `OPENAI_MODEL` (default `gpt-6-luna`), and requires the same external-AI opt-in and API key as grading. Each provider attempt reserves $0.10 against the shared monthly AI allowance; this is a conservative application allowance, not a quoted provider charge. Grading, photo extraction and generation share a serialized budget check.

Keep the collection page open while it creates worksheets one at a time. Each completed draft is saved immediately. If interrupted, reopen the collection under **Your recent collections** and choose **Continue unfinished worksheets**. A failed worksheet does not discard completed drafts. Duplicate requests reuse the original batch/draft, and an active request cannot be started twice. Review generated content and answer keys in the existing worksheet editor, edit as needed, preview and **Assign** to selected students. AI-generated curriculum alignment is unverified; no official Coppell ISD endorsement is implied.

### Student worksheet list

**My learning** shows a compact list, grouped by subject tabs. **To do** is the default and hides completed submissions while retaining work in progress or awaiting review. Use the small **Worksheet status** selector for **In progress**, **Completed**, or **All worksheets**. Subject counts follow the selected status. Filtering and pagination run on the server, with 12 worksheets per page; switching subjects/status resets to page 1, and page navigation preserves both filters. The URL retains the current view for reload/back navigation. Completed worksheets remain accessible through the filter and My history.

Student **My history** uses the same compact list layout, with subject tabs and an inline day picker. Recent active days and earlier legacy worksheets are collapsed by default. History loads at most 12 submissions per page from the server, preserves day/subject across navigation and links each row to its immutable saved attempt, with that attempt's score and duration.

### Worksheet focus mode and Exit

Opening a worksheet from My learning requests browser fullscreen when the browser supports it and uses a dedicated viewport without student navigation, profile or footer. Browsers that do not support the Fullscreen API still show the same distraction-free application layout. The sticky study-time bar provides **Pause** and **Exit**; the paused overlay also offers Exit.

**Exit** commits any live pen stroke, pauses the clock immediately, waits for pending background writes and sends the latest draft to the save-and-pause endpoint. Navigation back to My learning happens only after that endpoint confirms persistence. Saving can finish while paused, retries of an already-saved payload are idempotent, stale edits cannot overwrite another tab, and correct graded answers remain protected. A connection/save error keeps the worksheet and its unsaved ink on screen for retry. Reopening a paused worksheet retains its accumulated time and waits for **Resume lesson**.

### Learning resources

Parent → **Learning resources** → **Add resource** supports private PDF, Word, PowerPoint and video uploads, or HTTPS links (including YouTube, Facebook and Vimeo). Assign learners in the editor. Office files are converted to a private PDF preview by the isolated `documents` container; original downloads remain available. Students open **Resources**, mark material reviewed, and ask questions. Each learner sees only their own discussion; parents can reply, resolve or reopen threads. Deleting a resource hides it from students; restore it from the Deleted filter.

### Games and learning rewards

Student → **Games** includes **Flappy Flight**, a touch/keyboard canvas game with optional sound, capped difficulty and the **Top Fly** family leaderboard. Parent → **Game rewards** controls each learner’s game access, reward per worksheet, exchange rate, daily play limit and manual point adjustments with a required reason. Defaults: 10 points per all-correct worksheet, 60 seconds per point, 30 minutes/day (America/Chicago).

Rewards are issued once per learner and assignment, after all questions are correct; existing completed worksheets are eligible. Visiting Games or parent rewards reconciles earned points. Exchanges and adjustments have an immutable ledger and idempotency keys. Starting a flight reserves up to five minutes of purchased time on the server. Ending a flight returns unused seconds. Reloading or losing a device does not reset the timer; the outstanding reservation expires, or the learner can end it from Games. Moving to another tab stops the flight and attempts to save unused time. Parent disable stops outstanding flights. Leaderboard scores are computed from deterministic flap replays, not client-provided scores. This is a local family leaderboard, not a competitive anti-cheat service.

**Geometry Dash** is available in the same Games library: an original neon cube runner with tap/Space/Up jumping, rotating cube, spikes, synthesized sounds and gently capped speed. It shares the purchased time balance, daily cap, parent controls, expiry autosave and one-active-game restriction with Flappy Flight. **Top Dash** and **Top Fly** are separate; the server chooses the correct deterministic replay from the stored game code. No original Geometry Dash assets, music or levels are bundled.

**Pokémon Ultimate Math Race** upgrades Math Meadow Run in place, using its existing `math20` / `mathfacts` game codes, math generator, authentication, shared play-time wallet, parent controls, navigation and separate math leaderboards. Choose Pikachu, Charizard, Blastoise, Venusaur or Lucario, then race three distinct AI opponents through ten questions. All four racers move continuously while thinking. Correct answers trigger the selected signature move and a temporary boost; faster responses increase the boost and three correct answers make a combo. Wrong answers advance with supportive feedback and no new boost. The server validates answers and persists race state, final standings, accuracy, best streak, fastest correct response and duration. Game scores remain separate from worksheet reward points; races do not mint learning points. Save/exit and purchased-time expiry refund only unused reserved play time once.

Race tuning lives in `lib/meadow-race.ts`: 1,100-unit distance, fixed 1/60-second simulation steps driven by actual elapsed seconds, bounded acceleration, seeded opponents, smooth catch-up and question-aware pacing. A time-based pacing release after 220 seconds lets unusually slow races reach a natural finish rather than trapping opponents. There is no per-question countdown; the existing purchased play-time limit still applies. Browser rendering uses requestAnimationFrame with direct racer transforms; React updates on answers, phase changes and the existing wallet timer, not every frame. Server snapshots reconcile the prediction every 1.5 seconds. The race ends when the player crosses the finish or all three opponents finish.

Artwork is automatically downloaded/optimized by `npm run assets:pokemon` (also run before each build). Five cached WebP files total about 140 KB, with sources/checksums in `public/pokemon/manifest.json`; valid cache means no Internet is needed for builds or gameplay. Character selection, race and podium use only local images. See `public/pokemon/ARTWORK-NOTICE.md` for copyright restrictions: PokeAPI hosting does not grant redistribution rights. Gentle-effects control and prefers-reduced-motion suppress the moving/flashing effects while keeping gameplay intact. Physical iPad Safari testing remains a manual follow-up.

### Grade 1 Vocabulary Studio

Parent → **Vocabulary Studio** provides a word library, manual editing, and import of plain word lists, CSV or JSON (up to 30 words). A downloadable starter CSV is available in the import form. Optional columns: meaning, Vietnamese translation, example sentence, parent-checked sound-spelling chunks (e.g. `sh|i|p`), and picture description. Common nouns have bundled instant illustrations. Other words use the configured OpenAI image model (`OPENAI_VOCAB_IMAGE_MODEL`, default `gpt-image-2.5-flare`), with existing AI consent/settings and the shared monthly budget. Each AI attempt reserves a conservative $0.25 budget allowance; this is not a claim of the provider's exact charge. Images remain in the private uploads volume. Picture regeneration preserves the previous picture if it fails.

Check each picture, then **Create worksheet**: select 1–10 distinct words, activities and learners. Picture matching needs at least three words. Start with 3–5 meaningful, familiar words. The five activities are flashcards, picture matching, letter building, picture spelling, and listening/dictation. Student → **Vocabulary** lists assigned worksheets, saved visits and words ready for review; the original saved reading-word list remains linked there. Checked responses are saved immediately; partial unsent typing is not saved.

Speech uses the device's English text-to-speech voice, preferring a local US English voice, with normal/slow word reading and sentence reading. No microphone or student voice recording is used. Install an English voice on the device if playback is unavailable; listening can be skipped without receiving independent-spelling credit. Type answers or use supported iPad Scribble. Spelling checks ignore case and surrounding spaces, not spelling errors; spellcheck/autocorrect are disabled in practice inputs.

Activities rotate across words. Feedback follows look–say–cover–try; independent spelling, rather than flashcard exposure, drives review. Suggested successful review gaps are 1, 3, 7, 14 and 30 days, with earlier review after errors/hints and no same-day stage farming. These are practical scheduling defaults, not a validated mastery guarantee or a substitute for explicit phonics instruction. Choose concrete words for picture tasks; support abstract/sight words with context and parent-guided sound–spelling instruction. Sources: [IES foundational reading](https://ies.ed.gov/ncee/WWC/PracticeGuide/21), [IES study/learning practice](https://ies.ed.gov/ncee/wwc/PracticeGuide/1). Archived word/worksheet records and immutable practice snapshots preserve prior work; editing a spelling with learning history requires adding a new word.

Vocabulary photo import: Parent → Vocabulary Studio → Import words → Take photo / Upload photo. The rear-camera file picker works on iPad over the trusted LAN without a live-camera HTTPS dependency. Choose Read words from photo to send the image to the configured OpenAI extraction model; check, edit, remove or add entries, then Use these words → Save words. Up to 30 single English words per photo, 20 MB, with automatic picture preparation available after saving. Results are cached per import request to avoid duplicate AI calls on network retries. Original photos are processed in memory, not published or retained. JPEG, PNG and WebP are supported; HEIC depends on the server decoder and reports a conversion error when unavailable. Each extraction attempt reserves $0.05 against the shared monthly AI allowance (a budget allowance, not a quoted API price).

### Storage on this Mac

Database and uploads now use host bind mounts, rather than Docker-managed volumes:
- `/Users/tonyle/Projects/EasyLearn/data/postgres` → `/var/lib/postgresql/data` (PostgreSQL 16 data files)
- `/Users/tonyle/Projects/EasyLearn/data/uploads` → `/app/data/uploads` (all private uploads, resource files and vocabulary images)

The Compose sources are project-relative (`./data/postgres`, `./data/uploads`) and resolve to the absolute paths above on this Mac. Both directories must already exist; Compose fails instead of silently creating a missing host directory. For a fresh installation only, create them with `mkdir -p data/postgres data/uploads` before first startup. Do not initialize an empty folder when recovering an existing installation.

The migration snapshot is `/Users/tonyle/Projects/EasyLearn/backups/20261023T025521Z`. Original named volumes `easylearn_lumilearn_db` / `easylearn_lumilearn_uploads` were retained as pre-migration rollback copies, and are no longer live storage. Do not treat those old copies as current backups.

Run `bash scripts/backup.sh /Users/tonyle/Projects/EasyLearn/backups` for a portable database dump plus upload archive. The script validates dump/archive listings, writes SHA-256 checksums and marks complete backups with `COMPLETE`. For a DB/uploads snapshot with no intervening app writes, stop the app first (`docker compose stop app`), run the backup, then `npm run docker:start`. A failed backup has no `COMPLETE` marker. Backups and data directories are excluded from Git. Do not edit raw PostgreSQL files or copy the live database folder as a backup; use the dump script. Host storage survives Docker container/volume removal, but a Mac disk failure still requires a copy on another disk or backup service. No daily schedule was installed because both host mounts work.
