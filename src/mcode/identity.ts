import { createHash } from "node:crypto";

export interface ChatIdentity { session: string; title: string | null; event: string; }
export function parseChatIdentity(raw: unknown): ChatIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.protocol !== 1 || typeof value.session_id !== "string" || !value.session_id || value.session_id.length > 512) return null;
  if (!["startup", "turn-end", "session-change", "workspace-change", "interval"].includes(String(value.event))) return null;
  if (value.session_title !== undefined && typeof value.session_title !== "string") return null;
  const title = typeof value.session_title === "string" ? Array.from(value.session_title.normalize("NFC")
    .replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, "").replace(/\s+/gu, " ").trim()).slice(0, 120).join("") : "";
  return { session: createHash("sha256").update(value.session_id).digest("hex").slice(0, 24), title: title || null, event: String(value.event) };
}

export function validChatIdentity(raw: unknown): raw is ChatIdentity {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as ChatIdentity;
  return typeof value.session === "string" && /^[a-f0-9]{24}$/.test(value.session) &&
    (value.title === null || (typeof value.title === "string" && Array.from(value.title).length <= 120 && !/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(value.title))) &&
    ["startup", "turn-end", "session-change", "workspace-change", "interval"].includes(value.event);
}
