# MCode Emote

A lightweight desktop pet for the installed MiniMax Code CLI. Windows x64 beta,
verified with `@minimax-ai/code` 0.6.2. The existing Claude command is separate.

## Install and launch

From this checkout, with Node 22.19+ or a Node version supported by MCode:

```powershell
npm ci
npm run build
npm run overlay:package
node bin/mcode-emote.cjs --emote-install
# Optional: display the actual chat title
node scripts/install-mcode-titles.mjs
npm run mcode:install-command
mcode-emote --emote-doctor
mcode
```

The optional command installer creates only `mcode-emote` in npm's global bin
directory using npm's shim generator. It refuses to overwrite existing commands.
After installation, plain `mcode` loads the plugin and starts the pet automatically.
The plugin carries its own runtime; the checkout is only needed for the optional
`mcode-emote` management/wrapper command and future rebuilds.

`--emote-install` asks MCode for its active local plugin directory, installs an
automatic companion plugin, and enables it. Repeat after rebuilding source or moving
Node. It refuses to overwrite a plugin that lacks its ownership marker. Existing
MCode configuration, credentials, model, provider, permission policy, and sessions
remain under MCode's control. No provider fallback is added; user-owned/BYOK
provider failures stay with that provider.

```powershell
mcode --continue
mcode --session SESSION_ID
mcode --model provider/model
mcode exec --max-steps 3 "Your task"
mcode-emote --no-emote --continue
mcode --version
```

MCode arguments are passed as individual arguments, without a command shell.
Help, version, plugin/provider management, login/logout and update commands bypass
the pet. ACP is not supported. The first release supports the desktop renderer.
Close the pet to continue using MCode without the window; it stays dismissed for
that MCode process. Close MCode to clean up its companion. With the title bridge enabled, the small heading shows the actual chat title. Untitled chats and headless exec retain the starting folder basename. To disable automatic startup, run:

```powershell
mcode plugin disable mcode-emote@local
# Enable it again:
mcode plugin enable mcode-emote@local
```

## Integration and privacy

MCode supports compatible local plugins at `.claude-plugin/plugin.json`. This
format is used intentionally: its exec-form `command` plus `args` avoids a shell
and makes MCode the direct parent of the hook process. The native MiniMax manifest
currently rejects exec-form args. No Claude executable or model is involved.

MCode strips custom environment variables before running hooks. SessionStart
starts a detached companion; UserPromptSubmit can repair a crashed companion.
A Windows named pipe prevents duplicate startup. Only after native readiness,
the companion atomically publishes a private connection at
`~/.mcode-emote/connections/<mcode-process-id>.json`. It contains an unpredictable
bearer capability and a loopback URL. Hooks check their direct parent's record
and the companion PID. Windows files inherit the user's profile ACLs. Never
publish connection files. Cleanup removes only the broker's unchanged record.

Native binaries use a short, content-checked `~/.mcode-emote/runtime` cache to
avoid Windows path limits in MCode's deeply nested plugin cache. Previous installed
payload revisions are preserved outside the plugin directory in the profile's
`mcode-emote-archive` folder; active MCode sessions keep their cached snapshots.

The hook bridge sends no stdout, permission decisions, or context additions,
and makes no model calls. It drops prompts, output, paths, tool arguments/results,
and raw session IDs before HTTP. Only a sanitized folder basename is passed to the
window through its environment; it stays outside HTTP/SSE and connection files. The semantic state stream still sends only five fields. The optional title bridge uses a separate authenticated `/identity` endpoint and sends the sanitized chat title plus a hashed session ID. It drops workspace/model fields. Inactive-session hooks cannot end or take over an active root's pet; an explicit TUI session-change can select another chat. After that root ends, a subsequent root can use the pet.
On CLI exit or crash the companion closes itself and its window. If the companion
itself crashes, the window closes after five seconds disconnected; the next
prompt can start a replacement. Brief disconnections may reconnect within that
interval. Manual dismissal never causes immediate reopening.

## Supported signals and limits

| MCode signal | Pet |
| --- | --- |
| SessionStart | Greeting |
| UserPromptSubmit | Thinking |
| PreToolUse: read/grep/glob/web_search/web_fetch | Reading |
| PreToolUse: write/edit/apply_patch | Writing |
| Other PreToolUse / SubagentStart | Using tools |
| PermissionRequest | Needs your input |
| PostToolUse / SubagentStop | Thinking |
| PreCompact / PostCompact | Compacting / idle |
| Stop | Ready |
| SessionEnd / CLI exit | Ended |
| CLI process disappears | Ended (exit success/failure is unavailable to the plugin) |

