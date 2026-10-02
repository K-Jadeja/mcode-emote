# Speaking animation never starts during MCode replies

User observation: the pet follows tool activity but does not animate speaking
while MCode writes its assistant response into the terminal.

The renderer has talking frames at 150ms intervals in the desktop asset manifest.
The MCode event allowlist has no reply-stream event. UserPromptSubmit and
PostToolUse map to thinking; Stop maps to ready. Thus a text-only reply remains
thinking until Stop, and a reply after tool use does the same. This is an
integration limitation, not evidence that a talking frame failed to load.

The currently installed CLI is now `@minimax-ai/code` 0.6.2. Read-only inspection
of `chunks/chunk-UI7OHI22.js` confirms its hook event list remains SessionStart,
SessionEnd, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse,
SubagentStart, SubagentStop, Stop, PreCompact, and PostCompact. The current public
hook contract agrees. This limitation was already documented for 0.6.0.

The documented custom status-command extension provides startup, turn-end,
session/workspace changes, and periodic refresh; its input has identity fields,
not token-stream phase. It is not a source for accurately synchronized speaking.

No runtime patch, prompt injection, provider proxy, transcript/terminal scraper,
or guessed timer was introduced. No model calls were made. The current plain
MCode plugin cannot distinguish internal thinking from assistant text generation
through its existing hook interface. A proper follow-up needs an explicit
stream lifecycle signal from the MCode runtime (assistant-text start/delta/end),
reduced to semantic state before delivery to the pet. It must distinguish
reasoning, tool arguments/results, and user-facing assistant text, and handle
cancellation, failure, and session isolation. Mapping Stop to talking would
animate after the response finishes and would not fix this issue.

Sources:
- https://github.com/MiniMax-AI/minimax-code/blob/main/packages/agent-modules/plugin-hooks/src/contracts.ts
- https://github.com/MiniMax-AI/minimax-code/blob/main/packages/tui/docs/status-line-config.md

Acceptance for a future fix: use the local streamed model fixture, hold between
assistant text chunks, observe talking before Stop, and verify reasoning/tool
output does not trigger it. Existing native readiness and tool-hook smoke tests
do not prove live speaking support.
