import { expect, it } from "vitest";
import { parseChatIdentity, validChatIdentity } from "../../src/mcode/identity.js";

it("keeps only a bounded sanitized title and an opaque session identity", () => {
  const value = parseChatIdentity({ protocol: 1, event: "interval", session_id: "private-id", session_title: "  Fix\u202E\u0000 the\n build  ", workspace_dir: "private/path", prompt: "private prompt", model: "private model" });
  expect(value).toEqual({ session: expect.stringMatching(/^[a-f0-9]{24}$/), event: "interval", title: "Fix the build" });
  expect(validChatIdentity(value)).toBe(true);
  expect(JSON.stringify(value)).not.toContain("private");
  expect(Array.from(parseChatIdentity({ protocol: 1, event: "startup", session_id: "s", session_title: "x".repeat(400) })!.title!)).toHaveLength(120);
});
it("rejects unsupported protocols and represents an untitled chat explicitly", () => {
  expect(parseChatIdentity({ protocol: 2, event: "interval", session_id: "s" })).toBeNull();
  expect(parseChatIdentity({ protocol: 1, event: "startup" })).toBeNull();
  expect(parseChatIdentity({ protocol: 1, event: "interval", session_id: "s" })!.title).toBeNull();
  expect(validChatIdentity({ session: "s", event: "interval", title: "chat" })).toBe(false);
});
