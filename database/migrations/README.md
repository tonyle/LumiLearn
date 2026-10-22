# Versioned migrations

Migration `0001_canonical_baseline.sql` is represented by the immutable canonical file `../schema.sql`; the migration runner records that version before applying subsequent numbered SQL files in this directory. Never modify an applied migration in a deployed home instance—add a new numbered file instead.
