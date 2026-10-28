# Ponte · PT ↔ EN

Built with Codex in a new local project. A live Twitch chat bridge with
an OBS browser overlay, local moderation controls, opt-out commands, and
an offline synthetic demonstration. Nothing has been published or submitted.

## Quick start

Node **24+**, ESM, no npm dependencies and no install
step. Native WebSocket replaces the optional `ws` dependency from the brief.

```sh
cd /Users/louisxiv/ponte
npm test
npm run fixture
```

Open <http://127.0.0.1:8787/panel>. OBS Browser Source:
<http://127.0.0.1:8787/overlay>, width 1000, height 900, transparent background.
Use the exact `127.0.0.1` address, not `localhost`. Stop with Ctrl+C.
Fixture mode ignores provider keys, sends no Twitch requests, and displays
`FIXTURE / TEST CHAT · SYNTHETIC`. Emotes appear as text in fixture mode to
avoid CDN requests. No personal messages are used.

## Live setup (Groq exercised; Twitch OAuth validated)

1. Register a public Twitch application yourself in the Twitch developer
   console. No client secret is used. Copy `.env.example` to `.env`.
2. Set `TWITCH_CLIENT_ID`, `TWITCH_BROADCASTER_ID` (channel numeric ID) and
   `TWITCH_USER_ID` (numeric ID of the account authorizing the bot).
3. Run `npm run auth`. Visit the displayed verification URL yourself and
   authorize `user:read:chat user:write:chat`. Tokens stay in the git-ignored
   `.ponte-token.json` with mode 0600. Do not share this file.
4. Run `npm start`. Authentication validates at startup and hourly, refreshes
   near expiry, and retries one time after HTTP 401. Reauthorize if refresh fails.
5. Optionally set `GROQ_API_KEY`. Live chat text then goes to Groq for
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
user per ten seconds. The bot's own messages are ignored to prevent feedback loops.
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
messages; evidence is in `docs/groq-smoke-report.json`. This does not validate
the Twitch chat integration or OBS. The Twitch OAuth token was validated for
`igoreduardoai`; see `docs/twitch-auth-report.json`. Real refresh, reconnect,
EventSub, moderation, Helix replies,
OBS rendering and a 15-minute live session remain pending. Browser inspection
confirmed transparent computed backgrounds on the overlay root and body.
Current blockers and evidence are recorded in `docs/integration-status.md`.
No migration applies: this is a fresh in-memory application. No third-party
code, package or repository was installed or executed. Before adding one,
follow the user's provenance review and disposable-VM requirement.

Protocol references: [Twitch OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/),
[EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Chat events](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

MIT license. This project's local creation date is 2026-10-28. It is not
represented as a project created after 2026-10-30 or as an eligible Kiroween
submission. No contest eligibility, account ownership, or session ID is fabricated.


## Reproduce the validation

- `npm test`: automated tests, synthetic data and mocked providers.
- `npm run check:live`: configuration presence only; no network request.
- `npm run test:groq`: real PT↔EN and recap calls with `GROQ_API_KEY`; offline
  fallback explicitly fails this check.
- `npm run eval:50`: all four variants; the CLI spaces real requests and
  performs bounded retries after HTTP 429. Reports include failures.
- `npm run session:id`: actual current Codex session identity, without changing
  a global status-line configuration. Evidence: `docs/codex-session.json`.
