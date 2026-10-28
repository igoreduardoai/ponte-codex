# Validation status · Ponte · 2026-10-28

Code, credentials and evidence live in the local project directory
(`<project>/`); credentials are git-ignored and are not part of this repository.
At the time this report was written there had been no push, no code
publication, no contest submission and no change to Cortexa. Synthetic
messages were sent in the authorized Twitch channel; no broadcast was started.

## The four requested items

1. **Real Twitch + Groq: main flow exercised.** OAuth, four EventSub
   subscriptions, PT↔EN messages, Groq translation, HTTP SSE delivery to the
   overlay, `!ponte` reply via Helix, Hide/Pause, opt-out/in, recap,
   recovery after client disconnect and token refresh passed:
   **12 real checks**, in the `igoreduardoai` channel authorized by the user.
   The refreshed token was reloaded from disk and validated, with the file in mode 0600.
   [Live report](twitch-live-report.json), [OAuth](twitch-auth-report.json).
   The first test revealed a bug: the streamer's own messages were
   dropped when streamer and bot used the same account. [Preserved failure](twitch-baseline-report.json).
   I fixed the filtering so it ignores only known bot replies,
   including the race where EventSub arrives before the Helix response.
   Manual review of the first run also found the "no English messages"
   notice appearing in the PT field. I located that notice in the
   pipeline and added `engine` to the recap to distinguish Groq from fallback.
   That run is kept as the [previous attempt](twitch-live-attempt-1.json);
   the final run repeated all 12 checks and verified the corrected PT text.
   The corrected repeat used ten synthetic chat/command inputs,
   plus the automatic replies. Unrelated chat was filtered before calling
   Groq. The translator source and the 50-example dataset did not change.
   In the browser, the overlay showed `LIVE TWITCH TEST · SYNTHETIC` and loaded
   Kappa from the Twitch CDN (`naturalWidth=50`), with transparent root and body.
   [Browser check](twitch-browser-report.json),
   [screenshot](twitch-live-overlay.png).
   The test connections were closed. The [preflight](live-preflight.json)
   now reports configuration present; on its own it does not validate a provider.
2. **OBS: not executed.** It was not found in the standard folders, in the
   application inventory, or via a Spotlight search for `OBS.app`.
   No installation was attempted: the user's instructions require a
   provenance review and a first run in a disposable VM for new software;
   that validation was not performed.
   I fixed the HTML root background and checked root and body transparency
   in the browser, with six lines visible. This does not exercise Browser Source,
   compositing, capture or recording in OBS.
   [Record](obs-validation.json) and [screenshot](overlay-browser-preview.png).
3. **50 examples: written and executed.** New synthetic messages in
   PT and EN references written by Codex before the first evaluation.
   Each variant completed 50/50 in the paced re-run: 150 Groq
   translations and 50 offline, with no failures or retries. The first attempt hit 114
   HTTP 429 errors and is preserved as [incomplete](eval-50-attempt-1.json).
   Only the second run compares the same complete set.
4. **Real session ID identified and saved:**
   `01a1829a-60b5-7f91-b903-27adbd1d91a8`.
   Read from `CODEX_SESSION_ID` and `CODEX_THREAD_ID`, and checked against the
   app inventory's `codexSessionId`. The `statusline` skill was consulted;
   there was no need to change global configuration or use a fake payload.
   [Evidence](codex-session.json), [method](codex-session.md).

## Measured results on the 50 examples

| Variant | Completed | chrF | Emotes preserved | Slang left untranslated | p50 ms | p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Literal prompt | 50/50 | 63.44 | 100% | 7.89% | 480.78 | 1133.27 |
| Ponte without glossary | 50/50 | 63.12 | 100% | 2.63% | 525.45 | 1495.18 |
| Ponte full | 50/50 | 64.66 | 100% | 2.63% | 542.85 | 1282.48 |
| Offline rules | 50/50 | 23.72 | 100% | 78.95% | 0.01 | 0.04 |

[Report with all outputs](eval-50-report.json) ·
[Examples](../data/eval-50.jsonl) · [Method](eval-50-methodology.md).
The hashes of the dataset, glossary and translator source confirm that none
was adjusted after seeing these results. Only the evaluation scheduling
changed, to space out calls and respect HTTP 429.

chrF is a mean of sentence scores, not SacreBLEU corpus chrF. Latencies
exclude the initial wait between requests. The 20 annotated emotes and 28
annotated protected tokens were preserved in all four variants. This does not
prove correct translation. The dataset is synthetic and its author wrote the
implementation; it is not independent or blind validation. The 1.22-point gain
of the full variant over the literal prompt does not establish general
superiority from this test.

## Defects observed while reviewing the outputs

- `pt-05`: “não abre o baú ainda” (“don't open the chest yet”) lost the
  negative command and became “the chest still won’t open” in the chat variants.
- `pt-19`: “valeu cada centavo” (“it was worth every cent”) became
  “thanks for every cent” in the full variant; the glossary translation of
  “valeu” contributed to this meaning error.
- `pt-26`: “fui de base” (slang for “I got eliminated”) was interpreted as
  a location at the base instead of being eliminated, in all three Groq variants.
- `pt-12`: the chat variants introduced profanity when translating “mds”.
- The detector recognized PT in only 40/50 examples. Another eight were
  marked unknown and two as EN. The comparison fixes PT as the
  known language, so it does not measure full-pipeline quality. The real
  pipeline would leave the unknown ones unchanged and would choose the wrong
  direction for the two classified as EN.

The offline mode is weak for free-form sentences. I did not fix these cases by
tuning the glossary to this exposed set. Future improvement needs a separate
development set and independent validation.

## Execution and pending items

`npm test`: **29 tests passed**, including rejection of fallback as a
real success, duplicates, repeated emotes, fragments, session identity,
and bounded waiting after HTTP 429. No data migration was needed.

Not yet exercised: real Twitch deletion, timeout and clear events;
the server-requested `session_reconnect` handoff from Twitch;
OBS and a 15-minute broadcast. The three moderation subscriptions were
accepted, but no remote moderation action was triggered. The token has
chat read/send scopes only and there is a single test account: appropriate
access to generate those actions in a controlled way is missing. The
server-requested handoff was not triggered by Twitch during the test; the test
exercised reconnection after the client closed. OBS remains absent and its
installation requires the review and disposable VM defined by the user.
No broadcast was started. No new third-party package, image or application
was installed. Mocks do not count as execution of these items.
