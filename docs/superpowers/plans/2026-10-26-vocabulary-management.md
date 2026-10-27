# Vocabulary management implementation plan
Goal: compact, filterable parent vocabulary management and worksheet-scoped history.
Architecture: nullable grade labels on words/lessons; shared validated list filters and SQL pagination; reusable filter controls for word library and lesson picker; worksheet history separated from editing. Existing rewards, student practice, images and histories remain intact.
Decisions: grades K–12 plus Unclassified. Existing lessons/words infer a label only from a single unambiguous assigned grade; all others remain unclassified. Date filters use America/Chicago creation dates. Word selection persists across filtered pages. Bulk grade labeling handles existing words. History lists sessions for this lesson only and opens paginated immutable run responses.
- [x] Add failing filter/schema tests, run them, then grade migration/contracts and filtered APIs.
- [x] Compact word rows, filter/search/status/date/sort, bulk grade labeling, and shared picker controls with persistent selections.
- [x] Compact paginated worksheet list with grade/date/search; grade field in lesson editor.
- [x] Remove global journal; add worksheet History tab, filtered/paginated sessions and paginated session details.
- [x] Unit and disposable DB/API integration checks; lint/typecheck/build; deploy; inspect browser with disposable fixtures; cleanup.
