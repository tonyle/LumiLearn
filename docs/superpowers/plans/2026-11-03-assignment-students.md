# Editable worksheet assignment roster

Implement explicit parent add/remove selection with current roster fetched on dialog open. Use optimistic expected membership and atomic PATCH, retain POST append compatibility. Soft-unassign with unassigned_at to preserve cascading child work; pause clocks and filter active membership from current student access and parent roster displays. Keep immutable History and earned rewards. Reassign clears removal metadata and resumes saved work.

Verified 250 unit/UI tests, lint/typecheck/build, disposable deployed HTTP lifecycle and browser actions. No real student assignment was changed.
