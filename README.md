# Ponte · PT ↔ EN

Built with Codex in a new local project. A live Twitch chat bridge that
translates Portuguese ↔ English chat, with a browser overlay (browser source
designed for OBS; not yet tested inside OBS), local moderation controls,
opt-out commands, and an offline synthetic demonstration.

## Quick start

Requirements: **Node.js 24 or newer** (`node --version`). ESM, zero npm
dependencies; native WebSocket replaces the optional `ws` dependency from the
brief. `npm install` is safe to run but installs nothing.

```sh
git clone https://github.com/igoreduardoai/ponte-codex.git
cd ponte-codex
npm install          # no dependencies; optional
cp .env.example .env # only needed for live mode; fixture mode works without it
npm test             # automated tests (synthetic data, mocked providers)
npm run fixture      # offline synthetic demo on http://127.0.0.1:8787
```

Open <http://127.0.0.1:8787/panel>. The overlay is a browser source designed
for OBS; not yet tested inside OBS. Browser Source URL:
<http://127.0.0.1:8787/overlay>, width 1000, height 900, transparent background.
Use the exact `127.0.0.1` address, not `localhost`. Stop with Ctrl+C.
Fixture mode ignores provider keys, sends no Twitch requests, and displays
`FIXTURE / TEST CHAT · SYNTHETIC`. Emotes appear as text in fixture mode to
avoid CDN requests. No personal messages are used.

## Live setup (Twitch + Groq integration exercised)

1. Register a public Twitch application yourself in the Twitch developer
   console. No client secret is used. Copy `.env.example` to `.env`.
2. Set `TWITCH_CLIENT_ID`, `TWITCH_BROADCASTER_ID` (channel numeric ID) and
   `TWITCH_USER_ID` (numeric ID of the account authorizing the bot).
3. Run `npm run auth`. Visit the displayed verification URL yourself and
   authorize `user:read:chat user:write:chat`. Tokens stay in the git-ignored
   `.ponte-token.json` with mode 0600. Do not share this file.
4. Run `npm start`. Authentication validates at startup and hourly, refreshes
   near expiry, and retries one time after HTTP 401. Reauthorize if refresh fails.
5. Optionally set `GROQ_API_KEY` in `.env` (never commit it). Live chat text then goes to Groq for
   translation using `openai/gpt-oss-20b`. Without it, or on provider errors,
   the app uses a small, intentionally limited word dictionary.

EventSub listens to `channel.chat.message`, `channel.chat.message_delete`,
`channel.chat.clear_user_messages`, and `channel.chat.clear`. Deletion and
timeout events remove visible lines and cancel pending translations. Emote
fragments are protected alongside mentions, links and common emoji. Live
original text displays emote images from Twitch's CDN. Translated text keeps
the emote spelling. Unknown language stays unchanged rather than guessing.

`!ponte` reports status, `!ponte off` opts your own messages out, and
`!ponte on` opts back in. Helix sends replies; replies are limited to one per
user per ten seconds. Generated bot replies are ignored by known message IDs
and text, including replies arriving before Helix returns. The broadcaster's
normal chat still translates when broadcaster and bot share one account.
Hide removes a line, Pause clears that user's lines and stops their future
translations; Retomar resumes them. Settings and the last 100 lines live in
memory only. Every 60 seconds Groq can summarize each language's topics for
the other side. Without a provider, a labeled **extractive recap** quotes up
to three visible lines from the opposite language instead. Moderation clears
the previous recap and rejects any provider summary already in flight.

The server binds only to loopback. Mutations require a same-origin JSON POST
and Host validation; chat content is rendered with text nodes. No token or
environment file is served by HTTP.

## Evaluation

```sh
npm run eval:50
# Or supply a separate independently authored dataset:
npm run eval -- /absolute/path/to/held-out.jsonl
```

