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
