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

## Live setup (not yet exercised with real credentials)

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
npm run eval
# Later, supply your independently written 50-row held-out dataset:
npm run eval -- /absolute/path/to/held-out.jsonl
```

Each JSONL row contains `text`, `reference`, `emotes` (array of preserved
strings), and `slang` (array of PT slang tokens expected to translate).
Five synthetic starter rows are included. **These are a smoke test, not an
independent benchmark**. Do not tune the dictionary/glossary against your
held-out set. The 50 user-written examples remain pending.

| Variant | Executed without provider key | Result on 5 starter rows |
| --- | --- | --- |
| Literal prompt | No | NOT RUN |
| Ponte without glossary | No | NOT RUN |
| Ponte full | No | NOT RUN |
| Offline rules | Yes | chrF 94.35; 100% annotated emote retention |

`eval-report.json` records actual p50/p95 wall-clock latency, provider failures,
emote retention, and slang left untranslated. No slang annotations exist in
the starter rows, so that metric is `null`. chrF is a custom sentence-macro
character F-score (orders 1–6, beta=2, whitespace removed); it is not a
SacreBLEU corpus score. Failed provider runs are reported, never silently
replaced with offline translations in the comparison.

## Honest limits and remaining validation

The offline translator does not translate arbitrary sentences or reorder
grammar. Detection is heuristic, mixed-language chat is ambiguous, and
Unicode emoji protection is not exhaustive. API quotas/pricing and model
availability depend on the provider; zero cost is guaranteed only for the
offline fixture. No payment or paid resource has been configured.

Real Twitch login, refresh, reconnect, moderation events, Helix replies,
Groq translation, OBS rendering and a 15-minute live session still require
real-provider validation. Browser UI verification is recorded separately.
No migration applies: this is a fresh in-memory application. No third-party
code, package or repository was installed or executed. Before adding one,
follow the user's provenance review and disposable-VM requirement.

Protocol references: [Twitch OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/),
[EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Chat events](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

MIT license. This project's local creation date is 2026-10-28. It is not
represented as a project created after 2026-10-30 or as an eligible Kiroween
submission. No contest eligibility, account ownership, or session ID is fabricated.
