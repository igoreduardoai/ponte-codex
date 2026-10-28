# Local validation · 2026-10-28

The baseline below records the initial commit. Updated provider, evaluation,
OBS and session evidence is in `docs/integration-status.md`.

Scope: new `/Users/louisxiv/ponte`, local Git only, no remote. No Cortexa
files were edited. No account login, external messages, publication or submission.

Runtime exercised: pre-existing Node v24.15.0 on the host. No new open-source
repository, dependency, image or install script was downloaded or executed.
Application code was authored in this Codex session; there are zero package
dependencies, lifecycle install hooks or telemetry. Synthetic fixture mode
does not call external providers or load CDN emotes. No personal data or
credentials were used. Future live mode's explicit destinations are Twitch
OAuth/Helix/EventSub, optional Groq, and the Twitch emote CDN.

Executed:
- `npm test`: 18 tests, including HTTP/SSE on loopback, same-origin moderation,
  racing deletes/timeouts, token refresh and Device Code polling with mocks,
  four EventSub subscriptions and dispatch with a fake socket, protected
  translation tokens, bilingual summary parsing and stale-summary rejection.
- `npm run eval`: five starter examples, offline chrF 94.35 and annotated
  emote retention 1.0. Provider comparisons explicitly NOT RUN, no API key.
  Output is in the ignored `eval-report.json`; latency is machine-specific.
- `npm run fixture`: successful loopback server execution on port 8787.
- Browser: panel showed SYNTHETIC badge and translations in both directions;
  Pause removed Ana's lines and showed Retomar pt1. Overlay rendered the
  remaining translated/original lines without control buttons. No OBS session.
- Initial Git diff reviewed against the brief; whitespace check passed.

No migration: no prior schema, database or data to migrate. The Node minimum
is 24 instead of 20 so no third-party WebSocket package is needed. MIT license,
environment template and ignored token files included. One initial local
implementation commit records work honestly; no retrospective step history.

Remaining unexercised: real Twitch authorization/refresh, reconnect against
the real service, emote CDN rendering, real moderation and Helix replies,
Groq translation/semantic recap, OBS and 15-minute live run. These require
credentials/provider access or an OBS session. Fifty user-authored held-out
rows have not been supplied; the five included rows cannot establish quality.
No contest registration or session ID retrieval was requested or performed.

No vulnerability scanner or disposable VM was used: there was no new
third-party software to install or promote. This is not a clean security
scan or proof of malware absence. Any future third-party installation or
rollout must follow the user's provenance review and isolated-VM rule.


## Follow-up validation

`npm test` now passes 25 automated tests. Fifty new synthetic examples were
written and exercised. Real Groq translation in both directions and bilingual
recap passed (`docs/groq-smoke-report.json`). The unchanged translator and
new dataset have SHA-256 evidence in the report and manifest. Actual session
identity was captured in `docs/codex-session.json`.

The original real evaluation attempt hit rate limits and remains preserved as
`docs/eval-50-attempt-1.json`. The paced comparison and all individual outputs
are in `docs/eval-50-report.json`. No glossary tuning was performed. See its
completed counts and errors before using scores.

OBS was not found and was not installed. Browser computed-style inspection
confirmed alpha-transparent root and body after correcting the root CSS;
this is not an OBS test. Evidence: `docs/obs-validation.json`.
Twitch OAuth subsequently completed and the real token was validated for
`igoreduardoai`. After explicit channel authorization, 12 real integration
checks passed: subscriptions, PT↔EN chat/Groq/SSE, emote fragments, Helix reply,
Hide, Pause/resume, opt-out/in, bilingual recap, client-disconnect recovery,
and token refresh. The refreshed token was reloaded from disk and validated.
The browser loaded Kappa from the Twitch CDN with natural width 50.
See `docs/twitch-live-report.json` and `docs/twitch-browser-report.json`.

The first real chat test failed because the shared broadcaster/bot account
was ignored wholesale. That failure remains in `docs/twitch-baseline-report.json`.
The pipeline now excludes only known generated replies. `npm test` passes
29 tests, including this regression and the EventSub-before-Helix race.
The translator/glossary and 50-row benchmark remain unchanged. Test sockets
and HTTP server were closed. OBS, real remote moderation actions,
server-directed reconnect handoff and a 15-minute broadcast remain pending.
No new third-party package, image or application was installed. No code was
published or pushed and no contest submission was made. Only the explicitly
authorized synthetic chat tests used Twitch; Ponte files remain local.


The first post-fix integration run exposed an English empty-chat notice in
recap's Portuguese field during manual output review. That run is preserved
as `docs/twitch-live-attempt-1.json`. The pipeline now localizes empty-side
notices and reports recap engine explicitly, so extractive fallback cannot
pass as Groq. The latest complete real run repeated all 12 checks and verified
the Portuguese notice; browser evidence was recaptured. The translator source
and the 50-row dataset were not modified by either integration fix.
