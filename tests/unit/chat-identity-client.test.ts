import { afterEach, expect, it, vi } from "vitest";
import { createChatIdentityClient } from "../../desktop/src/chat-identity-client.js";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("updates the title through the authenticated channel and clears stale titles on failure", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ title: "Fix checkout" })))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  const onTitle = vi.fn();
  const client = createChatIdentityClient("http://127.0.0.1:4321", "a".repeat(43), onTitle);
  await vi.advanceTimersByTimeAsync(1);
  expect(onTitle).toHaveBeenLastCalledWith("Fix checkout");
  expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(`Bearer ${"a".repeat(43)}`);
  await vi.advanceTimersByTimeAsync(1000);
  expect(onTitle).toHaveBeenLastCalledWith(null);
  client.close();
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
