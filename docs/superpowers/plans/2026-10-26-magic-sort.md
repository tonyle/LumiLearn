# Magic Sort Academy implementation plan
Spec: docs/superpowers/specs/2026-10-26-magic-sort.md
Goal: complete twenty-level educational water-sort game integrated into the existing student Games and parent reward controls.
Implementation inline in the existing authorized workspace; preserve other ongoing changes.
- [x] TDD pure engine: deterministic reversible shuffles, colour conservation, legal maximal pours, twenty gentle configurations, bounded solver hints, Undo.
- [x] TDD learning: reuse meadowProblem for basic arithmetic/table groups; small assigned-word pools and safe fallback; no answer leaks in public views; spaced retry within level.
- [x] Migration 0020: magic game code, per-learner progress/levels, run associations, idempotent actions and practice logs/settings. Refactor existing reservation into reusable transaction helper; preserve all existing games.
- [x] Server store/API: atomic start/level unlock, authoritative saves and answer grading, version/conflict/idempotency guards, wallet/expiry/role checks, parent settings and practice summaries.
- [x] Student UI: glass-bottle art, tap controls and pour animation, twenty-level garden, companion, learning prompts, sound/reduced motion, durable exit and timeout. Parent settings and reports. No dependencies/paid assets.
- [x] Unit regressions, disposable integration (solver completes levels, educational retry/unlocks, timers/refunds/revocation/isolation, no reward minting), lint/typecheck/build/deploy, browser QA and screenshot; clean QA fixtures.
