# Evaluation v1 · 50 newly authored Portuguese chat messages

Codex authored all 50 synthetic inputs and English references on 2026-10-28,
before running the dataset. No live chat or personal data was used. Cases
cover greetings, gaming slang, negation, sarcasm, technical trouble, numbers,
URLs, mentions, Unicode emoji, repeated emotes and channel-emote fragments.
The glossary and translator were not changed after authoring this dataset.
Their hashes and the dataset hash are recorded in the machine-readable report.

This is more coverage than the five starter rows. It is **not independent
validation**: the same author wrote the translator, saw the glossary, and
wrote these references. One reference is also insufficient to grade every
valid natural translation. Bilingual human review and unseen messages are
still necessary. No EN→PT translation quality claim is made from PT→EN data.

Run `npm run eval:50`. The committed `docs/eval-50-report.json` contains all
inputs, references, outputs, errors and per-example scores. The terminal shows
only aggregates. Provider variants are explicitly NOT RUN without a key;
provider errors are never replaced by offline answers in those variants.
The CLI spaces requests by at least three seconds and retries HTTP 429 at
most three times, waiting at least 31 seconds or the longer Retry-After header.
It never retries to improve a translation score. Test/library calls do not
wait unless pacing is explicitly requested. `PONTE_EVAL_INTERVAL_MS` can
increase the spacing. Request time excludes initial scheduled queueing but
includes any retries and their backoff; every row records its retry count.

The first real provider attempt ran too quickly and received 114 HTTP 429
errors out of 150 provider requests. It is preserved in
`docs/eval-50-attempt-1.json` and is **not a comparable quality result**:
each variant completed a different subset. The subsequent paced run uses
the same dataset, references, translator and glossary; only scheduling changed.

chrF here is a custom mean of sentence scores, character orders 1–6, beta=2,
whitespace removed, case preserved. It is not SacreBLEU corpus chrF. Detection
is reported separately: translation comparison fixes the known source
language to Portuguese. p50/p95 use successful-attempt wall time. Token and
emote retention count occurrences, including repeated emotes, on successful
translations only. Failure counts must be considered alongside retention.
Slang left untranslated uses annotated token/phrase boundaries, case ignored;
this is a diagnostic, not semantic accuracy. Full protected-token retention
cannot establish fluent or correct translation.

The source hash before dataset creation is in `data/eval-50.manifest.json`.
Do not tune the glossary against these results. Future changes need a separate
development set; this set is already exposed and retesting must say so.
