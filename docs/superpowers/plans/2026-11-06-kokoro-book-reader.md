# Kokoro book-reader implementation

Implement the user's supplied specification directly. No schema changes or paid APIs.

## Decisions
- Separate private ARM64-native Python/ONNX CPU container. Pin runtime packages and model release; build downloads and verifies Kokoro-82M v1.0 plus voice bundle. Image layers cache models, service startup eagerly loads af_heart and warms inference before readiness. Internal network, no host port.
- Persistent bounded WAV cache bind-mounted at data/tts-audio on the Mac. Key includes normalized text, voice, model/checksum, language, synthesis speed and output configuration. Atomic writes, single-flight CPU admission, timeouts, privacy-safe metadata logs.
- Authenticated Next route resolves reviewed passage from authorized book/page/region IDs; client cannot synthesize arbitrary supplied text. Health gate before upstream synthesis; bounded audio response and stable errors.
- Native HTML audio with same-origin authenticated GET source (passage IDs/config only) permits iPad's user-gesture play path. Playback generation guards and cleanup on Stop, page/passage/speed changes, recording, activities, exit and unmount. Existing translation/recording/feedback kept intact.
- Existing Compose one-shot reading-model setup already handles reading assets. TTS models download during its image build, so bare compose up -d --build manages every required process. Existing LAN helper remains optional for automatic host address/certificate export.

## Sequence
1. Tests first for TTS access/validation/readiness/timeout/error mapping and playback cancellation.
2. CPU service/download verification/cache/startup readiness plus Python tests.
3. Compose health dependency/env/docs; authenticated API and frontend audio replacement.
4. Run lint, typecheck, full unit suite; bare compose build/up; real WAV/cache/health and disposable API integration; existing integration suites with mocks where paid AI is involved. Browser playback/stop/page/late-error checks.
5. Record exact results, license sources, changed files and hardware limits. No claim of physical iPad testing.

## Review focus
- Cache hit never bypasses book access; no raw-text query strings or cache files public.
- Stop/page change cancels pending audio without late playback or old errors.
- Eager startup readiness, bounded busy work and timed-out inference keep owning their CPU lock.
- No GPU/host port/manual model command; existing databases/uploads preserved.

## Execution notes
- Native ARM64 model build succeeded with pinned SHA-256s. Startup initially failed because phonemizer copies eSpeak into /tmp and dynamically maps it; explicitly set the private TTS tmpfs `exec`, retaining nosuid, size bounds, read-only root and capability drop.
- Preserved the existing host HTTPS/proxy values in this installation's ignored .env so a direct Compose invocation keeps LAN origin validation working.
- Full-suite run exposed the previously observed Tic-Tac-Toe fixture timing race. Fixed only its test to await the enabled Play button; no game behavior changed.
- Regression integration runs found two obsolete test expectations: a removed 10-question cap and whitespace in history score labels. Updated only those test assertions to current flexible lesson behavior/score semantics. Re-runs required; no related product or schema changes.
