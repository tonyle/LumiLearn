# Flexible worksheets and reference generation

User request: remove exactly-ten worksheet rule; generate new questions in the same format as an uploaded image (confirmed).

Implementation: keep existing question schema, immutable assignments, page grading, clocks/rewards and Letter printing. Allow manual/library 1–200 questions; AI1–50 per worksheet, default10. Retain ten per page. Add/remove and paged preview in editor, dynamic counts in lists/assign UI, remove old database ten-cap with migration0023. Preserve extraction count without splitting/padding. Add reference file/camera/existing-upload selection, private vision input, output count verification and parent review. Preserve original answer/AI privacy rules.

Verification: full unit/UI suite, lint/typecheck/build, mocked provider, disposable multi-page HTTP integration and browser QA. All temporary data removed; no paid AI verification. See TEST_REPORT.md.
