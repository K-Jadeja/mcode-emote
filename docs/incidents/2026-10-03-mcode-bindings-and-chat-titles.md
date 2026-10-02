# MCode event audit and real chat titles

## Binding audit

MCode knows its internal streaming phase but its published plugin hooks do not
expose assistant-text start/delta/end. The current 0.6.2 installed hook contract
still provides eleven events. Bound semantic states:

| Observed signal | Pet state | Boundary |
| --- | --- | --- |
| SessionStart | Greeting | First active root, not every subagent |
| UserPromptSubmit | Thinking | Does not distinguish reasoning from reply streaming |
| PreToolUse read/grep/glob/web search/fetch | Reading | Native underscore aliases now included |
| PreToolUse write/edit/apply_patch | Writing | Patch alias now included |
| Other PreToolUse / SubagentStart | Using tools | No claim about arbitrary tool internals |
| PermissionRequest | Needs approval | Rejection/cancellation has no dedicated signal here |
| Successful PostToolUse / SubagentStop | Thinking | Concurrent work uses last observed activity |
| PreCompact / PostCompact | Compacting / waiting | Represents observed compaction hooks |
| Stop | Ready | Normal completion only |
| SessionEnd / owner process exit | Ended / closes | Exit alone does not prove success |

Remaining gaps: live speaking, reliable interrupted/failed-turn state, compatible
failed-tool events, and precise simultaneous subagent activity. Do not promise
complete runtime coverage or substitute timers for missing signals. Two CLI
processes have separate PID-bound authenticated endpoints; foreign child-session
events cannot take over an active root.

## Chat title source and transport

MCode's documented custom status command receives `session_id`, `session_title`,
`event`, and `workspace_dir`. It runs at startup, turn end, session/workspace
changes, and configured intervals. This is a separate supported TUI interface,
not a newly discovered streaming hook. Prior statements that titles were absent
from plugin hooks remain true but did not cover this additional integration.

Install the stable `mcode-status.cjs` entry alongside the plugin. It resolves the
current immutable runtime through the atomic manifest. Enable it with
`node scripts/install-mcode-titles.mjs`. Setup backs up the profile config,
preserves unrelated YAML settings, refuses existing custom commands and
build-mode conflicts, and adds a silent custom item with a ten-second refresh.
Empty stdout means no extra terminal status text and no model context.

Windows custom commands run through cmd.exe. Resolve that shell's parent PID
using a bounded local process query, then read only that MCode process's live
connection. Do not find sessions by scanning all connection files. Hash the
native session ID and sanitize/truncate the title before transmission. Drop
workspace, model, and all other fields. Never log or persist titles in the bridge.

The optional authenticated `/identity` channel is separate from the unchanged
five-field semantic state. The native UI polls it locally and renders the title
as text, with truncation and a tooltip. A missing title uses the existing folder
label; failures clear stale title text. Session-change notifications can rebind
the pet to the selected chat; subsequent inactive-root events are ignored.
Titles may take about eleven seconds to refresh. Headless exec has no TUI status
command, so it keeps the folder label. No speaking support is added by this work.

Privacy change explicitly requested by the user: the actual chat title now
reaches the local native window through authenticated loopback HTTP. Full paths,
prompts, messages, and model/provider settings do not travel with it. No external
service, paid model request, database scraping, or CLI patch is involved.

## Verification workflow

Unit tests validate title sanitization, bounded payloads, omitted fields, and
authentication in the browser client. Process tests use the real Windows shell
parent shape and assert silent title delivery, rejection of wrong-session titles,
explicit active-chat switches, and authentication. Native event alias regressions
cover web_search, web_fetch, and apply_patch. Run full tests sequentially with
the real CLI smoke to avoid resource-sensitive timing failures.

Sources:
- https://github.com/MiniMax-AI/minimax-code/blob/main/packages/tui/docs/status-line-config.md
- https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/contracts.ts

## Verified October 3, 2026

- Full suite: 647 tests across 63 files passed; desktop type check and native packaging passed.
- Real plain MCode 0.6.2 exec plus native overlay: loopback fixture emitted read and final response; reading/ready/ended and process cleanup passed.
- Real interactive TUI resumed the synthetic session, then sent one prompt to that same loopback fixture. Native readiness passed. The status command delivered `Read sample.txt and reply briefly.` without manual identity injection. `/rename Title bridge verified` updated authenticated `/identity` to that exact value.
- Evidence: `.tmp/mcode-real-1790966483248/tui-title-evidence.json` (synthetic titles only; no capabilities). Title installer ran twice successfully against this isolated profile.
- Resume alone did not start the companion in this test; the next UserPromptSubmit did. This is an observed lifecycle limitation, not evidence of startup on every resume.
- No paid model calls. Native readiness and delivered identity are verified; native-window screenshot/compositing is not claimed by this check.

Installed plugin 0.3.0 and enabled the title command in the active user profile. Setup created a config backup; non-TUI settings were verified unchanged. Isolated setup was idempotent (one backup after two runs), and the resumed test companion cleaned up on TUI exit. Existing user sessions were not stopped; restart MCode to load the updated plugin and status configuration.
