# Local validation · 2026-10-28

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
