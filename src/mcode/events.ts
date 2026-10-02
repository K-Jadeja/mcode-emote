import { createHash } from "node:crypto";
import type { HookEvent } from "../claude/hook-event.js";

export const MCODE_EVENTS = ["SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "SubagentStart", "SubagentStop", "Stop", "PreCompact", "PostCompact"] as const;

/** Discard content before it reaches HTTP, logs, or the renderer. */
export function mapMCodeEvent(raw: unknown): HookEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.session_id !== "string" || !e.session_id || e.session_id.length > 512) return null;
  if (!MCODE_EVENTS.includes(e.hook_event_name as typeof MCODE_EVENTS[number])) return null;
  const session_id = createHash("sha256").update(e.session_id).digest("hex").slice(0, 24);
  const name = e.hook_event_name as typeof MCODE_EVENTS[number];
  if (name === "PreToolUse" || name === "PostToolUse" || name === "PermissionRequest") {
    const tool = typeof e.tool_name === "string" ? e.tool_name.toLowerCase() : "";
    const tool_name = ["read", "grep", "glob", "webfetch", "websearch", "web_fetch", "web_search"].includes(tool) ? "Read"
      : ["write", "edit", "multiedit", "notebookedit", "apply_patch"].includes(tool) ? "Write" : "Bash";
    return { hook_event_name: name, session_id, tool_name };
  }
  if (name === "SubagentStart" || name === "SubagentStop") {
    return { hook_event_name: name, session_id, subagent_id: "worker" };
  }
  return { hook_event_name: name, session_id };
}
