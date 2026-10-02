import { describe, it, expect } from "vitest";
import { mapMCodeEvent, MCODE_EVENTS } from "../../src/mcode/events.js";
import { validConnection } from "../../src/mcode/connection.js";
import { mapEventSafe } from "../../src/claude/event-mapper.js";

describe("MCode observer contract", () => {
  it.each(MCODE_EVENTS)("accepts %s without copying model or project content", name => {
    const mapped = mapMCodeEvent({ hook_event_name: name, session_id: "native-session-secret", tool_name: "read", agent_id: "private-agent", prompt: "private-prompt", cwd: "private-path", tool_input: { value: "private-input" }, tool_response: "private-result" });
    expect(mapped).not.toBeNull();
    expect(JSON.stringify(mapped)).not.toMatch(/private-|native-session/);
    expect(mapEventSafe(mapped).state !== null || mapEventSafe(mapped).shutdown).toBe(true);
  });
  it.each(["read", "Read", "grep", "glob", "WebSearch", "web_search", "web_fetch"])("maps %s to reading", tool => {
    expect(mapEventSafe(mapMCodeEvent({ hook_event_name: "PreToolUse", session_id: "s", tool_name: tool })).state).toBe("read");
  });
  it.each(["write", "Write", "edit", "Edit", "apply_patch"])("maps %s to writing", tool => {
    expect(mapEventSafe(mapMCodeEvent({ hook_event_name: "PreToolUse", session_id: "s", tool_name: tool })).state).toBe("write");
  });
  it("rejects unknown events and malformed session identifiers", () => {
    for (const raw of [null, [], {}, { hook_event_name: "Stop", session_id: 4 }, { hook_event_name: "MessageDisplay", session_id: "s" }]) expect(mapMCodeEvent(raw)).toBeNull();
  });
  it("requires the direct MCode parent and an authenticated loopback destination", () => {
    const record = { version: 1, mcodePid: 123, launcherPid: 456, endpoint: "http://127.0.0.1:12345/event", capability: "a".repeat(43) };
    expect(validConnection(record, 123)).toBe(true);
    expect(validConnection(record, 124)).toBe(false);
    for (const endpoint of ["https://example.com/event", "http://localhost:123/event", "http://127.0.0.1:123/event?secret=x", "http://user@127.0.0.1:123/event"]) expect(validConnection({ ...record, endpoint }, 123)).toBe(false);
  });
});