Each JSONL row contains `text`, `reference`, `emotes` (array of preserved
strings), and `slang` (array of PT slang tokens expected to translate).
Fifty new synthetic Portuguese messages and English references are in
`data/eval-50.jsonl`. Codex authored them before the first run and did not
change the translator or glossary based on the results. This is **not a blind
independent benchmark**: the dataset author also wrote the implementation.
Five original starter rows remain in `data/eval.jsonl` for historical context.
`npm run eval` now defaults to the 50-row dataset; `npm run eval:50` also saves
its inspectable report to `docs/eval-50-report.json`.

See [evaluation methodology](docs/eval-50-methodology.md) and the actual report
for completed counts, chrF, emote and protected-token retention, annotated
slang left untranslated, p50/p95, and all per-example outputs. The first
unpaced Groq attempt hit HTTP 429 and is preserved as an incomplete attempt;
the paced run uses the unchanged dataset and translator. Do not compare
scores computed on different subsets or tune the glossary on these examples.

`eval-report.json` records actual p50/p95 wall-clock latency, provider failures,
emote retention, and slang left untranslated. The 50-row set contains slang
annotations; the five starter rows do not, so their slang metric is `null`. chrF is a custom sentence-macro
character F-score (orders 1–6, beta=2, whitespace removed); it is not a
SacreBLEU corpus score. Failed provider runs are reported, never silently
replaced with offline translations in the comparison.

## Honest limits and remaining validation

The offline translator does not translate arbitrary sentences or reorder
grammar. Detection is heuristic, mixed-language chat is ambiguous, and
Unicode emoji protection is not exhaustive. API quotas/pricing and model
availability depend on the provider; zero cost is guaranteed only for the
offline fixture. No payment or paid resource has been configured.

Real Groq PT→EN, EN→PT and bilingual topic recap were exercised with synthetic
messages; evidence is in `docs/groq-smoke-report.json`. The real Twitch/Groq
integration was then exercised in the explicitly authorized `igoreduardoai`
channel with synthetic messages only: EventSub subscriptions, chat delivery,
PT↔EN translation, HTTP SSE, Helix replies, Hide/Pause, opt-out/in, recap,
client-disconnect recovery and token refresh passed. The refreshed token was
reloaded from disk and validated. See `docs/twitch-live-report.json`.
The browser loaded a real Kappa image from Twitch's CDN and confirmed alpha
transparency. No broadcast was started. Real Twitch deletion/timeout/clear
notifications, server-directed reconnect handoff, OBS rendering and a
15-minute broadcast remain unexercised. Four chat subscriptions were created;
this does not count as exercising their three moderation notification types.
Current blockers and evidence are recorded in `docs/integration-status.md`.
No migration applies: this is a fresh in-memory application. No third-party
code, package or repository was installed or executed. Before adding one,
follow the user's provenance review and disposable-VM requirement.

Protocol references: [Twitch OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/),
[EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Chat events](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

MIT license. This project's local creation date is 2026-10-28. No contest
eligibility, account ownership, or session ID is fabricated.


## Reproduce the validation

- `npm test`: automated tests, synthetic data and mocked providers.
- `npm run check:live`: configuration presence only; no network request.
- `npm run test:groq`: real PT↔EN and recap calls with `GROQ_API_KEY`; offline
  fallback explicitly fails this check.
- `npm run eval:50`: all four variants; the CLI spaces real requests and
  performs bounded retries after HTTP 429. Reports include failures.
- `npm run session:id`: actual current Codex session identity, without changing
  a global status-line configuration. Evidence: `docs/codex-session.json`.

- `npm run test:twitch -- --channel <your_channel_login>` (validated on `igoreduardoai`): **sends public synthetic
  messages** in that explicitly selected channel and tests the real stack.
  The configured numeric broadcaster must resolve to that login before any
  message is sent. Unrelated chat is filtered before Groq calls. Add `--preview`
  to keep the local overlay on port 8788 for 90 seconds after the checks.
  The test ends its connection; no stream is started. The report records
  failed or unexercised checks rather than treating them as successful.
