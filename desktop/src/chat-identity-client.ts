import { resolveSessionUrl } from "./session-stream-client";
import { buildCapabilityAuthorization } from "../../src/shared/session-capability";

export function createChatIdentityClient(endpoint: string, capability: string, onTitle: (title: string | null) => void) {
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  async function poll() {
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 1500);
    try {
      const response = await fetch(resolveSessionUrl(endpoint, "/identity"), {
        headers: { authorization: buildCapabilityAuthorization(capability) }, cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Chat identity unavailable");
      const data = await response.json();
      if (data.title !== null && (typeof data.title !== "string" || Array.from(data.title).length > 120)) throw new Error("Invalid chat title");
      if (!closed) onTitle(data.title);
    } catch {
      if (!closed) onTitle(null); // Never retain a potentially wrong chat title.
    } finally {
      clearTimeout(timeout);
      if (!closed) timer = setTimeout(poll, 1000);
    }
  }
  void poll();
  return { close() { closed = true; if (timer) clearTimeout(timer); controller?.abort(); } };
}
