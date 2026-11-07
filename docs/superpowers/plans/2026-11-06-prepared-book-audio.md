# Prepare book audio before Listen

User wants immediate playback and host-project files included in backups. Existing TTS cache is already bind-mounted but generated on demand and evictable.

- Keep permanent per-book PCM16 WAV files under data/uploads/books/audio/<book UUID>/. The existing ./data/uploads bind and backup uploads archive cover them. Do not commit private generated media to Git, bake it into images or evict prepared files as cache.
- Add a Compose-managed Node worker (app runtime/user/storage, no public port) that discovers page text, including older books, and prepares a normal-speed af_heart master per passage; native pitch-preserving playback implements .65/.85/1. Persist progress and retry requests on disk; rescan authoritative page text after restart/edits, deduplicate by normalized text/model/voice/speed and atomically write WAVs. Generation remains separate from HTTP playback.
- Importing photos cannot synthesize text that has not been extracted. Existing opt-in OCR behavior remains unchanged. Once text is extracted/saved, discovery automatically prepares audio; no extra manual startup/model command.
- Book studio gets automatic progress, ready/error counts, retry/prioritize control and the host storage/backup explanation. A changed text fingerprint reports queued until the new recordings are ready. Do not block page editing while synthesis runs.
- Authenticated Listen resolves current reviewed text then reads a local prepared WAV, with existing byte-range handling and native playback rate; missing audio returns a retryable preparation response. No TTS health/model/generation request in the playback path.
- Verify filesystem persistence, corruption/atomic writes, resume/deduplication/edit invalidation, status/auth, all speeds, worker restart, actual cold preparation then fast/offline-to-TTS playback; run lint/typecheck/relevant/full tests and rebuild Compose. Confirm archive contains prepared audio. Use disposable fixtures and no paid OCR QA.

Decision after inventory: 305 existing passages makes triple synthesis unnecessarily expensive. Use one canonical master per distinct text/model/voice, with native pitch-preserving playback rates. No paid services.
