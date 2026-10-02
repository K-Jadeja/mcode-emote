# Automatic MCode companion startup

## Problem and cause

The initial MCode observer only found connections created by `mcode-emote`.
Plain `mcode` loaded the plugin but could not launch a pet. MCode intentionally
strips custom hook environment variables, so an inherited endpoint cannot solve
this. The desired pi-style experience is install once, then run the ordinary CLI.

## Implementation

The installed compatible plugin invokes the bridge directly with `--auto`.
SessionStart, or UserPromptSubmit after a companion crash, starts a detached
per-MCode-process broker. A Windows named pipe makes concurrent hook startup
exclusive and releases automatically if the broker dies. An authenticated
connection record is published atomically only after the native window has
acknowledged its decoded first frame and live state stream.

The broker watches the MCode PID and closes its owned native window/server on
exit, including abrupt parent termination. The native MCode UI closes after a
five-second disconnected interval if the broker itself dies. A manual window
dismissal keeps the broker alive so subsequent prompts do not reopen it.
Ended sessions can transition to a subsequent root session in the same process;
foreign child-session events cannot terminate the active root. Multiple active
roots inside one MCode process remain outside the supported contract.

The previous wrapper remains compatible and reuses its own existing connection.
`--no-emote` writes a process-bound suppression marker while its MCode child is
alive. Ordinary plain `mcode` needs neither the wrapper nor an alias. No model
requests, provider substitution, permission decisions, or prompt additions are
introduced. This is local user-owned tooling; BYOK routing is unchanged.

## Real CLI failure found during acceptance

The first automatic real-CLI smoke failed to observe any pet states. Source
fixture tests passed, but MCode copies plugins into a hashed plugin-hook-cache.
The resulting executable path exceeded Windows' native launch limit. Capturing
the actual startup result showed `spawn-error` / `ENOENT` even though Node could
read the packaged executable at that path.

The native executable and resources now materialize into a short content-keyed
`~/.mcode-emote/runtime/<digest>` directory. Existing bytes are verified; corrupt
content fails explicitly. Publication uses temporary files and exclusive hard links, so concurrent launches
cannot replace an executable already in use.
The installer embeds immutable runtime revisions in the plugin, making it
independent of the source checkout. Earlier revisions are retained for sessions
already running. Do not publish connection records or their bearer tokens.

## Regression and acceptance workflow

Run `npm test`, `npm run overlay:typecheck`, `npm run verify:upstream`, and
`npm run mcode:smoke`. The smoke installs the actual plugin into an isolated
profile and invokes the actual MCode CLI directly, without the wrapper. Its
local Anthropic-protocol fixture produces a read-tool call and final response.
Assertions cover reading, ready, ended, daemon exit, and native-window exit.
It consumes no Claude or MiniMax model quota.

Process regressions cover duplicate startup, resume, root handoff after end,
child-session isolation, companion crash repair, intentional dismissal,
parent crash cleanup, and explicit opt-out. UI regressions cover reconnect
after ended and delayed orphan closure. The long-path cache regression also
checks refusal to silently overwrite corrupted native files.

Native first-frame/SSE acknowledgement proves renderer readiness, not screenshot
capture, window compositing, dragging, or real-provider acceptance.

The corrected real CLI/native smoke passed in `.tmp/mcode-real-1790960436739`.
The failed long-path reproduction is retained in `.tmp/mcode-real-1790960193860`.

Final verification: 639 tests across 60 files passed, including the automatic
process and native-cache regressions; desktop TypeScript passed; all 140 upstream
files were verified unchanged. No real-provider requests were made.
