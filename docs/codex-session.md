# Codex session evidence

Session ID: `01a1829a-60b5-7f91-b903-27adbd1d91a8`

This is the actual chat in which the Ponte code was authored. It was read
from both `CODEX_SESSION_ID` and `CODEX_THREAD_ID` in this process, and matched
the `codexSessionId` reported by the desktop browser inventory. No new chat,
generated UUID or mocked status-line payload was used as submission evidence.

The user-invoked `statusline` skill at
`~/.agents/skills/statusline/SKILL.md` (local, not in this repository) documents receiving
`session_id` via a CLI status-line JSON payload and editing a Cursor CLI
configuration. That is not necessary to identify this active desktop chat;
global CLI configuration was left untouched. The official Codex command
reference also documents `/status`:
<https://learn.chatgpt.com/docs/developer-commands>.

`npm run session:id` reads actual process variables, refuses absent or
conflicting evidence, and prints the ID and observation time. Run it from
inside the active Codex environment. `docs/codex-session.json` records the
actual invocation. This proves the observed identifier, not contest acceptance.