One active root session is tracked per MCode process. Resume and a new root
after SessionEnd reuse its pet. With the title bridge enabled, TUI session-change notifications select the active chat. Without it, switching roots without an end signal requires restarting MCode. A resumed TUI may not emit a startup hook until its next prompt, so the pet can first appear then. Separate CLI processes get separate pets. Full simultaneous multi-session management remains unfinished.

MCode 0.6.2 does not emit a supported MessageDisplay or StopFailure hook. Its
compatible PostToolUse hooks omit failed tools. The pet cannot detect streamed
speaking, every tool failure, or an interrupted/failed turn while the interactive
CLI stays open. It can remain on its last activity until another hook arrives.
Only normal Stop is labeled ready; no success is invented for missing events.

The overlay retains the shared Windows beta limitations: installer/signing,
tray, auto-update, and verified drag/position persistence remain future work.
The current Windows capture helper could not reliably capture/activate the native
window in this run; browser visuals and native readiness are separate evidence.

## Repeatable verification

```powershell
npm test
npm run overlay:typecheck
npm run verify:upstream
npm run mcode:smoke
```

The smoke command creates a fresh `.tmp/mcode-real-*` profile and workspace. It
installs the actual plugin into that isolated profile, starts plain real MCode
without the wrapper and automatically opens the native overlay, and uses an explicit loopback Anthropic-protocol fixture.
The fixture returns a read-tool request and a final response; no paid model or
user credentials are used. It asserts real reading, Stop/ready, ended, companion exit, and native cleanup.
Evidence contains semantic states and synthetic CLI output, never the capability.

Validation results for automatic startup are recorded in
[the implementation and regression note](incidents/2026-10-02-mcode-automatic-startup.md).
All 647 tests across 63 files passed, along with desktop type checking and the real plain-MCode/native-window lifecycle smoke. A real interactive MCode 0.6.2 TUI also delivered its existing title and a `/rename` update through the supported status command, using an isolated profile and loopback-only model fixture. See [the title and binding audit](incidents/2026-10-03-mcode-bindings-and-chat-titles.md).
The screenshot is the actual built browser UI in demo mode, not evidence of a
live provider request. No Claude or MiniMax model quota was used.

References: [MCode plugin management](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/examples.md#4-manage-plugins),
[hook behavior and limits](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/hooks.md),
[hook runner](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/runner.ts),
[hook parser](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/parser.ts).

## Updating MCode

Normal CLI updates should preserve this plugin because MCode discovers it from
its active profile's local plugin directory, separate from the CLI package.
The plugin contains its own runtime and does not patch MCode installation files.
Compatibility is verified with MCode 0.6.2; future hook or process-launch changes
are not guaranteed compatible. In particular we depend on compatible exec-form
hooks, session lifecycle events, direct-parent process identity, and hook cwd.

After updating, `mcode-emote --emote-doctor` checks discovery and installation
without a model request. `npm run mcode:smoke` from this checkout verifies actual
hooks and native startup using a loopback fixture with zero paid model usage.
If Node moves or you switch MCode profiles, run `mcode-emote --emote-install`
again. Doctor is a setup check, not proof that all hooks work on a new version.

## Chat titles

Run `node scripts/install-mcode-titles.mjs` after installing the plugin, then restart MCode. This configures MCode's documented custom status command, which receives `session_title`; plugin hooks themselves have no title field. The command is silent, adds no model context, and makes no model requests. Titles update at lifecycle events or within about eleven seconds of a rename. Long titles are truncated visually with a tooltip.

Setup backs up `config.yaml`, preserves unrelated settings, and refuses to replace an existing custom status command or enable a command under incompatible build-mode settings. This integration applies to plain interactive `mcode`; headless exec and the legacy wrapper retain the folder label. Untitled chats also show the folder basename. The native window receives the sanitized title over authenticated local HTTP; message bodies, credentials, and full workspace paths are excluded. Chat titles can themselves contain text derived from your first prompt.

To disable title delivery, remove `custom-command` from `tui.statusLine` and the `tui.customStatusLine` block added by setup, then restart MCode. Keep the backup for comparison; do not overwrite newer settings wholesale.

Source: [MCode custom status command](https://github.com/MiniMax-AI/minimax-code/blob/main/packages/tui/docs/status-line-config.md).

Source: [MCode local plugin management](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/examples.md#4-manage-plugins).
