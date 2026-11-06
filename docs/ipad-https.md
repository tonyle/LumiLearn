# Use the iPad microphone on your home Wi-Fi

Safari requires a trusted HTTPS connection for microphone recording. LumiLearn keeps HTTP on port 3000 and adds local HTTPS on port 3443. Caddy issues a certificate for your Mac's current LAN IP and localhost using its own local certificate authority (CA).

1. Run `npm run docker:start` on the Mac. HTTPS, the reading service and free language models start automatically; missing models are downloaded on the first start. The printed iPad address is `https://YOUR_MAC_IP:3443`. Keep the Mac and iPad on the same trusted Wi-Fi.
2. Run `bash scripts/export-local-ca.sh` if needed. It copies only the public root certificate to `data/certificates/lumilearn-root.crt`.
3. Transfer that public `.crt` file to the iPad, for example with AirDrop. Open it, then go to **Settings → General → VPN & Device Management** (or **Profile Downloaded**) to install the downloaded profile. Review that it is your LumiLearn local certificate authority.
4. Go to **Settings → General → About → Certificate Trust Settings** and manually enable full trust for that CA. Installing the profile alone is insufficient. LumiLearn never changes device trust settings automatically.
5. Open the printed HTTPS address in Safari, sign in, and allow microphone access when starting a recording. Use Parent → Settings for the iPad QR code.

Only install a CA you control. Keep `data/caddy` private on the Mac: it contains the signing private key. Never share `root.key` or the Caddy data directory. The export script and app public-certificate mount expose only the public root certificate. Removing this CA from the iPad's installed profiles revokes trust. Deleting the Mac CA data creates a new CA next startup, which requires installing and trusting its new public certificate again.

If the Mac changes IP, rerun `bash scripts/start.sh` to update the QR address and Caddy certificate. Prefer a DHCP reservation on your router to keep the address stable. Do not forward these ports from the public internet.

# Free local language models

Normal `npm run docker:start` automatically runs the model setup service, downloads missing assets, and waits for the reading service to load both models before reporting ready. Cached starts work without contacting model registries. The setup service downloads the free faster-whisper `tiny.en` speech model and Argos English-to-Vietnamese translation package into `data/reading-models`. Downloads need internet access and enough disk space. Normal inference runs on an internal Docker network with no external access. If startup fails because a download was interrupted, restore internet access and rerun `npm run docker:start`. `bash scripts/warmup-reading.sh` remains an optional repair command. Model downloads and speech accuracy can vary; the English tiny model is intentionally small for CPU use.

Audio is limited to 6 MiB and 30 seconds, decoded in memory before inference. Translation accepts at most 4000 characters. The service keeps request text, decoded audio and results in memory only, disables access logs, and serializes inference/rendering with a busy 503 instead of building an unbounded queue. Only model assets are cached. PDF rendering is in memory, accepts at most 20 MiB and 50 pages, and rejects oversized image output rather than truncating pages. The app handles authentication before proxying to these private endpoints.

Upstream references: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Argos Translate](https://github.com/argosopentech/argos-translate), [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https).

Always start through `bash scripts/start.sh`: it loads a private random proxy secret from `data/caddy/proxy-secret` into both Caddy and the app. This lets the app verify that HTTPS forwarded headers came from its local Caddy proxy. The file is mode 600 and must stay private; it is never exported as a certificate or mounted into the app. Starting with plain `docker compose up` without these exported variables leaves the proxy trust check unavailable; rerun the start script if HTTPS requests fail that check.

Book passage Meaning now uses OpenAI (`OPENAI_BOOK_TRANSLATION_MODEL`, default
`gpt-6-luna`). Word taps still use local Argos. Only the selected reviewed passage
is sent, with no student profile, images or conversation history. Translations are
cached in PostgreSQL across readers and restarts; changing text or model creates
a new cache entry. Concurrent requests cannot generate the same passage twice.
New requests require the existing external-AI opt-in and monthly AI budget. Each
attempt reserves a conservative $0.01 allowance (not an invoice cost), including
failed attempts; cached results require no new allowance or OpenAI request.
