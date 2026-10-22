# Coppell / TEKS practice packs

72 original questions: six packs with 12 questions each. Every pack has single choice, multiple choice, number, short text, ordering, true/false, extended text, and handwriting, followed by four topic questions. Grade 1 Word Garden uses the `reading` subject.

| Grade | Subjects | Topics sampled |
| --- | --- | --- |
| 1 | Math, words/reading | Place value, addition/subtraction, shapes, coins, time; phonics, spelling, vocabulary, sentence order, reading |
| 3 | Math, science | Multiplication/division, fractions, area/perimeter; properties, forces, habitats, life cycles, conservation |
| 5 | Math, science | Decimals, fractions, volume, coordinates, budgets; matter, circuits, food chains, water cycle, fair investigations |

Run `npm run db:seed:practice` in the app container. It assigns each pack to all active learners in its grade and adds 12 bilingual vocabulary entries for Grade 1. It creates a grade profile only when none exists, preserves current profile names and work, and is safe to rerun. The regular `db:seed` command also loads these packs on a new demo install.

Open `/kids`, select a learner, and choose a practice pack. Open `My words` for the Grade 1 vocabulary cards. The first eight questions in each pack exercise all eight response formats. Ordering uses accessible up/down buttons. Handwriting accepts finger/Pencil drawing and optional typed text. Extended text and handwriting are saved for parent review; they are not automatically judged correct. After a saved review response or the final unsuccessful retry, the learner can continue. Finish returns to the learner home.

These are original TEKS-informed examples, not official Coppell ISD questions, a comprehensive year-long question bank, or a verified match to a particular classroom's current pacing. They are stored as `general_practice`, with reference URLs in each JSON file. No individual standard codes are claimed as verified.

Sources consulted October 21, 2026:

- Coppell grade-level syllabus directory: https://www.coppellisd.com/documents/departments/curriculum-%26-instruction/syllabus/24549582
- TEA current elementary TEKS index: https://tea.texas.gov/curriculum-and-instruction/texas-essential-knowledge-and-skills-teks
- Grade-level source documents are linked in each pack's `source.referenceUrls`.

Physical Apple Pencil pressure, Safari layout, and QR scanning still require testing on an actual iPad. Drawing vectors are included in the saved answer; a dedicated parent drawing review screen is not yet implemented.
